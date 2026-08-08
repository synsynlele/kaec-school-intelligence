export type InterventionDomain = "academic" | "skill" | "character";

export type InterventionAction = {
  domain: InterventionDomain;
  action: string;
  timeframe: string;
  evidenceIds: string[];
};

export type InterventionDraft = {
  priorityGrowthTarget: string;
  evidenceBasis: string;
  schoolIntervention: InterventionAction[];
  parentIntervention: InterventionAction[];
  timeframe: string;
  successIndicator: string;
  reviewDate: string;
  nextLearningAdjustment: string;
};

export type FinalDiagnosisSource = {
  concise_diagnosis: string;
  academic_strengths: unknown;
  academic_challenges: unknown;
  character_strengths: unknown;
  character_challenges: unknown;
  school_academic_actions: unknown;
  parent_academic_actions: unknown;
  school_character_actions: unknown;
  parent_character_actions: unknown;
  builder_growth_direction: string | null;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function findingStatements(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(record(item)?.statement))
    .filter(Boolean);
}

function actions(value: unknown, domain: InterventionDomain): InterventionAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = record(item);
      if (!row) return null;
      const action = text(row.action);
      if (!action) return null;
      return {
        domain,
        action,
        timeframe: text(row.timeframe),
        evidenceIds: stringArray(row.evidenceIds),
      };
    })
    .filter((item): item is InterventionAction => Boolean(item));
}

function dateAfterDays(days: number, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactSentenceList(items: string[], limit = 3) {
  return items.slice(0, limit).join(" ");
}

export function deriveInterventionDraft(
  diagnosis: FinalDiagnosisSource,
  now = new Date(),
): InterventionDraft {
  const schoolIntervention = [
    ...actions(diagnosis.school_academic_actions, "academic"),
    ...actions(diagnosis.school_character_actions, "character"),
  ];
  const parentIntervention = [
    ...actions(diagnosis.parent_academic_actions, "academic"),
    ...actions(diagnosis.parent_character_actions, "character"),
  ];

  const strengths = [
    ...findingStatements(diagnosis.academic_strengths),
    ...findingStatements(diagnosis.character_strengths),
  ];
  const challenges = [
    ...findingStatements(diagnosis.academic_challenges),
    ...findingStatements(diagnosis.character_challenges),
  ];

  const diagnosisSummary = diagnosis.concise_diagnosis.trim();
  const priorityGrowthTarget =
    diagnosis.builder_growth_direction?.trim() ||
    challenges[0] ||
    diagnosisSummary;

  const evidenceParts = [diagnosisSummary];
  if (challenges.length) {
    evidenceParts.push(`Priority evidence: ${compactSentenceList(challenges)}`);
  }

  const distinctTimeframes = [
    ...new Set(
      [...schoolIntervention, ...parentIntervention]
        .map((item) => item.timeframe)
        .filter(Boolean),
    ),
  ];
  const timeframe =
    distinctTimeframes.length === 1
      ? distinctTimeframes[0]
      : distinctTimeframes.length > 1
        ? `Action-specific: ${distinctTimeframes.join("; ")}`
        : "Next 2 weeks";

  const strengthScaffold = strengths.length
    ? ` Use the learner's documented strengths as scaffolds: ${compactSentenceList(strengths, 2)}`
    : "";

  return {
    priorityGrowthTarget,
    evidenceBasis: evidenceParts.filter(Boolean).join("\n\n"),
    schoolIntervention,
    parentIntervention,
    timeframe,
    successIndicator:
      "At the review checkpoint, the learner should show observable progress toward the priority growth target in the same evidence domains that informed the final diagnosis. Compare new classwork, task performance, conduct or other relevant first-hand evidence with the diagnosis baseline.",
    reviewDate: dateAfterDays(14, now),
    nextLearningAdjustment: `Use the next HQLS lesson to deliberately create an early learner-owned task that makes this growth priority observable: ${priorityGrowthTarget} Preserve productive struggle in Trial 1, target the documented need during Full Illumination, and require a second attempt that makes improvement visible.${strengthScaffold}`.trim(),
  };
}

export function interventionActionText(action: InterventionAction) {
  return `${action.action}${action.timeframe ? ` (${action.timeframe})` : ""}`;
}
