import { createClient } from "@supabase/supabase-js";

import {
  ASSESSMENT_ENGINE_VERSION,
  ASSESSMENT_JSON_SCHEMA,
  ASSESSMENT_PROMPT_VERSION,
  assessmentSnapshot,
  buildAssessmentPrompt,
  buildAssessmentRepairPrompt,
  buildAssessmentSystemInstruction,
  parseGeneratedAssessment,
  validateAssessment,
  type AssessmentItemCounts,
  type AssessmentMode,
  type AssessmentRequest,
  type GeneratedAssessment,
  type GeneratedAssessmentItem,
} from "@/lib/assessment/engine";
import {
  generateOpenAIJson,
  OpenAIProviderError,
  type OpenAIPart,
} from "@/lib/ai/openai";
import { completeAiRun, startAiRun } from "@/lib/data/ai-runs";
import { appendArtifactVersion } from "@/lib/data/artifact-version";
import { createAssessment } from "@/lib/data/assessments";
import { getSupabasePublicEnv } from "@/lib/env";
import { KSI_RESOURCE_BUCKET } from "@/lib/resources/storage";
import type { Database, KsiSupabaseClient } from "@/lib/supabase/database";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const MAX_SELECTED_RESOURCES = 3;
const MAX_INLINE_RESOURCE_BYTES = 12 * 1024 * 1024;
const AI_RUNS_PER_MINUTE = 6;
const SUPPORTED_INLINE_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SUPPORTED_TEXT_MIME = new Set([
  "text/plain",
  "text/csv",
  "application/json",
]);

type ResourceRow = Database["public"]["Tables"]["resources"]["Row"];
type AssessmentRow = Database["public"]["Tables"]["assessments"]["Row"];
type AssessmentItemRow =
  Database["public"]["Tables"]["assessment_items"]["Row"];

type ResourceContext = {
  rows: ResourceRow[];
  labels: string[];
  parts: OpenAIPart[];
  warnings: string[];
  sourceContext: Json[];
};

type GenerateBody = { action: "generate"; input: unknown };
type SaveEditsBody = {
  action: "save_edits";
  assessmentId: string;
  assessment: unknown;
};
type AssessmentBody = GenerateBody | SaveEditsBody;

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function toJson(value: unknown): Json {
  return value as Json;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  const row = record(caught);
  if (row && typeof row.message === "string") return row.message;
  return "The assessment request could not be completed.";
}

function errorCode(caught: unknown) {
  if (caught instanceof OpenAIProviderError) return caught.code;
  const row = record(caught);
  if (row && typeof row.code === "string") return `ASSESSMENT_DB_${row.code}`;
  return "ASSESSMENT_REQUEST_FAILED";
}

function errorStatus(caught: unknown) {
  if (caught instanceof OpenAIProviderError) {
    if (caught.code === "AI_PROVIDER_NOT_CONFIGURED") return 503;
    if (caught.code === "ASSESSMENT_RATE_LIMIT" || caught.code.includes("429")) {
      return 429;
    }
    return 502;
  }
  return record(caught)?.code ? 500 : 400;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integer(value: unknown, label: string, min: number, max: number) {
  const next = Number(value);
  if (!Number.isInteger(next) || next < min || next > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return next;
}

function optionalPositiveNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return next;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim()),
    ),
  ];
}

function parseCounts(value: unknown): AssessmentItemCounts {
  const row = record(value) ?? {};
  const read = (key: keyof AssessmentItemCounts) => {
    const next = Number(row[key] ?? 0);
    if (!Number.isInteger(next) || next < 0 || next > 100) {
      throw new Error("Assessment item counts must be non-negative whole numbers.");
    }
    return next;
  };
  return {
    objective: read("objective"),
    subjective: read("subjective"),
    critical_thinking: read("critical_thinking"),
    project: read("project"),
  };
}

