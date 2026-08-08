import { createClient } from "@supabase/supabase-js";

import {
  DIAGNOSIS_ENGINE_VERSION,
  DIAGNOSIS_JSON_SCHEMA,
  DIAGNOSIS_PROMPT_VERSION,
  buildDiagnosisPrompt,
  buildDiagnosisRepairPrompt,
  buildDiagnosisSystemInstruction,
  parseGeneratedDiagnosis,
  validateDiagnosis,
  type DiagnosisDomain,
  type DiagnosisEvidencePacket,
  type GeneratedDiagnosis,
} from "@/lib/diagnosis/engine";
import { generateOpenAIJson, OpenAIProviderError } from "@/lib/ai/openai";
import { completeAiRun, startAiRun } from "@/lib/data/ai-runs";
import { appendArtifactVersion } from "@/lib/data/artifact-version";
import {
  createDiagnosisDraft,
  finaliseDiagnosis,
  reviewDiagnosis,
} from "@/lib/data/diagnoses";
import { recordStudentEvidence } from "@/lib/data/evidence";
import { DIAGNOSIS_MODES, type DiagnosisMode } from "@/lib/domain/diagnosis";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database, KsiSupabaseClient } from "@/lib/supabase/database";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const AI_RUNS_PER_MINUTE = 6;
const MAX_OBSERVATIONS = 12;
const MAX_ITEM_RESULTS = 60;

type EvidenceRow = Database["public"]["Tables"]["student_evidence"]["Row"];
type DiagnosisRow = Database["public"]["Tables"]["diagnoses"]["Row"];
type AssessmentItemRow = Database["public"]["Tables"]["assessment_items"]["Row"];

type ObservationInput = {
  domain: DiagnosisDomain;
  statement: string;
};

type ItemResultInput = {
  assessmentItemId: string;
  awardedMarks: number;
  note: string;
};

type GenerateInput = {
  workspaceId: string;
  studentId: string;
  mode: DiagnosisMode;
  assessmentId: string | null;
  score: { earnedMarks: number; totalMarks: number } | null;
  itemResults: ItemResultInput[];
  observations: ObservationInput[];
};

type GenerateBody = { action: "generate"; input: unknown };
type SaveBody = { action: "save_edits"; diagnosisId: string; diagnosis: unknown };
type LifecycleBody = { action: "review" | "approve"; diagnosisId: string };
type DiagnosisBody = GenerateBody | SaveBody | LifecycleBody;

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(value: unknown, label: string) {
  const result = text(value);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function number(value: unknown, label: string, min = 0) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min) {
    throw new Error(`${label} must be a valid number of at least ${min}.`);
  }
  return result;
}

function configuredOpenAIModel() {
  return (
    process.env.KSI_OPENAI_MODEL?.trim() ||
    process.env.KSI_AI_MODEL?.trim() ||
    "gpt-5-mini"
  );
}

function errorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  const row = record(caught);
  if (row && typeof row.message === "string") return row.message;
  return "The diagnosis request could not be completed.";
}

function errorCode(caught: unknown) {
  if (caught instanceof OpenAIProviderError) return caught.code;
  const row = record(caught);
  if (row && typeof row.code === "string") return `DIAGNOSIS_DB_${row.code}`;
  return "DIAGNOSIS_REQUEST_FAILED";
}

function errorStatus(caught: unknown) {
  if (caught instanceof OpenAIProviderError) {
    if (caught.code === "AI_PROVIDER_NOT_CONFIGURED") return 503;
    if (caught.code === "DIAGNOSIS_RATE_LIMIT" || caught.code.includes("429")) return 429;
    return 502;
  }
  return record(caught)?.code ? 500 : 400;
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
  if (error || !user) throw new Error("Your session is no longer valid. Sign in again and retry.");
  return { supabase, user };
}

