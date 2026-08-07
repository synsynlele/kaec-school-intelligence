import type { SupabaseClient } from "@supabase/supabase-js";

import { appendArtifactVersion } from "@/lib/data/artifact-version";
import type { DiagnosisMode } from "@/lib/domain/diagnosis";

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

export async function createDiagnosisDraft(
  supabase: SupabaseClient,
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
      observed_evidence: input.observedEvidence ?? [],
      detected_patterns: input.detectedPatterns ?? [],
      possible_interpretations: input.possibleInterpretations ?? [],
      academic_strengths: input.academicStrengths ?? [],
      academic_challenges: input.academicChallenges ?? [],
      character_strengths: input.characterStrengths ?? [],
      character_challenges: input.characterChallenges ?? [],
      school_academic_actions: input.schoolAcademicActions ?? [],
      parent_academic_actions: input.parentAcademicActions ?? [],
      school_character_actions: input.schoolCharacterActions ?? [],
      parent_character_actions: input.parentCharacterActions ?? [],
      builder_growth_direction: input.builderGrowthDirection ?? null,
      encouragement_note: input.encouragementNote ?? null,
      evidence_limitations: input.evidenceLimitations ?? [],
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