function validateGenerateInput(value: unknown): AssessmentRequest {
  const input = record(value);
  if (!input) throw new Error("Assessment context is required.");

  const assessmentMode = requireString(
    input.assessmentMode,
    "Assessment mode",
  ) as AssessmentMode;
  if (
    ![
      "objective",
      "subjective",
      "critical_thinking",
      "project",
      "mixed",
    ].includes(assessmentMode)
  ) {
    throw new Error("Select a valid assessment mode.");
  }

  const totalItems = integer(input.totalItems, "Total items", 1, 60);
  const itemCounts = parseCounts(input.itemCounts);
  if (assessmentMode === "mixed") {
    const sum = Object.values(itemCounts).reduce((total, count) => total + count, 0);
    if (sum !== totalItems) {
      throw new Error(`Mixed item counts must add up to ${totalItems}.`);
    }
  }

  const resourceIds = uniqueStrings(input.resourceIds);
  if (resourceIds.length > MAX_SELECTED_RESOURCES) {
    throw new Error(`Select no more than ${MAX_SELECTED_RESOURCES} resources.`);
  }

  return {
    workspaceId: requireString(input.workspaceId, "Workspace"),
    subjectId: optionalString(input.subjectId),
    subject: requireString(input.subject, "Subject"),
    classId: optionalString(input.classId),
    classLevel: requireString(input.classLevel, "Class"),
    ageRange: requireString(input.ageRange, "Age range"),
    title: requireString(input.title, "Assessment title"),
    topic: requireString(input.topic, "Topic"),
    objective: requireString(input.objective, "Objective"),
    assessmentMode,
    totalItems,
    totalMarks: optionalPositiveNumber(input.totalMarks, "Total marks"),
    durationMinutes: optionalPositiveNumber(input.durationMinutes, "Duration"),
    sourceLessonId: optionalString(input.sourceLessonId),
    resourceIds,
    purpose: typeof input.purpose === "string" ? input.purpose.trim() : "",
    teacherInstructions:
      typeof input.teacherInstructions === "string"
        ? input.teacherInstructions.trim()
        : "",
    itemCounts,
  };
}

async function getAuthenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new Error("Authentication is required.");

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error("Your session is no longer valid. Sign in again and retry.");
  }
  return { supabase, user };
}

async function requireWorkspace(
  supabase: KsiSupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name")
    .eq("id", workspaceId)
    .single();
  if (error || !data) {
    throw new Error("The active workspace is not available to this account.");
  }
  return data;
}

async function resolveAcademicContext(
  supabase: KsiSupabaseClient,
  request: AssessmentRequest,
) {
  let subject = request.subject;
  let classLevel = request.classLevel;
  let ageRange = request.ageRange;
  if (request.subjectId) {
    const { data, error } = await supabase
      .from("subjects")
      .select("name,active")
      .eq("id", request.subjectId)
      .eq("workspace_id", request.workspaceId)
      .single();
    if (error || !data?.active) {
      throw new Error("The selected subject is not available in this workspace.");
    }
    subject = data.name;
  }
  if (request.classId) {
    const { data, error } = await supabase
      .from("classes")
      .select("name,age_range,active")
      .eq("id", request.classId)
      .eq("workspace_id", request.workspaceId)
      .single();
    if (error || !data?.active) {
      throw new Error("The selected class is not available in this workspace.");
    }
    classLevel = data.name;
    ageRange = data.age_range || request.ageRange;
  }
  return { ...request, subject, classLevel, ageRange };
}

async function enforceAiRateLimit(
  supabase: KsiSupabaseClient,
  userId: string,
  workspaceId: string,
) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("initiated_by", userId)
    .gte("started_at", since);
  if (error) throw error;
  if ((count ?? 0) >= AI_RUNS_PER_MINUTE) {
    throw new OpenAIProviderError(
      "ASSESSMENT_RATE_LIMIT",
      "Several AI requests were made very quickly. Wait about a minute and try again.",
    );
  }
}

async function loadSourceLesson(
  supabase: KsiSupabaseClient,
  workspaceId: string,
  lessonId: string | null,
) {
  if (!lessonId) return { lesson: null, context: "" };
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id,title,topic,objective,status,class_id,subject_id")
    .eq("id", lessonId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error || !lesson) {
    throw new Error("The selected HQLS lesson is not available in this workspace.");
  }
  const { data: stages, error: stageError } = await supabase
    .from("lesson_stages")
    .select("stage_number,stage_key,content")
    .eq("lesson_id", lessonId)
    .order("stage_number");
  if (stageError) throw stageError;
  if (!stages || stages.length !== 7) {
    throw new Error("The selected HQLS lesson is incomplete.");
  }
  const stageContext = stages
    .map((stage) => {
      const content = record(stage.content) ?? {};
      const purpose = typeof content.purpose === "string" ? content.purpose : "";
      const experience =
        typeof content.experience === "string" ? content.experience : "";
      const evidence = Array.isArray(content.evidenceToNotice)
        ? content.evidenceToNotice.filter((item): item is string => typeof item === "string").join("; ")
        : "";
      return `Stage ${stage.stage_number} ${stage.stage_key}: purpose=${purpose}; experience=${experience}; evidence=${evidence}`;
    })
    .join("\n");
  return {
    lesson,
    context: `Lesson title: ${lesson.title}\nTopic: ${lesson.topic}\nObjective: ${lesson.objective}\n${stageContext}`,
  };
}

