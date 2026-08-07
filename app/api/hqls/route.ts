import { createClient } from "@supabase/supabase-js";

import {
  generateOpenAIJson,
  OpenAIProviderError,
  type OpenAIPart,
} from "@/lib/ai/openai";
import { completeAiRun, startAiRun } from "@/lib/data/ai-runs";
import { appendArtifactVersion } from "@/lib/data/artifact-version";
import { createLesson } from "@/lib/data/lessons";
import { getSupabasePublicEnv } from "@/lib/env";
import {
  HQLS_ENGINE_VERSION,
  HQLS_LESSON_JSON_SCHEMA,
  HQLS_PROMPT_VERSION,
  HQLS_STAGE_JSON_SCHEMA,
  buildHqlsGenerationPrompt,
  buildHqlsGenerationSystemInstruction,
  buildHqlsRepairPrompt,
  buildStageRegenerationPrompt,
  lessonContextSummary,
  parseGeneratedHqlsLesson,
  parseHqlsStageContent,
  toLessonStageInputs,
  validateHqlsLesson,
  type GeneratedHqlsLesson,
  type HqlsLessonRequest,
  type HqlsStageAction,
} from "@/lib/hqls/engine";
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
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];
type LessonStageRow = Database["public"]["Tables"]["lesson_stages"]["Row"];

type ResourceContext = {
  rows: ResourceRow[];
  labels: string[];
  parts: OpenAIPart[];
  warnings: string[];
  sourceContext: Json[];
};

type GenerateBody = {
  action: "generate";
  input: HqlsLessonRequest;
};

type SaveEditsBody = {
  action: "save_edits";
  lessonId: string;
  stages: unknown[];
};

type RegenerateStageBody = {
  action: "regenerate_stage";
  lessonId: string;
  stageNumber: number;
  stageAction: HqlsStageAction;
};

type HqlsRequestBody = GenerateBody | SaveEditsBody | RegenerateStageBody;

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function toJson(value: unknown): Json {
  return value as Json;
}

function errorRecord(caught: unknown): Record<string, unknown> | null {
  if (!caught || typeof caught !== "object" || Array.isArray(caught)) return null;
  return caught as Record<string, unknown>;
}

function errorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  const record = errorRecord(caught);
  if (record && typeof record.message === "string" && record.message.trim()) {
    const details =
      typeof record.details === "string" && record.details.trim()
        ? ` ${record.details.trim()}`
        : "";
    const hint =
      typeof record.hint === "string" && record.hint.trim()
        ? ` ${record.hint.trim()}`
        : "";
    return `${record.message.trim()}${details}${hint}`.trim();
  }
  return "The HQLS request could not be completed.";
}

function errorCode(caught: unknown) {
  if (caught instanceof OpenAIProviderError) return caught.code;
  const record = errorRecord(caught);
  if (record && typeof record.code === "string" && record.code.trim()) {
    return `HQLS_DB_${record.code.trim()}`;
  }
  return "HQLS_REQUEST_FAILED";
}

function errorStatus(caught: unknown) {
  if (caught instanceof OpenAIProviderError) {
    if (caught.code === "AI_PROVIDER_NOT_CONFIGURED") return 503;
    if (
      caught.code === "HQLS_RATE_LIMIT" ||
      caught.code.startsWith("OPENAI_HTTP_429")
    ) {
      return 429;
    }
    return 502;
  }
  if (errorRecord(caught)?.code) return 500;
  return 400;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
        .map((item) => item.trim()),
    ),
  ];
}

function validateGenerateInput(value: unknown): HqlsLessonRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lesson context is required.");
  }
  const input = value as Record<string, unknown>;
  const durationMinutes = Number(input.durationMinutes);
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 10 ||
    durationMinutes > 240
  ) {
    throw new Error("Lesson duration must be between 10 and 240 minutes.");
  }

  const resourceIds = uniqueStrings(input.resourceIds);
  if (resourceIds.length > MAX_SELECTED_RESOURCES) {
    throw new Error(
      `Select no more than ${MAX_SELECTED_RESOURCES} source resources per generation.`,
    );
  }

  return {
    workspaceId: requireString(input.workspaceId, "Workspace"),
    subjectId:
      typeof input.subjectId === "string" && input.subjectId
        ? input.subjectId
        : null,
    subject: requireString(input.subject, "Subject"),
    classId:
      typeof input.classId === "string" && input.classId ? input.classId : null,
    classLevel: requireString(input.classLevel, "Class level"),
    ageRange: requireString(input.ageRange, "Age or age range"),
    durationMinutes: Math.round(durationMinutes),
    topic: requireString(input.topic, "Topic"),
    objective: requireString(input.objective, "Lesson objective"),
    previousLearning:
      typeof input.previousLearning === "string"
        ? input.previousLearning.trim()
        : "",
    availableResources:
      typeof input.availableResources === "string"
        ? input.availableResources.trim()
        : "",
    classContext:
      typeof input.classContext === "string" ? input.classContext.trim() : "",
    teacherInstructions:
      typeof input.teacherInstructions === "string"
        ? input.teacherInstructions.trim()
        : "",
    resourceIds,
  };
}