async function workspaceContext(supabase: KsiSupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) throw new Error("Choose an active workspace before using Diagnosis Intelligence.");

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (workspaceResult.error || !workspaceResult.data) throw workspaceResult.error ?? new Error("Workspace unavailable.");
  if (membershipResult.error) throw membershipResult.error;
  if (membershipResult.data?.status !== "active") throw new Error("Your workspace membership is not active.");

  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role,
    canApprove: membershipResult.data.role === "owner" || membershipResult.data.role === "admin",
  };
}

async function enforceRateLimit(supabase: KsiSupabaseClient, userId: string, workspaceId: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("initiated_by", userId)
    .gte("started_at", since);
  if (error) throw error;
  if ((count ?? 0) >= AI_RUNS_PER_MINUTE) {
    throw new OpenAIProviderError("DIAGNOSIS_RATE_LIMIT", "You have generated several diagnoses very quickly. Wait about a minute and try again.");
  }
}

function parseGenerateInput(value: unknown): GenerateInput {
  const input = record(value);
  if (!input) throw new Error("Diagnosis context is required.");
  const mode = requiredText(input.mode, "Diagnosis mode") as DiagnosisMode;
  if (!DIAGNOSIS_MODES.includes(mode)) throw new Error("Select a valid diagnosis mode.");

  const observations = Array.isArray(input.observations)
    ? input.observations.map((entry, index) => {
        const row = record(entry);
        if (!row) throw new Error(`Observation ${index + 1} is invalid.`);
        const domain = requiredText(row.domain, `Observation ${index + 1} domain`) as DiagnosisDomain;
        if (!(["academic", "skill", "character"] as string[]).includes(domain)) {
          throw new Error(`Observation ${index + 1} has an invalid domain.`);
        }
        const statement = requiredText(row.statement, `Observation ${index + 1}`);
        if (statement.length < 12) throw new Error(`Observation ${index + 1} must describe a factual observation in enough detail.`);
        return { domain, statement };
      })
    : [];
  if (observations.length > MAX_OBSERVATIONS) throw new Error(`Use no more than ${MAX_OBSERVATIONS} teacher observations per diagnosis.`);

  const itemResults = Array.isArray(input.itemResults)
    ? input.itemResults.map((entry, index) => {
        const row = record(entry);
        if (!row) throw new Error(`Item result ${index + 1} is invalid.`);
        return {
          assessmentItemId: requiredText(row.assessmentItemId, `Item result ${index + 1}`),
          awardedMarks: number(row.awardedMarks, `Item result ${index + 1} awarded marks`),
          note: text(row.note),
        };
      })
    : [];
  if (itemResults.length > MAX_ITEM_RESULTS) throw new Error(`Use no more than ${MAX_ITEM_RESULTS} item results per diagnosis.`);

  let score: GenerateInput["score"] = null;
  if (input.score !== null && input.score !== undefined) {
    const row = record(input.score);
    if (!row) throw new Error("Assessment score is invalid.");
    const earnedMarks = number(row.earnedMarks, "Earned marks");
    const totalMarks = number(row.totalMarks, "Total marks", 0.01);
    if (earnedMarks > totalMarks) throw new Error("Earned marks cannot exceed total marks.");
    score = { earnedMarks, totalMarks };
  }

  const assessmentId = text(input.assessmentId) || null;
  if (mode === "quick_teacher" && observations.length < 2) {
    throw new Error("Quick Teacher Diagnosis needs at least two factual teacher observations.");
  }
  if (mode === "assessment_based" && !assessmentId) throw new Error("Assessment-Based Diagnosis requires a saved assessment.");
  if (mode === "assessment_based" && !score && !itemResults.length) throw new Error("Assessment-Based Diagnosis needs an overall score or item-level evidence.");
  if (mode === "combined" && (!assessmentId || (!score && !itemResults.length) || observations.length < 1)) {
    throw new Error("Combined Diagnosis requires assessment evidence plus at least one factual teacher observation.");
  }

  return {
    workspaceId: requiredText(input.workspaceId, "Workspace"),
    studentId: requiredText(input.studentId, "Student"),
    mode,
    assessmentId,
    score,
    itemResults,
    observations,
  };
}