async function loadResourceContext(
  supabase: KsiSupabaseClient,
  workspaceId: string,
  resourceIds: string[],
): Promise<ResourceContext> {
  if (!resourceIds.length) {
    return { rows: [], labels: [], parts: [], warnings: [], sourceContext: [] };
  }
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("id", resourceIds);
  if (error) throw error;
  const rows = (data ?? []) as ResourceRow[];
  if (rows.length !== resourceIds.length) {
    throw new Error("One or more selected resources are unavailable in this workspace.");
  }

  const orderedRows = resourceIds
    .map((id) => rows.find((row) => row.id === id))
    .filter((row): row is ResourceRow => Boolean(row));
  const labels: string[] = [];
  const parts: OpenAIPart[] = [];
  const warnings: string[] = [];
  const sourceContext: Json[] = [];
  let inlineBytes = 0;

  for (const row of orderedRows) {
    const label = `${row.title} (${row.resource_type})`;
    labels.push(label);
    sourceContext.push({
      resourceId: row.id,
      title: row.title,
      resourceType: row.resource_type,
      mimeType: row.mime_type,
      visibility: row.visibility,
    });
    if (row.extracted_text?.trim()) {
      parts.push({ text: `\nAUTHORISED SOURCE: ${label}\n${row.extracted_text.slice(0, 100_000)}` });
      continue;
    }
    if (!row.storage_path || !row.mime_type) {
      warnings.push(`${row.title}: readable content is not available yet.`);
      continue;
    }
    const { data: blob, error: downloadError } = await supabase.storage
      .from(KSI_RESOURCE_BUCKET)
      .download(row.storage_path);
    if (downloadError) throw downloadError;
    if (SUPPORTED_TEXT_MIME.has(row.mime_type)) {
      parts.push({ text: `\nAUTHORISED SOURCE: ${label}\n${(await blob.text()).slice(0, 100_000)}` });
      continue;
    }
    if (SUPPORTED_INLINE_MIME.has(row.mime_type)) {
      if (inlineBytes + blob.size > MAX_INLINE_RESOURCE_BYTES) {
        warnings.push(`${row.title}: skipped because selected sources exceed the safe inline limit.`);
        continue;
      }
      inlineBytes += blob.size;
      const data64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      parts.push({ inlineData: { mimeType: row.mime_type, data: data64 } });
      parts.push({ text: `The preceding file is authorised source material: ${label}.` });
      continue;
    }
    warnings.push(`${row.title}: this file type cannot be read directly by the generator.`);
  }
  return { rows: orderedRows, labels, parts, warnings, sourceContext };
}

function configuredOpenAIModel() {
  return (
    process.env.KSI_OPENAI_MODEL?.trim() ||
    process.env.KSI_AI_MODEL?.trim() ||
    "gpt-5-mini"
  );
}

function toAssessmentItemInput(item: GeneratedAssessmentItem) {
  return {
    position: item.position,
    itemType: item.itemType,
    criticalThinkingType: item.criticalThinkingType || null,
    topic: item.topic,
    objective: item.objective,
    difficulty: item.difficulty,
    marks: item.marks,
    content: {
      prompt: item.prompt,
      options: item.options,
      competency: item.competency,
      expectedEvidence: item.expectedEvidence,
      deliverable: item.deliverable,
      constraints: item.constraints,
      answerRationale: item.answerRationale,
    },
    answerKey:
      item.itemType === "objective"
        ? { correctAnswer: item.correctAnswer, rationale: item.answerRationale }
        : null,
    markingGuide:
      item.itemType === "objective"
        ? null
        : {
            criteria: item.markingGuide,
            expectedEvidence: item.expectedEvidence,
            deliverable: item.deliverable || null,
          },
    metadata: {
      competency: item.competency,
      expectedEvidence: item.expectedEvidence,
    },
  };
}