async function getAuthenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) {
    throw new Error("Authentication is required.");
  }

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
    .select("id,name,workspace_type")
    .eq("id", workspaceId)
    .single();
  if (error || !data) {
    throw new Error("The active workspace is not available to this account.");
  }
  return data;
}

async function resolveAcademicContext(
  supabase: KsiSupabaseClient,
  input: HqlsLessonRequest,
) {
  let subject = input.subject;
  let classLevel = input.classLevel;
  let ageRange = input.ageRange;

  if (input.subjectId) {
    const { data, error } = await supabase
      .from("subjects")
      .select("id,name,active")
      .eq("id", input.subjectId)
      .eq("workspace_id", input.workspaceId)
      .single();
    if (error || !data || !data.active) {
      throw new Error("The selected subject is not available in this workspace.");
    }
    subject = data.name;
  }

  if (input.classId) {
    const { data, error } = await supabase
      .from("classes")
      .select("id,name,age_range,active")
      .eq("id", input.classId)
      .eq("workspace_id", input.workspaceId)
      .single();
    if (error || !data || !data.active) {
      throw new Error("The selected class is not available in this workspace.");
    }
    classLevel = data.name;
    ageRange = input.ageRange || data.age_range || input.ageRange;
  }

  return { ...input, subject, classLevel, ageRange };
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
      "HQLS_RATE_LIMIT",
      "You have generated several lessons very quickly. Wait about a minute and try again.",
    );
  }
}

async function loadResourceContext(
  supabase: KsiSupabaseClient,
  workspaceId: string,
  resourceIds: string[],
): Promise<ResourceContext> {
  if (resourceIds.length === 0) {
    return {
      rows: [],
      labels: [],
      parts: [],
      warnings: [],
      sourceContext: [],
    };
  }

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("id", resourceIds);
  if (error) throw error;

  const rows = (data ?? []) as ResourceRow[];
  if (rows.length !== resourceIds.length) {
    throw new Error(
      "One or more selected resources are unavailable in this workspace.",
    );
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
      parts.push({
        text: `\nAUTHORISED SOURCE: ${label}\n${row.extracted_text.slice(0, 100_000)}`,
      });
      continue;
    }

    if (!row.storage_path || !row.mime_type) {
      warnings.push(
        `${row.title}: no readable file content is available yet.`,
      );
      continue;
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(KSI_RESOURCE_BUCKET)
      .download(row.storage_path);
    if (downloadError) throw downloadError;

    if (SUPPORTED_TEXT_MIME.has(row.mime_type)) {
      const text = await blob.text();
      parts.push({
        text: `\nAUTHORISED SOURCE: ${label}\n${text.slice(0, 100_000)}`,
      });
      continue;
    }

    if (SUPPORTED_INLINE_MIME.has(row.mime_type)) {
      if (inlineBytes + blob.size > MAX_INLINE_RESOURCE_BYTES) {
        warnings.push(
          `${row.title}: skipped because selected source files exceed the safe inline generation limit.`,
        );
        continue;
      }
      inlineBytes += blob.size;
      const data64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      parts.push({
        inlineData: { mimeType: row.mime_type, data: data64 },
      });
      parts.push({
        text: `The preceding file is authorised source material: ${label}.`,
      });
      continue;
    }

    warnings.push(
      `${row.title}: this file type cannot be read directly by the Stage 2 generator yet; its title/provenance is still recorded.`,
    );
  }

  return { rows: orderedRows, labels, parts, warnings, sourceContext };
}