async function loadStudent(supabase: KsiSupabaseClient, workspaceId: string, studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id,display_name,class_id,active")
    .eq("workspace_id", workspaceId)
    .eq("id", studentId)
    .single();
  if (error || !data || !data.active) throw new Error("The selected student is not active in this workspace.");
  let className = "Class not linked";
  if (data.class_id) {
    const { data: classRow } = await supabase.from("classes").select("name").eq("workspace_id", workspaceId).eq("id", data.class_id).maybeSingle();
    if (classRow?.name) className = classRow.name;
  }
  return { ...data, className };
}

async function loadAssessment(
  supabase: KsiSupabaseClient,
  workspaceId: string,
  assessmentId: string | null,
) {
  if (!assessmentId) return { assessment: null, items: [] as AssessmentItemRow[] };
  const assessmentResult = await supabase
    .from("assessments")
    .select("id,title,status,blueprint")
    .eq("workspace_id", workspaceId)
    .eq("id", assessmentId)
    .single();
  if (assessmentResult.error || !assessmentResult.data) throw new Error("The selected assessment is unavailable in this workspace.");
  if (assessmentResult.data.status === "archived") throw new Error("Archived assessments cannot be used for a new diagnosis.");
  const itemResult = await supabase
    .from("assessment_items")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("position");
  if (itemResult.error) throw itemResult.error;
  return { assessment: assessmentResult.data, items: (itemResult.data ?? []) as AssessmentItemRow[] };
}

function itemDomain(item: AssessmentItemRow): DiagnosisDomain {
  return item.item_type === "critical_thinking" || item.item_type === "project" ? "skill" : "academic";
}

async function captureEvidence(args: {
  supabase: KsiSupabaseClient;
  userId: string;
  input: GenerateInput;
  assessment: Awaited<ReturnType<typeof loadAssessment>>;
}) {
  const entries: Parameters<typeof recordStudentEvidence>[1] extends (infer U)[] ? U[] : never = [];
  const { input, assessment, userId } = args;

  if (input.score && assessment.assessment) {
    const percentage = Math.round((input.score.earnedMarks / input.score.totalMarks) * 1000) / 10;
    entries.push({
      workspaceId: input.workspaceId,
      studentId: input.studentId,
      recordedBy: userId,
      evidenceType: "score",
      assessmentId: assessment.assessment.id,
      numericValue: percentage,
      content: {
        domain: "academic",
        statement: `Overall assessment result: ${input.score.earnedMarks}/${input.score.totalMarks} marks (${percentage}%).`,
        metric: `${percentage}%`,
        earnedMarks: input.score.earnedMarks,
        totalMarks: input.score.totalMarks,
        assessmentTitle: assessment.assessment.title,
      },
    });
  }

  for (const result of input.itemResults) {
    const item = assessment.items.find((candidate) => candidate.id === result.assessmentItemId);
    if (!item) throw new Error("One or more item results do not belong to the selected assessment.");
    const maxMarks = Number(item.marks ?? 0);
    if (result.awardedMarks > maxMarks) throw new Error(`Awarded marks for item ${item.position} cannot exceed ${maxMarks}.`);
    const content = record(item.content) ?? {};
    const prompt = typeof content.prompt === "string" ? content.prompt : `Assessment item ${item.position}`;
    const statement = `Assessment item ${item.position}: awarded ${result.awardedMarks}/${maxMarks} marks on ${item.topic || "the assessed topic"}. ${result.note || "No additional teacher note."}`;
    entries.push({
      workspaceId: input.workspaceId,
      studentId: input.studentId,
      recordedBy: userId,
      evidenceType: "item_result",
      assessmentId: assessment.assessment?.id ?? null,
      assessmentItemId: item.id,
      numericValue: result.awardedMarks,
      content: {
        domain: itemDomain(item),
        statement,
        metric: `${result.awardedMarks}/${maxMarks} marks`,
        maxMarks,
        position: item.position,
        topic: item.topic,
        objective: item.objective,
        prompt,
        note: result.note,
      },
    });
  }

  for (const observation of input.observations) {
    entries.push({
      workspaceId: input.workspaceId,
      studentId: input.studentId,
      recordedBy: userId,
      evidenceType: "observation",
      assessmentId: input.assessmentId,
      numericValue: null,
      content: {
        domain: observation.domain,
        statement: observation.statement,
        metric: "Teacher observation",
      },
    });
  }

  const rows = await recordStudentEvidence(args.supabase, entries);
  return rows as EvidenceRow[];
}