async function attachAiRunArtifact(
  supabase: KsiSupabaseClient,
  runId: string,
  assessmentId: string,
) {
  const { error } = await supabase
    .from("ai_runs")
    .update({ artifact_id: assessmentId, artifact_type: "assessment" })
    .eq("id", runId);
  if (error) throw error;
}

async function linkResources(args: {
  supabase: KsiSupabaseClient;
  workspaceId: string;
  assessmentId: string;
  userId: string;
  resources: ResourceRow[];
}) {
  if (!args.resources.length) return;
  const { error } = await args.supabase.from("artifact_resource_links").insert(
    args.resources.map((resource) => ({
      workspace_id: args.workspaceId,
      resource_id: resource.id,
      artifact_type: "assessment" as const,
      artifact_id: args.assessmentId,
      purpose: "generation_context",
      created_by: args.userId,
    })),
  );
  if (error) throw error;
}

async function fetchAssessmentWithItems(
  supabase: KsiSupabaseClient,
  assessmentId: string,
) {
  const [assessmentResult, itemResult] = await Promise.all([
    supabase.from("assessments").select("*").eq("id", assessmentId).single(),
    supabase
      .from("assessment_items")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("position"),
  ]);
  if (assessmentResult.error) throw assessmentResult.error;
  if (itemResult.error) throw itemResult.error;
  if (!assessmentResult.data || !itemResult.data?.length) {
    throw new Error("The saved assessment is incomplete.");
  }
  return {
    assessment: assessmentResult.data as AssessmentRow,
    items: itemResult.data as AssessmentItemRow[],
  };
}

function generatedItemFromRow(row: AssessmentItemRow): GeneratedAssessmentItem {
  const content = record(row.content) ?? {};
  const answerKey = record(row.answer_key) ?? {};
  const markingGuide = record(row.marking_guide) ?? {};
  const list = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return {
    position: row.position,
    itemType: row.item_type,
    criticalThinkingType: row.critical_thinking_type ?? "",
    topic: row.topic ?? "",
    objective: row.objective ?? "",
    competency:
      typeof content.competency === "string" ? content.competency : "",
    difficulty:
      row.difficulty === "easy" ||
      row.difficulty === "moderate" ||
      row.difficulty === "challenging"
        ? row.difficulty
        : "moderate",
    marks: Number(row.marks ?? 0),
    prompt: typeof content.prompt === "string" ? content.prompt : "",
    options: list(content.options),
    correctAnswer:
      typeof answerKey.correctAnswer === "string" ? answerKey.correctAnswer : "",
    answerRationale:
      typeof content.answerRationale === "string"
        ? content.answerRationale
        : typeof answerKey.rationale === "string"
          ? answerKey.rationale
          : "",
    expectedEvidence: list(content.expectedEvidence),
    markingGuide: list(markingGuide.criteria),
    deliverable:
      typeof content.deliverable === "string" ? content.deliverable : "",
    constraints: list(content.constraints),
  };
}

function assessmentFromRows(
  assessment: AssessmentRow,
  items: AssessmentItemRow[],
): GeneratedAssessment {
  const blueprint = record(assessment.blueprint) ?? {};
  return parseGeneratedAssessment({
    title: assessment.title,
    studentInstructions:
      typeof blueprint.studentInstructions === "string"
        ? blueprint.studentInstructions
        : "Answer all questions as instructed.",
    blueprint,
    items: items.map(generatedItemFromRow),
  });
}

