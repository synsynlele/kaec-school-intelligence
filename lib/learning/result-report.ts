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
  learner_id?: string;
  learner_name?: string;
  published_at: string;
  administrative_comment?: string | null;
  maxima: Record<Section, number>;
  scores: Record<Section, number | null> & { excused?: Section[] };
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
  passport_photo?: string | null;
  learner_name: string;
  class_name: string | null;
  academic_session: string | null;
  term: string | null;
  diagnosis: ReportDiagnosis | null;
  diagnosis_mode: string | null;
  diagnosis_reviewed_at: string | null;
  diagnosis_finalised_at: string | null;
};

export function resultScores(result: Pick<PublishedResult, "scores" | "maxima">) {
  const rows = resultSections.flatMap(([key, label]) => result.maxima[key] > 0
    ? [{ label, score: result.scores[key], maximum: result.maxima[key], excused: result.scores.excused?.includes(key) ?? false }]
    : []);
  const included = rows.filter((row) => !row.excused);
  const total = included.reduce((sum, row) => sum + (row.score ?? 0), 0);
  const maximum = included.reduce((sum, row) => sum + row.maximum, 0);
  const summary = !included.length && rows.length ? "Excused"
    : included.some((row) => row.score == null) ? "Pending" : `${total} / ${maximum}`;
  return { rows, total, maximum, summary };
}

export type TermReportAssessment = Pick<PublishedResult, "id" | "title" | "scores" | "maxima"> & {
  subject: string | null;
};

export type TermReport = {
  id: string;
  kind: "midterm" | "term";
  learner_name: string;
  learner_id: string;
  school_name: string;
  school_logo: string | null;
  class_name: string | null;
  academic_session: string;
  term: string;
  published_at: string;
  assessments: TermReportAssessment[];
  passport_photo?: string | null;
  mastery_progressing_at?: number;
  resumption_date?: string;
  admission_reference?: string;
};

export function termReportTitle(kind: TermReport["kind"]) {
  return kind === "midterm" ? "Mid-Term Report" : "Terminal Report";
}