function evidencePacket(row: EvidenceRow): DiagnosisEvidencePacket {
  const content = record(row.content) ?? {};
  const requestedDomain = text(content.domain) as DiagnosisDomain;
  const domain: DiagnosisDomain = (["academic", "skill", "character"] as string[]).includes(requestedDomain)
    ? requestedDomain
    : row.evidence_type === "observation"
      ? "character"
      : "academic";
  const source = row.evidence_type === "score"
    ? "assessment_score"
    : row.evidence_type === "item_result"
      ? "assessment_item"
      : row.evidence_type === "reflection"
        ? "reflection"
        : "teacher_observation";
  return {
    id: row.id,
    source,
    domain,
    statement: text(content.statement) || `Recorded ${row.evidence_type} evidence.`,
    metric: text(content.metric),
  };
}

async function evidenceForDiagnosis(supabase: KsiSupabaseClient, diagnosis: DiagnosisRow) {
  const observed = Array.isArray(diagnosis.observed_evidence) ? diagnosis.observed_evidence : [];
  const ids = observed
    .map((item) => record(item)?.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));
  if (!ids.length) throw new Error("This diagnosis has no traceable evidence records.");
  const { data, error } = await supabase
    .from("student_evidence")
    .select("*")
    .eq("workspace_id", diagnosis.workspace_id)
    .eq("student_id", diagnosis.student_id)
    .in("id", ids);
  if (error) throw error;
  if ((data ?? []).length !== ids.length) throw new Error("One or more diagnosis evidence records are no longer available.");
  const packets = new Map((data ?? []).map((row) => [row.id, evidencePacket(row as EvidenceRow)]));
  return ids.map((id) => packets.get(id)).filter((item): item is DiagnosisEvidencePacket => Boolean(item));
}

async function attachAiRun(supabase: KsiSupabaseClient, runId: string, diagnosisId: string) {
  const { error } = await supabase
    .from("ai_runs")
    .update({ artifact_id: diagnosisId, artifact_type: "diagnosis" })
    .eq("id", runId);
  if (error) throw error;
}

function diagnosisToPersistence(diagnosis: GeneratedDiagnosis) {
  return {
    observedEvidence: diagnosis.observedEvidence,
    detectedPatterns: diagnosis.detectedPatterns,
    possibleInterpretations: diagnosis.possibleInterpretations,
    academicStrengths: diagnosis.academicSkillStrengths,
    academicChallenges: diagnosis.academicSkillChallenges,
    characterStrengths: diagnosis.characterStrengths,
    characterChallenges: diagnosis.characterChallenges,
    schoolAcademicActions: diagnosis.schoolAcademicActions,
    parentAcademicActions: diagnosis.parentAcademicActions,
    schoolCharacterActions: diagnosis.schoolCharacterActions,
    parentCharacterActions: diagnosis.parentCharacterActions,
    builderGrowthDirection: diagnosis.builderGrowthDirection,
    encouragementNote: diagnosis.encouragementNote,
    evidenceLimitations: diagnosis.evidenceLimitations,
  };
}

