import type { SupabaseClient } from "@supabase/supabase-js";

import type { AssessmentItemType, DiagnosisMode } from "@/lib/domain";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export type ArtifactType = "lesson" | "assessment" | "diagnosis";
export type ArtifactVersionOrigin =
  | "generated"
  | "manual_edit"
  | "regeneration"
  | "review"
  | "finalisation";

export type CreateLessonDraftInput = {
  workspaceId: string;
  title: string;
  topic: string;
  objective: string;
  ageRange?: string | null;
  durationMinutes?: number | null;
  classId?: string | null;
  subjectId?: string | null;
  sourceContext?: JsonValue[];
};

export type CreateAssessmentDraftInput = {
  workspaceId: string;
  createdBy: string;
  title: string;
  assessmentMode:
    | AssessmentItemType
    | "mixed";
  sourceLessonId?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  blueprint?: JsonValue;
  sourceContext?: JsonValue[];
};

export type CreateDiagnosisDraftInput = {
  workspaceId: string;
  createdBy: string;
  studentId: string;
  diagnosisMode: DiagnosisMode;
  assessmentId?: string | null;
};

export type RecordStudentEvidenceInput = {
  workspaceId: string;
  studentId: string;
  recordedBy: string;
  evidenceType: "score" | "item_result" | "observation" | "reflection";
  assessmentId?: string | null;
  assessmentItemId?: string | null;
  numericValue?: number | null;
  content?: JsonValue;
};

export async function createHqlsLessonDraft(
  client: SupabaseClient,
  input: CreateLessonDraftInput,
): Promise<string> {
  const { data, error } = await client.rpc("create_hqls_lesson_draft", {
    target_workspace_id: input.workspaceId,
    target_title: input.title,
    target_topic: input.topic,
    target_objective: input.objective,
    target_age_range: input.ageRange ?? null,
    target_duration_minutes: input.durationMinutes ?? null,
    target_class_id: input.classId ?? null,
    target_subject_id: input.subjectId ?? null,
    target_source_context: input.sourceContext ?? [],
  });

  if (error) throw error;
  if (typeof data !== "string") {
    throw new Error("HQLS lesson draft did not return a lesson id.");
  }

  return data;
}

export async function createAssessmentDraft(
  client: SupabaseClient,
  input: CreateAssessmentDraftInput,
): Promise<string> {
  const { data, error } = await client
    .from("assessments")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      source_lesson_id: input.sourceLessonId ?? null,
      class_id: input.classId ?? null,
      subject_id: input.subjectId ?? null,
      title: input.title.trim(),
      assessment_mode: input.assessmentMode,
      status: "draft",
      blueprint: input.blueprint ?? {},
      source_context: input.sourceContext ?? [],
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Assessment draft did not return an id.");
  return data.id as string;
}

export async function createDiagnosisDraft(
  client: SupabaseClient,
  input: CreateDiagnosisDraftInput,
): Promise<string> {
  const { data, error } = await client
    .from("diagnoses")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      created_by: input.createdBy,
      assessment_id: input.assessmentId ?? null,
      diagnosis_mode: input.diagnosisMode,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Diagnosis draft did not return an id.");
  return data.id as string;
}

export async function recordStudentEvidence(
  client: SupabaseClient,
  input: RecordStudentEvidenceInput,
): Promise<string> {
  const { data, error } = await client
    .from("student_evidence")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      assessment_id: input.assessmentId ?? null,
      assessment_item_id: input.assessmentItemId ?? null,
      evidence_type: input.evidenceType,
      numeric_value: input.numericValue ?? null,
      content: input.content ?? {},
      recorded_by: input.recordedBy,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Student evidence did not return an id.");
  return data.id as string;
}

export async function appendArtifactVersion(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    artifactType: ArtifactType;
    artifactId: string;
    snapshot: JsonValue;
    origin: ArtifactVersionOrigin;
    engineVersion?: string | null;
    promptVersion?: string | null;
  },
): Promise<string> {
  const { data, error } = await client.rpc("append_artifact_version", {
    target_workspace_id: input.workspaceId,
    target_artifact_type: input.artifactType,
    target_artifact_id: input.artifactId,
    target_snapshot: input.snapshot,
    target_origin: input.origin,
    target_engine_version: input.engineVersion ?? null,
    target_prompt_version: input.promptVersion ?? null,
  });

  if (error) throw error;
  if (typeof data !== "string") {
    throw new Error("Artifact version append did not return a version id.");
  }
  return data;
}
