export const DIAGNOSIS_MODES = [
  "quick_teacher",
  "assessment_based",
  "combined",
] as const;

export type DiagnosisMode = (typeof DIAGNOSIS_MODES)[number];

export const DIAGNOSIS_STATUSES = [
  "draft",
  "reviewed",
  "final",
  "archived",
] as const;

export type DiagnosisStatus = (typeof DIAGNOSIS_STATUSES)[number];

export const DIAGNOSIS_EVIDENCE_LAYERS = [
  "observed_evidence",
  "detected_pattern",
  "possible_interpretation",
  "recommended_action",
  "insufficient_evidence",
] as const;

export type DiagnosisEvidenceLayer =
  (typeof DIAGNOSIS_EVIDENCE_LAYERS)[number];

export type DiagnosisFinding = {
  layer: DiagnosisEvidenceLayer;
  statement: string;
  evidenceIds?: string[];
  confidence?: "low" | "medium" | "high";
};