function diagnosisFromRow(row: DiagnosisRow): GeneratedDiagnosis {
  return parseGeneratedDiagnosis({
    observedEvidence: row.observed_evidence,
    detectedPatterns: row.detected_patterns,
    possibleInterpretations: row.possible_interpretations,
    academicSkillStrengths: row.academic_strengths,
    academicSkillChallenges: row.academic_challenges,
    characterStrengths: row.character_strengths,
    characterChallenges: row.character_challenges,
    conciseDiagnosis: (() => {
      const interpretations = Array.isArray(row.possible_interpretations) ? row.possible_interpretations : [];
      const first = record(interpretations[0]);
      return typeof first?.summary === "string" ? first.summary : typeof first?.statement === "string" ? first.statement : "The current evidence has been reviewed and translated into the actions below.";
    })(),
    schoolAcademicActions: row.school_academic_actions,
    parentAcademicActions: row.parent_academic_actions,
    schoolCharacterActions: row.school_character_actions,
    parentCharacterActions: row.parent_character_actions,
    builderGrowthDirection: row.builder_growth_direction ?? "",
    encouragementNote: row.encouragement_note ?? "",
    evidenceLimitations: row.evidence_limitations,
  });
}

async function handleGenerate(supabase: KsiSupabaseClient, userId: string, raw: unknown) {
  let runId: string | null = null;
  try {
    const input = parseGenerateInput(raw);
    const workspace = await workspaceContext(supabase, userId);
    if (workspace.workspaceId !== input.workspaceId) throw new Error("The requested workspace is not your active workspace.");
    await enforceRateLimit(supabase, userId, input.workspaceId);
    const student = await loadStudent(supabase, input.workspaceId, input.studentId);
    const assessment = await loadAssessment(supabase, input.workspaceId, input.assessmentId);
    const evidenceRows = await captureEvidence({ supabase, userId, input, assessment });
    const evidence = evidenceRows.map(evidencePacket);

    runId = await startAiRun(supabase, {
      workspaceId: input.workspaceId,
      userId,
      engine: "student_diagnosis",
      engineVersion: DIAGNOSIS_ENGINE_VERSION,
      promptVersion: DIAGNOSIS_PROMPT_VERSION,
      provider: "openai",
      model: configuredOpenAIModel(),
      artifactType: "diagnosis",
      inputSummary: {
        studentId: input.studentId,
        diagnosisMode: input.mode,
        assessmentId: input.assessmentId,
        evidenceCount: evidence.length,
        evidenceTypes: [...new Set(evidence.map((item) => item.source))],
      },
    });

    const context = {
      studentName: student.display_name,
      className: student.className,
      mode: input.mode,
      assessmentTitle: assessment.assessment?.title ?? "",
      evidence,
    };
    const generatedResult = await generateOpenAIJson<unknown>({
      systemInstruction: buildDiagnosisSystemInstruction(),
      parts: [{ text: buildDiagnosisPrompt(context) }],
      responseSchema: DIAGNOSIS_JSON_SCHEMA,
      schemaName: "ksi_student_diagnosis",
      maxOutputTokens: 10000,
    });
    let diagnosis = parseGeneratedDiagnosis(generatedResult.data);
    let validation = validateDiagnosis(diagnosis, evidence);

    if (!validation.passed) {
      const repairedResult = await generateOpenAIJson<unknown>({
        systemInstruction: buildDiagnosisSystemInstruction(),
        parts: [{ text: buildDiagnosisRepairPrompt(context, diagnosis, validation) }],
        responseSchema: DIAGNOSIS_JSON_SCHEMA,
        schemaName: "ksi_student_diagnosis_repair",
        maxOutputTokens: 10000,
      });
      diagnosis = parseGeneratedDiagnosis(repairedResult.data);
      validation = validateDiagnosis(diagnosis, evidence);
    }

    if (!validation.passed) {
      await completeAiRun(supabase, runId, "failed", "DIAGNOSIS_VALIDATION_FAILED");
      return json({
        error: "The generated diagnosis did not pass KAEC evidence-and-uncertainty validation after repair, so it was not saved.",
        code: "DIAGNOSIS_VALIDATION_FAILED",
        validation,
        evidenceRecorded: evidence.length,
      }, 422);
    }

    const persistedFields = diagnosisToPersistence(diagnosis);
    const persisted = await createDiagnosisDraft(supabase, {
      workspaceId: input.workspaceId,
      studentId: input.studentId,
      userId,
      mode: input.mode,
      assessmentId: input.assessmentId,
      ...persistedFields,
      possibleInterpretations: diagnosis.possibleInterpretations.map((item, index) => ({
        ...item,
        ...(index === 0 ? { summary: diagnosis.conciseDiagnosis } : {}),
      })),
      engineVersion: DIAGNOSIS_ENGINE_VERSION,
      promptVersion: DIAGNOSIS_PROMPT_VERSION,
    });
    await attachAiRun(supabase, runId, persisted.id);
    await completeAiRun(supabase, runId, "succeeded");

    return json({
      diagnosis: persisted,
      generated: diagnosis,
      validation,
      student: { id: student.id, name: student.display_name, className: student.className },
      assessment: assessment.assessment ? { id: assessment.assessment.id, title: assessment.assessment.title } : null,
      evidence,
      provider: generatedResult.provider,
      model: generatedResult.model,
    });
  } catch (caught) {
    if (runId) await completeAiRun(supabase, runId, "failed", errorCode(caught)).catch(() => undefined);
    throw caught;
  }
}

