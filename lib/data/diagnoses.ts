import { appendArtifactVersion } from "@/lib/data/artifact-version";
import type { DiagnosisMode } from "@/lib/domain/diagnosis";
import type { KsiSupabaseClient } from "@/lib/supabase/database";
import type { Json } from "@/lib/supabase/database.types";

export type CreateDiagnosisInput = {
  workspaceId: string;
  studentId: string;
  userId: string;
  mode: DiagnosisMode;
  assessmentId?: string | null;
  observedEvidence?: unknown[];
  detectedPatterns?: unknown[];
  possibleInterpretations?: unknown[];
  academicStrengths?: unknown[];
  academicChallenges?: unknown[];
  characterStrengths?: unknown[];
  characterChallenges?: unknown[];
  conciseDiagnosis?: string;
  schoolAcademicActions?: unknown[];
  parentAcademicActions?: unknown[];
  schoolCharacterActions?: unknown[];
  parentCharacterActions?: unknown[];
  builderGrowthDirection?: string | null;
  encouragementNote?: string | null;
  evidenceLimitations?: unknown[];
  engineVersion?: string | null;
  promptVersion?: string | null;
};

function toJson(value: unknown): Json {
  return value as Json;
}

export async function createDiagnosisDraft(
  supabase: KsiSupabaseClient,
  input: CreateDiagnosisInput,
) {
  const { data: diagnosis, error } = await supabase
    .from("diagnoses")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      created_by: input.userId,
      assessment_id: input.assessmentId ?? null,
      diagnosis_mode: input.mode,
      status: "draft",
      observed_evidence: toJson(input.observedEvidence ?? []),
      detected_patterns: toJson(input.detectedPatterns ?? []),
      possible_interpretations: toJson(input.possibleInterpretations ?? []),
      academic_strengths: toJson(input.academicStrengths ?? []),
      academic_challenges: toJson(input.academicChallenges ?? []),
      character_strengths: toJson(input.characterStrengths ?? []),
      character_challenges: toJson(input.characterChallenges ?? []),
      concise_diagnosis: input.conciseDiagnosis ?? "",
      school_academic_actions: toJson(input.schoolAcademicActions ?? []),
      parent_academic_actions: toJson(input.parentAcademicActions ?? []),
      school_character_actions: toJson(input.schoolCharacterActions ?? []),
      parent_character_actions: toJson(input.parentCharacterActions ?? []),
      builder_growth_direction: input.builderGrowthDirection ?? null,
      encouragement_note: input.encouragementNote ?? null,
      evidence_limitations: toJson(input.evidenceLimitations ?? []),
      engine_version: input.engineVersion ?? null,
      prompt_version: input.promptVersion ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  try {
    await appendArtifactVersion(supabase, {
      workspaceId: input.workspaceId,
      artifactType: "diagnosis",
      artifactId: diagnosis.id,
      snapshot: { diagnosis },
      origin: input.engineVersion ? "generated" : "manual_edit",
      engineVersion: input.engineVersion,
      promptVersion: input.promptVersion,
    });

    return diagnosis;
  } catch (caught) {
    await supabase.from("diagnoses").delete().eq("id", diagnosis.id);
    throw caught;
  }
}

export async function reviewDiagnosis(
  supabase: KsiSupabaseClient,
  diagnosisId: string,
) {
  const { data: diagnosis, error } = await supabase.rpc("review_diagnosis", {
    target_diagnosis_id: diagnosisId,
  });

  if (error) throw error;

  await appendArtifactVersion(supabase, {
    workspaceId: diagnosis.workspace_id,
    artifactType: "diagnosis",
    artifactId: diagnosis.id,
    snapshot: { diagnosis },
    origin: "review",
    engineVersion: diagnosis.engine_version,
    promptVersion: diagnosis.prompt_version,
  });

  return diagnosis;
}

export async function finaliseDiagnosis(
  supabase: KsiSupabaseClient,
  diagnosisId: string,
) {
  const { data: diagnosis, error } = await supabase.rpc("finalise_diagnosis", {
    target_diagnosis_id: diagnosisId,
  });

  if (error) throw error;

  await appendArtifactVersion(supabase, {
    workspaceId: diagnosis.workspace_id,
    artifactType: "diagnosis",
    artifactId: diagnosis.id,
    snapshot: { diagnosis },
    origin: "finalisation",
    engineVersion: diagnosis.engine_version,
    promptVersion: diagnosis.prompt_version,
  });

  return diagnosis;
}
