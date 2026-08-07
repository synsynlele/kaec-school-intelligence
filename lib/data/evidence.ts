import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceType =
  | "score"
  | "item_result"
  | "observation"
  | "reflection";

export type StudentEvidenceInput = {
  workspaceId: string;
  studentId: string;
  recordedBy: string;
  evidenceType: EvidenceType;
  assessmentId?: string | null;
  assessmentItemId?: string | null;
  numericValue?: number | null;
  content?: Record<string, unknown>;
  recordedAt?: string;
};

export async function recordStudentEvidence(
  supabase: SupabaseClient,
  input: StudentEvidenceInput | StudentEvidenceInput[],
) {
  const entries = Array.isArray(input) ? input : [input];

  if (!entries.length) {
    throw new Error("At least one evidence record is required.");
  }

  const { data, error } = await supabase
    .from("student_evidence")
    .insert(
      entries.map((entry) => ({
        workspace_id: entry.workspaceId,
        student_id: entry.studentId,
        recorded_by: entry.recordedBy,
        evidence_type: entry.evidenceType,
        assessment_id: entry.assessmentId ?? null,
        assessment_item_id: entry.assessmentItemId ?? null,
        numeric_value: entry.numericValue ?? null,
        content: entry.content ?? {},
        recorded_at: entry.recordedAt ?? new Date().toISOString(),
      })),
    )
    .select("*");

  if (error) throw error;
  return data;
}