async function handleSaveEdits(supabase: KsiSupabaseClient, userId: string, body: SaveBody) {
  const diagnosisId = requiredText(body.diagnosisId, "Diagnosis id");
  const { data: current, error } = await supabase.from("diagnoses").select("*").eq("id", diagnosisId).single();
  if (error || !current) throw error ?? new Error("Diagnosis not found.");
  if (current.status === "final") throw new Error("Final diagnoses are immutable. Create a new diagnosis if the evidence changes.");
  const suppliedEvidence = await evidenceForDiagnosis(supabase, current as DiagnosisRow);
  const edited = parseGeneratedDiagnosis(body.diagnosis);
  edited.observedEvidence = suppliedEvidence;
  const validation = validateDiagnosis(edited, suppliedEvidence);
  if (!validation.passed) return json({ error: "Edited diagnosis does not pass KAEC diagnosis validation.", validation }, 422);

  const fields = diagnosisToPersistence(edited);
  const { data: saved, error: updateError } = await supabase
    .from("diagnoses")
    .update({
      observed_evidence: fields.observedEvidence as unknown as Json,
      detected_patterns: fields.detectedPatterns as unknown as Json,
      possible_interpretations: edited.possibleInterpretations.map((item, index) => ({
        ...item,
        ...(index === 0 ? { summary: edited.conciseDiagnosis } : {}),
      })) as unknown as Json,
      academic_strengths: fields.academicStrengths as unknown as Json,
      academic_challenges: fields.academicChallenges as unknown as Json,
      character_strengths: fields.characterStrengths as unknown as Json,
      character_challenges: fields.characterChallenges as unknown as Json,
      school_academic_actions: fields.schoolAcademicActions as unknown as Json,
      parent_academic_actions: fields.parentAcademicActions as unknown as Json,
      school_character_actions: fields.schoolCharacterActions as unknown as Json,
      parent_character_actions: fields.parentCharacterActions as unknown as Json,
      builder_growth_direction: fields.builderGrowthDirection,
      encouragement_note: fields.encouragementNote,
      evidence_limitations: fields.evidenceLimitations as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", diagnosisId)
    .select("*")
    .single();
  if (updateError || !saved) throw updateError ?? new Error("Diagnosis could not be saved.");

  await appendArtifactVersion(supabase, {
    workspaceId: saved.workspace_id,
    artifactType: "diagnosis",
    artifactId: saved.id,
    snapshot: { diagnosis: saved },
    origin: "manual_edit",
    engineVersion: saved.engine_version,
    promptVersion: saved.prompt_version,
  });

  return json({ diagnosis: saved, generated: diagnosisFromRow(saved as DiagnosisRow), validation });
}

async function handleLifecycle(supabase: KsiSupabaseClient, body: LifecycleBody) {
  const diagnosisId = requiredText(body.diagnosisId, "Diagnosis id");
  const diagnosis = body.action === "review"
    ? await reviewDiagnosis(supabase, diagnosisId)
    : await finaliseDiagnosis(supabase, diagnosisId);
  return json({ diagnosis, generated: diagnosisFromRow(diagnosis as DiagnosisRow) });
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient(request);
    const workspace = await workspaceContext(supabase, user.id);
    const [studentsResult, classesResult, assessmentsResult, itemsResult, diagnosesResult] = await Promise.all([
      supabase.from("students").select("id,display_name,class_id,active").eq("workspace_id", workspace.workspaceId).eq("active", true).order("display_name"),
      supabase.from("classes").select("id,name").eq("workspace_id", workspace.workspaceId).eq("active", true).order("name"),
      supabase.from("assessments").select("id,title,status,assessment_mode,blueprint,updated_at").eq("workspace_id", workspace.workspaceId).order("updated_at", { ascending: false }),
      supabase.from("assessment_items").select("id,assessment_id,position,item_type,topic,objective,difficulty,marks,content").order("position"),
      supabase.from("diagnoses").select("*").eq("workspace_id", workspace.workspaceId).order("updated_at", { ascending: false }),
    ]);
    const firstError = studentsResult.error ?? classesResult.error ?? assessmentsResult.error ?? itemsResult.error ?? diagnosesResult.error;
    if (firstError) throw firstError;

    const classMap = new Map((classesResult.data ?? []).map((row) => [row.id, row.name]));
    const assessments = (assessmentsResult.data ?? []).map((assessment) => ({
      ...assessment,
      items: (itemsResult.data ?? []).filter((item) => item.assessment_id === assessment.id),
    }));
    const diagnoses = (diagnosesResult.data ?? []).map((diagnosis) => ({
      row: diagnosis,
      generated: diagnosisFromRow(diagnosis as DiagnosisRow),
    }));

    return json({
      workspace: { id: workspace.workspaceId, name: workspace.workspaceName, role: workspace.role, canApprove: workspace.canApprove },
      students: (studentsResult.data ?? []).map((student) => ({
        id: student.id,
        name: student.display_name,
        classId: student.class_id,
        className: student.class_id ? classMap.get(student.class_id) ?? "Class not linked" : "Class not linked",
      })),
      assessments,
      diagnoses,
      modelPolicy: "gpt-5-mini",
    });
  } catch (caught) {
    const message = errorMessage(caught);
    return json({ error: message, code: errorCode(caught) }, /session|authentication/i.test(message) ? 401 : errorStatus(caught));
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient(request);
    const body = (await request.json()) as DiagnosisBody;
    if (!body || typeof body !== "object" || !("action" in body)) throw new Error("A valid diagnosis action is required.");
    if (body.action === "generate") return await handleGenerate(supabase, user.id, body.input);
    if (body.action === "save_edits") return await handleSaveEdits(supabase, user.id, body);
    if (body.action === "review" || body.action === "approve") return await handleLifecycle(supabase, body);
    throw new Error("Unsupported diagnosis action.");
  } catch (caught) {
    const message = errorMessage(caught);
    return json({ error: message, code: errorCode(caught) }, /session|authentication/i.test(message) ? 401 : errorStatus(caught));
  }
}