async function persistFidelityCheck(args: {
  supabase: KsiSupabaseClient;
  lessonId: string;
  validation: ReturnType<typeof validateHqlsLesson>;
}) {
  const { error } = await args.supabase.rpc(
    "record_hqls_system_fidelity_check",
    {
      target_lesson_id: args.lessonId,
      target_passed: args.validation.passed,
      target_score: args.validation.score,
      target_violations: toJson(args.validation.violations),
      target_evidence: toJson(args.validation.evidence),
      target_engine_version: HQLS_ENGINE_VERSION,
    },
  );
  if (error) throw error;
}

async function linkResources(args: {
  supabase: KsiSupabaseClient;
  workspaceId: string;
  lessonId: string;
  userId: string;
  resources: ResourceRow[];
}) {
  if (args.resources.length === 0) return;
  const { error } = await args.supabase.from("artifact_resource_links").insert(
    args.resources.map((resource) => ({
      workspace_id: args.workspaceId,
      resource_id: resource.id,
      artifact_type: "lesson" as const,
      artifact_id: args.lessonId,
      purpose: "generation_context",
      created_by: args.userId,
    })),
  );
  if (error) throw error;
}

async function attachAiRunArtifact(
  supabase: KsiSupabaseClient,
  runId: string,
  lessonId: string,
) {
  const { error } = await supabase
    .from("ai_runs")
    .update({ artifact_id: lessonId, artifact_type: "lesson" })
    .eq("id", runId);
  if (error) throw error;
}

async function fetchLessonWithStages(
  supabase: KsiSupabaseClient,
  lessonId: string,
) {
  const [
    { data: lesson, error: lessonError },
    { data: stages, error: stagesError },
  ] = await Promise.all([
    supabase.from("lessons").select("*").eq("id", lessonId).single(),
    supabase
      .from("lesson_stages")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("stage_number"),
  ]);
  if (lessonError) throw lessonError;
  if (stagesError) throw stagesError;
  if (!lesson || !stages || stages.length !== 7) {
    throw new Error("The saved HQLS lesson is incomplete.");
  }
  return {
    lesson: lesson as LessonRow,
    stages: stages as LessonStageRow[],
  };
}

function lessonFromRows(
  lesson: LessonRow,
  stages: LessonStageRow[],
): GeneratedHqlsLesson {
  return {
    title: lesson.title,
    lessonIntent: lesson.objective,
    stages: stages.map((stage, index) =>
      parseHqlsStageContent(stage.content, index + 1),
    ),
  };
}

async function saveLessonValidation(args: {
  supabase: KsiSupabaseClient;
  lesson: LessonRow;
  validation: ReturnType<typeof validateHqlsLesson>;
}) {
  const { error } = await args.supabase
    .from("lessons")
    .update({
      status: args.validation.passed ? "validated" : "draft",
      validation_summary: toJson(args.validation),
      engine_version: HQLS_ENGINE_VERSION,
      prompt_version: HQLS_PROMPT_VERSION,
    })
    .eq("id", args.lesson.id);
  if (error) throw error;
}

function configuredOpenAIModel() {
  return (
    process.env.KSI_OPENAI_MODEL?.trim() ||
    process.env.KSI_AI_MODEL?.trim() ||
    "gpt-5.6-terra"
  );
}