async function handleGenerate(
  supabase: KsiSupabaseClient,
  userId: string,
  rawInput: unknown,
) {
  let runId: string | null = null;
  try {
    const firstInput = validateGenerateInput(rawInput);
    await requireWorkspace(supabase, firstInput.workspaceId);
    const input = await resolveAcademicContext(supabase, firstInput);
    await enforceAiRateLimit(supabase, userId, input.workspaceId);
    const sourceLesson = await loadSourceLesson(
      supabase,
      input.workspaceId,
      input.sourceLessonId,
    );
    const resources = await loadResourceContext(
      supabase,
      input.workspaceId,
      input.resourceIds,
    );

    runId = await startAiRun(supabase, {
      workspaceId: input.workspaceId,
      userId,
      engine: "assessment_generation",
      engineVersion: ASSESSMENT_ENGINE_VERSION,
      promptVersion: ASSESSMENT_PROMPT_VERSION,
      provider: "openai",
      model: configuredOpenAIModel(),
      artifactType: "assessment",
      inputSummary: {
        subject: input.subject,
        classLevel: input.classLevel,
        topic: input.topic,
        assessmentMode: input.assessmentMode,
        totalItems: input.totalItems,
        totalMarks: input.totalMarks,
        sourceLessonId: input.sourceLessonId,
        resourceCount: resources.rows.length,
      },
    });

    const generatedResult = await generateOpenAIJson<unknown>({
      systemInstruction: buildAssessmentSystemInstruction(),
      parts: [
        {
          text: buildAssessmentPrompt(
            input,
            sourceLesson.context,
            resources.labels,
          ),
        },
        ...resources.parts,
      ],
      responseSchema: ASSESSMENT_JSON_SCHEMA,
      schemaName: "ksi_assessment",
      maxOutputTokens: 10000,
    });

    let assessment = parseGeneratedAssessment(generatedResult.data);
    let validation = validateAssessment(assessment, input);
    if (!validation.passed) {
      const repairedResult = await generateOpenAIJson<unknown>({
        systemInstruction: buildAssessmentSystemInstruction(),
        parts: [
          { text: buildAssessmentRepairPrompt(input, assessment, validation) },
          ...resources.parts,
        ],
        responseSchema: ASSESSMENT_JSON_SCHEMA,
        schemaName: "ksi_assessment_repair",
        maxOutputTokens: 10000,
      });
      assessment = parseGeneratedAssessment(repairedResult.data);
      validation = validateAssessment(assessment, input);
    }

    if (!validation.passed) {
      await completeAiRun(
        supabase,
        runId,
        "failed",
        "ASSESSMENT_VALIDATION_FAILED",
      );
      return json(
        {
          error:
            "The generated assessment did not pass KAEC assessment validation after repair, so it was not saved.",
          code: "ASSESSMENT_VALIDATION_FAILED",
          validation,
        },
        422,
      );
    }

    const persisted = await createAssessment(supabase, {
      workspaceId: input.workspaceId,
      userId,
      title: assessment.title,
      mode: input.assessmentMode,
      sourceLessonId: input.sourceLessonId,
      classId: input.classId,
      subjectId: input.subjectId,
      blueprint: {
        ...assessment.blueprint,
        studentInstructions: assessment.studentInstructions,
        validation,
        topic: input.topic,
        objective: input.objective,
        durationMinutes: input.durationMinutes,
      },
      sourceContext: resources.sourceContext,
      engineVersion: ASSESSMENT_ENGINE_VERSION,
      promptVersion: ASSESSMENT_PROMPT_VERSION,
      items: assessment.items.map(toAssessmentItemInput),
    });

    const { error: statusError } = await supabase
      .from("assessments")
      .update({ status: "validated" })
      .eq("id", persisted.id);
    if (statusError) throw statusError;

    await attachAiRunArtifact(supabase, runId, persisted.id);
    await linkResources({
      supabase,
      workspaceId: input.workspaceId,
      assessmentId: persisted.id,
      userId,
      resources: resources.rows,
    });
    await completeAiRun(supabase, runId, "succeeded");

    const refreshed = await fetchAssessmentWithItems(supabase, persisted.id);
    return json({
      assessment: refreshed.assessment,
      items: refreshed.items,
      validation,
      sources: resources.labels,
      sourceWarnings: resources.warnings,
      provider: generatedResult.provider,
      model: generatedResult.model,
    });
  } catch (caught) {
    if (runId) {
      await completeAiRun(supabase, runId, "failed", errorCode(caught)).catch(
        () => undefined,
      );
    }
    throw caught;
  }
}

