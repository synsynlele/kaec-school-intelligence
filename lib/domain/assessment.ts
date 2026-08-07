export const ASSESSMENT_ITEM_TYPES = [
  "objective",
  "subjective",
  "critical_thinking",
  "project",
] as const;

export type AssessmentItemType = (typeof ASSESSMENT_ITEM_TYPES)[number];

export const KAEC_CRITICAL_THINKING_EXPERIENCE_TYPES = [
  "reality_simulation",
  "imperfect_choice",
  "hidden_problem",
  "creation",
  "crisis",
] as const;

export type KaecCriticalThinkingExperienceType =
  (typeof KAEC_CRITICAL_THINKING_EXPERIENCE_TYPES)[number];

export const ASSESSMENT_DIFFICULTIES = [
  "foundation",
  "balanced",
  "challenging",
] as const;

export type AssessmentDifficulty =
  (typeof ASSESSMENT_DIFFICULTIES)[number];