async function handleGenerate(
  supabase: KsiSupabaseClient,
  userId: string,
  rawInput: unknown,
) {
  let runId: string | null = null;
  try {
    const validatedInput = validateGenerateInput(rawInput);
    await requireWorkspace(supabase, validatedInput.workspaceId);
    const input = await resolveAcademicContext(supabase, validatedInput);
    await enforceAiRateLimit(supabase, userId, input.workspaceId);
    const resources = await loadResourceContext(
      supabase,
      input.workspaceId,
      input.resourceIds ?? [],
    );

    runId = await startAiRun(supabase, {
      workspaceId: input.workspaceId,
      userId,
      engine: "hqls_lesson",
      engineVersion: HQLS_ENGINE_VERSION,
      promptVersion: HQLS_PROMPT_VERSION,
      provider: "openai",
      model: configuredOpenAIModel(),
      artifactType: "lesson",
      inputSummary: {
        subject: input.subject,
        topic: input.topic,
        classLevel: input.classLevel,
        ageRange: input.ageRange,
        durationMinutes: input.durationMinutes,
        objective: input.objective,
        resourceCount: resources.rows.length,
      },
    });

    const generated = await generateOpenAIJson<unknown>({
      systemInstruction: buildHqlsGenerationSystemInstruction(),
      parts: [
        { text: buildHqlsGenerationPrompt(input, resources.labels) },
        ...resources.parts,
      ],
      responseSchema: HQLS_LESSON_JSON_SCHEMA,
      schemaName: "ksi_hqls_lesson",
      maxOutputTokens: 14000,
    });

    let lesson = parseGeneratedHqlsLesson(generated.data);
    let validation = validateHqlsLesson(lesson);

    if (!validation.passed) {
      const repaired = await generateOpenAIJson<unknown>({
        systemInstruction: buildHqlsGenerationSystemInstruction(),
        parts: [
          { text: buildHqlsRepairPrompt(input, lesson, validation) },
          ...resources.parts,
        ],
        responseSchema: HQLS_LESSON_JSON_SCHEMA,
        schemaName: "ksi_hqls_lesson_repair",
        maxOutputTokens: 14000,
      });
      lesson = parseGeneratedHqlsLesson(repaired.data);
      validation = validateHqlsLesson(lesson);
    }

    if (!validation.passed) {
      await completeAiRun(
        supabase,
        runId,
        "failed",
        "HQLS_FIDELITY_FAILED",
      );
      return json(
        {
          error:
            "The generated lesson did not meet HQLS fidelity after repair, so it was not saved.",
          code: "HQLS_FIDELITY_FAILED",
          validation,
        },
        422,
      );
    }

    const persisted = await createLesson(supabase, {
      workspaceId: input.workspaceId,
      title: lesson.title,
      topic: input.topic,
      objective: input.objective,
      ageRange: input.ageRange,
      durationMinutes: input.durationMinutes,
      classId: input.classId ?? null,
      subjectId: input.subjectId ?? null,
      engineVersion: HQLS_ENGINE_VERSION,
      promptVersion: HQLS_PROMPT_VERSION,
      sourceContext: resources.sourceContext,
      stages: toLessonStageInputs(lesson, validation),
    });

    const savedLesson = persisted.lesson as LessonRow;
    await saveLessonValidation({ supabase, lesson: savedLesson, validation });
    await attachAiRunArtifact(supabase, runId, savedLesson.id);
    await persistFidelityCheck({
      supabase,
      lessonId: savedLesson.id,
      validation,
    });
    await linkResources({
      supabase,
      workspaceId: input.workspaceId,
      lessonId: savedLesson.id,
      userId,
      resources: resources.rows,
    });
    await completeAiRun(supabase, runId, "succeeded");

    const refreshed = await fetchLessonWithStages(supabase, savedLesson.id);
    return json({
      lesson: refreshed.lesson,
      stages: refreshed.stages,
      validation,
      sources: resources.labels,
      sourceWarnings: resources.warnings,
      provider: generated.provider,
      model: generated.model,
    });
  } catch (caught) {
    if (runId) {
      await completeAiRun(
        supabase,
        runId,
        "failed",
        errorCode(caught),
      ).catch(() => undefined);
    }
    throw caught;
  }
}

async function handleSaveEdits(
  supabase: KsiSupabaseClient,
  userId: string,
  body: SaveEditsBody,
) {
  const lessonId = requireString(body.lessonId, "Lesson id");
  if (!Array.isArray(body.stages) || body.stages.length !== 7) {
    throw new Error("All seven HQLS stages are required when saving edits.");
  }

  const current = await fetchLessonWithStages(supabase, lessonId);
  const editedLesson: GeneratedHqlsLesson = {
    title: current.lesson.title,
    lessonIntent: current.lesson.objective,
    stages: body.stages.map((stage, index) =>
      parseHqlsStageContent(stage, index + 1),
    ),
  };
  const validation = validateHqlsLesson(editedLesson);

  await Promise.all(
    editedLesson.stages.map(async (stage) => {
      const { error } = await supabase
        .from("lesson_stages")
        .update({
          content: toJson(stage),
          validation: toJson(validation.stageValidation[stage.stageKey]),
        })
        .eq("lesson_id", lessonId)
        .eq("stage_number", stage.stageNumber)
        .eq("stage_key", stage.stageKey);
      if (error) throw error;
    }),
  );

  await saveLessonValidation({
    supabase,
    lesson: current.lesson,
    validation,
  });
  await persistFidelityCheck({
    supabase,
    lessonId,
    validation,
  });

  const refreshed = await fetchLessonWithStages(supabase, lessonId);
  await appendArtifactVersion(supabase, {
    workspaceId: current.lesson.workspace_id,
    artifactType: "lesson",
    artifactId: lessonId,
    snapshot: { lesson: refreshed.lesson, stages: refreshed.stages },
    origin: "manual_edit",
    engineVersion: HQLS_ENGINE_VERSION,
    promptVersion: HQLS_PROMPT_VERSION,
  });

  return json({
    lesson: refreshed.lesson,
    stages: refreshed.stages,
    validation,
  });
}