async function handleSaveEdits(
  supabase: KsiSupabaseClient,
  userId: string,
  body: SaveEditsBody,
) {
  const assessmentId = requireString(body.assessmentId, "Assessment id");
  const current = await fetchAssessmentWithItems(supabase, assessmentId);
  const edited = parseGeneratedAssessment(body.assessment);

  const blueprint = record(current.assessment.blueprint) ?? {};
  const request = validateGenerateInput({
    workspaceId: current.assessment.workspace_id,
    subjectId: current.assessment.subject_id,
    subject: typeof blueprint.subject === "string" ? blueprint.subject : "Subject",
    classId: current.assessment.class_id,
    classLevel:
      typeof blueprint.classLevel === "string" ? blueprint.classLevel : "Class",
    ageRange: typeof blueprint.ageRange === "string" ? blueprint.ageRange : "Not specified",
    title: edited.title,
    topic: typeof blueprint.topic === "string" ? blueprint.topic : edited.items[0]?.topic,
    objective:
      typeof blueprint.objective === "string"
        ? blueprint.objective
        : edited.items[0]?.objective,
    assessmentMode: current.assessment.assessment_mode,
    totalItems: current.items.length,
    totalMarks:
      typeof blueprint.totalMarks === "number" ? blueprint.totalMarks : null,
    durationMinutes:
      typeof blueprint.durationMinutes === "number"
        ? blueprint.durationMinutes
        : null,
    sourceLessonId: current.assessment.source_lesson_id,
    resourceIds: [],
    purpose: "",
    teacherInstructions: "",
    itemCounts: edited.blueprint.itemDistribution,
  });
  const validation = validateAssessment(edited, request);
  if (!validation.passed) {
    return json(
      {
        error: "The edited assessment needs correction before it can be saved as validated.",
        code: "ASSESSMENT_EDIT_VALIDATION_FAILED",
        validation,
      },
      422,
    );
  }

  if (edited.items.length !== current.items.length) {
    throw new Error("Manual editing cannot change the number of assessment items.");
  }

  const { error: assessmentError } = await supabase
    .from("assessments")
    .update({
      title: edited.title,
      status: "validated",
      blueprint: {
        ...edited.blueprint,
        studentInstructions: edited.studentInstructions,
        validation,
        topic: request.topic,
        objective: request.objective,
        durationMinutes: request.durationMinutes,
        subject: request.subject,
        classLevel: request.classLevel,
        ageRange: request.ageRange,
      } as Json,
      engine_version: ASSESSMENT_ENGINE_VERSION,
      prompt_version: ASSESSMENT_PROMPT_VERSION,
    })
    .eq("id", assessmentId);
  if (assessmentError) throw assessmentError;

  for (const item of edited.items) {
    const input = toAssessmentItemInput(item);
    const { error } = await supabase
      .from("assessment_items")
      .update({
        item_type: input.itemType,
        critical_thinking_type: input.criticalThinkingType,
        topic: input.topic,
        objective: input.objective,
        difficulty: input.difficulty,
        marks: input.marks,
        content: input.content as Json,
        answer_key: input.answerKey as Json | null,
        marking_guide: input.markingGuide as Json | null,
        metadata: input.metadata as Json,
      })
      .eq("assessment_id", assessmentId)
      .eq("position", item.position);
    if (error) throw error;
  }

  const refreshed = await fetchAssessmentWithItems(supabase, assessmentId);
  await appendArtifactVersion(supabase, {
    workspaceId: current.assessment.workspace_id,
    artifactType: "assessment",
    artifactId: assessmentId,
    snapshot: {
      assessment: refreshed.assessment,
      items: refreshed.items,
    },
    origin: "manual_edit",
    engineVersion: ASSESSMENT_ENGINE_VERSION,
    promptVersion: ASSESSMENT_PROMPT_VERSION,
  });

  return json({
    assessment: refreshed.assessment,
    items: refreshed.items,
    validation,
  });
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient(request);
    const body = (await request.json()) as AssessmentBody;
    if (!body || typeof body !== "object" || !body.action) {
      throw new Error("Assessment action is required.");
    }
    if (body.action === "generate") {
      return await handleGenerate(supabase, user.id, body.input);
    }
    if (body.action === "save_edits") {
      return await handleSaveEdits(supabase, user.id, body);
    }
    throw new Error("Unsupported assessment action.");
  } catch (caught) {
    return json(
      { error: errorMessage(caught), code: errorCode(caught) },
      errorStatus(caught),
    );
  }
}
