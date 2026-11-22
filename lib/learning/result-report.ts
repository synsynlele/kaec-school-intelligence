export const resultSections = [
  ["objective", "CBT"],
  ["subjective", "Subjective"],
  ["critical_thinking", "Critical Thinking"],
  ["project", "Project"],
] as const;

type Section = (typeof resultSections)[number][0];
export type PublishedResult = {
  id: string;
  title: string;
  published_at: string;
  administrative_comment?: string | null;
  maxima: Record<Section, number>;
  scores: Record<Section, number | null>;
};
export type ReportDiagnosis = {
  conciseDiagnosis: string;
  academicSkillStrengths: { statement: string }[];
  academicSkillChallenges: { statement: string }[];
  characterStrengths: { statement: string }[];
  characterChallenges: { statement: string }[];
  schoolAcademicActions: { action: string; timeframe: string }[];
  parentAcademicActions: { action: string; timeframe: string }[];
  schoolCharacterActions: { action: string; timeframe: string }[];
  parentCharacterActions: { action: string; timeframe: string }[];
  builderGrowthDirection: string;
  encouragementNote: string;
};
export type ResultReport = PublishedResult & {
  school_name: string;
  school_logo: string | null;
  learner_name: string;
  class_name: string | null;
  academic_session: string | null;
  term: string | null;
  diagnosis: ReportDiagnosis | null;
  diagnosis_mode: string | null;
  diagnosis_reviewed_at: string | null;
  diagnosis_finalised_at: string | null;
};

export function resultScores(result: PublishedResult) {
  const rows = resultSections.flatMap(([key, label]) => result.maxima[key] > 0
    ? [{ label, score: result.scores[key] ?? 0, maximum: result.maxima[key] }]
    : []);
  return {
    rows,
    total: rows.reduce((sum, row) => sum + row.score, 0),
    maximum: rows.reduce((sum, row) => sum + row.maximum, 0),
  };
}