async function loadLinkedResourceContext(
  supabase: KsiSupabaseClient,
  lesson: LessonRow,
) {
  const { data: links, error } = await supabase
    .from("artifact_resource_links")
    .select("resource_id")
    .eq("workspace_id", lesson.workspace_id)
    .eq("artifact_type", "lesson")
    .eq("artifact_id", lesson.id);
  if (error) throw error;
  return loadResourceContext(
    supabase,
    lesson.workspace_id,
    (links ?? [])
      .map((link) => link.resource_id)
      .slice(0, MAX_SELECTED_RESOURCES),
  );
}

async function resolveSavedLessonNames(
  supabase: KsiSupabaseClient,
  lesson: LessonRow,
) {
  let subject = "General / not linked";
  let classLevel = "Not linked";
  if (lesson.subject_id) {
    const { data } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", lesson.subject_id)
      .maybeSingle();
    if (data?.name) subject = data.name;
  }
  if (lesson.class_id) {
    const { data } = await supabase
      .from("classes")
      .select("name")
      .eq("id", lesson.class_id)
      .maybeSingle();
    if (data?.name) classLevel = data.name;
  }
  return { subject, classLevel };
}

async function handleRegenerateStage(
  supabase: KsiSupabaseClient,
  userId: string,
  body: RegenerateStageBody,
) {
  let runId: string | null = null;
  try {
    const lessonId = requireString(body.lessonId, "Lesson id");
    const stageNumber = Number(body.stageNumber);
    if (
      !Number.isInteger(stageNumber) ||
      stageNumber < 1 ||
      stageNumber > 7
    ) {
      throw new Error("Select a valid HQLS stage to regenerate.");
    }
    const allowedActions: HqlsStageAction[] = [
      "improve",
      "simplify",
      "increase_challenge",
      "make_more_practical",
      "reduce_resource_dependence",
      "regenerate",
    ];
    if (!allowedActions.includes(body.stageAction)) {
      throw new Error("Select a valid stage action.");
    }

    const current = await fetchLessonWithStages(supabase, lessonId);
    await enforceAiRateLimit(
      supabase,
      userId,
      current.lesson.workspace_id,
    );
    const names = await resolveSavedLessonNames(supabase, current.lesson);
    const resources = await loadLinkedResourceContext(supabase, current.lesson);
    const currentLesson = lessonFromRows(current.lesson, current.stages);
    const targetStage = currentLesson.stages[stageNumber - 1];
    const context = lessonContextSummary({
      subject: names.subject,
      classLevel: names.classLevel,
      topic: current.lesson.topic,
      objective: current.lesson.objective,
      ageRange: current.lesson.age_range,
      durationMinutes: current.lesson.duration_minutes,
    });

    runId = await startAiRun(supabase, {
      workspaceId: current.lesson.workspace_id,
      userId,
      engine: "hqls_stage_regeneration",
      engineVersion: HQLS_ENGINE_VERSION,
      promptVersion: HQLS_PROMPT_VERSION,
      provider: "openai",
      model: configuredOpenAIModel(),
      artifactType: "lesson",
      artifactId: lessonId,
      inputSummary: {
        lessonId,
        stageNumber,
        stageAction: body.stageAction,
        resourceCount: resources.rows.length,
      },
    });

    const first = await generateOpenAIJson<unknown>({
      systemInstruction: buildHqlsGenerationSystemInstruction(),
      parts: [
        {
          text: buildStageRegenerationPrompt({
            lesson: currentLesson,
            targetStage,
            action: body.stageAction,
            lessonContext: context,
          }),
        },
        ...resources.parts,
      ],
      responseSchema: HQLS_STAGE_JSON_SCHEMA,
      schemaName: "ksi_hqls_stage",
      maxOutputTokens: 6000,
    });

    let replacement = parseHqlsStageContent(first.data, stageNumber);
    let candidate: GeneratedHqlsLesson = {
      ...currentLesson,
      stages: currentLesson.stages.map((stage) =>
        stage.stageNumber === stageNumber ? replacement : stage,
      ),
    };
    let validation = validateHqlsLesson(candidate);
    let targetViolations = validation.violations.filter(
      (item) => item.stageKey === replacement.stageKey,
    );

    if (targetViolations.length > 0) {
      const repairPrompt = `${buildStageRegenerationPrompt({
        lesson: candidate,
        targetStage: replacement,
        action: "improve",
        lessonContext: context,
      })}\n\nDeterministic fidelity issues that must be repaired:\n${targetViolations
        .map((item) => `- ${item.code}: ${item.message}`)
        .join("\n")}`;
      const repaired = await generateOpenAIJson<unknown>({
        systemInstruction: buildHqlsGenerationSystemInstruction(),
        parts: [{ text: repairPrompt }, ...resources.parts],
        responseSchema: HQLS_STAGE_JSON_SCHEMA,
        schemaName: "ksi_hqls_stage_repair",
        maxOutputTokens: 6000,
      });
      replacement = parseHqlsStageContent(repaired.data, stageNumber);
      candidate = {
        ...currentLesson,
        stages: currentLesson.stages.map((stage) =>
          stage.stageNumber === stageNumber ? replacement : stage,
        ),
      };
      validation = validateHqlsLesson(candidate);
      targetViolations = validation.violations.filter(
        (item) => item.stageKey === replacement.stageKey,
      );
    }

    if (targetViolations.length > 0) {
      await completeAiRun(
        supabase,
        runId,
        "failed",
        "HQLS_STAGE_FIDELITY_FAILED",
      );
      return json(
        {
          error:
            "The regenerated stage still violates HQLS fidelity, so the saved lesson was not changed.",
          code: "HQLS_STAGE_FIDELITY_FAILED",
          validation,
        },
        422,
      );
    }

    const { error: stageError } = await supabase
      .from("lesson_stages")
      .update({
        content: toJson(replacement),
        validation: toJson(
          validation.stageValidation[replacement.stageKey],
        ),
      })
      .eq("lesson_id", lessonId)
      .eq("stage_number", stageNumber)
      .eq("stage_key", replacement.stageKey);
    if (stageError) throw stageError;

    await saveLessonValidation({
      supabase,
      lesson: current.lesson,
      validation,
    });
    await persistFidelityCheck({
      supabase,
      lessonId,
      validation,
    });

    const refreshed = await fetchLessonWithStages(supabase, lessonId);
    await appendArtifactVersion(supabase, {
      workspaceId: current.lesson.workspace_id,
      artifactType: "lesson",
      artifactId: lessonId,
      snapshot: { lesson: refreshed.lesson, stages: refreshed.stages },
      origin: "regeneration",
      engineVersion: HQLS_ENGINE_VERSION,
      promptVersion: HQLS_PROMPT_VERSION,
    });
    await attachAiRunArtifact(supabase, runId, lessonId);
    await completeAiRun(supabase, runId, "succeeded");

    return json({
      lesson: refreshed.lesson,
      stages: refreshed.stages,
      stage: replacement,
      validation,
      sources: resources.labels,
      sourceWarnings: resources.warnings,
      provider: first.provider,
      model: first.model,
    });
  } catch (caught) {
    if (runId) {
      await completeAiRun(
        supabase,
        runId,
        "failed",
        errorCode(caught),
      ).catch(() => undefined);
    }
    throw caught;
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient(request);
    const body = (await request.json()) as HqlsRequestBody;
    if (!body || typeof body !== "object" || !("action" in body)) {
      return json({ error: "A valid HQLS action is required." }, 400);
    }

    if (body.action === "generate") {
      return await handleGenerate(supabase, user.id, body.input);
    }
    if (body.action === "save_edits") {
      return await handleSaveEdits(supabase, user.id, body);
    }
    if (body.action === "regenerate_stage") {
      return await handleRegenerateStage(supabase, user.id, body);
    }
    return json({ error: "Unsupported HQLS action." }, 400);
  } catch (caught) {
    const message = errorMessage(caught);
    const status = /session|authentication/i.test(message)
      ? 401
      : errorStatus(caught);
    return json({ error: message, code: errorCode(caught) }, status);
  }
}
