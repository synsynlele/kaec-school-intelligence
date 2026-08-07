export const HQLS_STAGE_KEYS = [
  "awakening",
  "exploration",
  "micro_illumination",
  "trial_first",
  "full_illumination",
  "trial_second",
  "integration",
] as const;

export type HqlsStageKey = (typeof HQLS_STAGE_KEYS)[number];

export const HQLS_STAGES = [
  {
    number: 1,
    key: "awakening",
    name: "Awakening",
    purpose: "Curiosity, meaning, and identity",
  },
  {
    number: 2,
    key: "exploration",
    name: "Exploration",
    purpose: "Crude thinking, assumptions, and learner voice",
  },
  {
    number: 3,
    key: "micro_illumination",
    name: "Micro-Illumination",
    purpose: "Minimal clarity and guardrails",
  },
  {
    number: 4,
    key: "trial_first",
    name: "Trial — First Attempt",
    purpose: "Productive struggle and gap exposure",
  },
  {
    number: 5,
    key: "full_illumination",
    name: "Full Illumination",
    purpose: "Targeted teaching after struggle",
  },
  {
    number: 6,
    key: "trial_second",
    name: "Trial — Second Attempt",
    purpose: "Re-application, growth, and competence",
  },
  {
    number: 7,
    key: "integration",
    name: "Integration",
    purpose: "Reflection, identity, and transfer",
  },
] as const satisfies ReadonlyArray<{
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  key: HqlsStageKey;
  name: string;
  purpose: string;
}>;

export const HQLS_NON_NEGOTIABLES = [
  "Struggle before full explanation",
  "No struggle without guardrails",
  "No second attempt without illumination",
  "Reflection before lesson closure",
  "Student thinking must be visible",
  "Teacher restraint must protect learner cognitive ownership",
  "Dignity must never be sacrificed for order, speed, compliance, or performance",
] as const;

export const HQLS_FORBIDDEN_PRACTICES = [
  "lecture_first_teaching",
  "fear_based_order",
  "stealing_struggle",
  "skipping_reflection",
  "compliance_as_success",
  "humiliation_as_discipline",
  "personality_driven_teaching",
] as const;

export type HqlsForbiddenPractice =
  (typeof HQLS_FORBIDDEN_PRACTICES)[number];

export const ASSESSMENT_ITEM_TYPES = [
  "objective",
  "subjective",
  "critical_thinking",
  "project",
] as const;

export type AssessmentItemType = (typeof ASSESSMENT_ITEM_TYPES)[number];

export const KAEC_CRITICAL_THINKING_TYPES = [
  "reality_simulation",
  "imperfect_choice",
  "hidden_problem",
  "creation",
  "crisis",
] as const;

export type KaecCriticalThinkingType =
  (typeof KAEC_CRITICAL_THINKING_TYPES)[number];

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

export const WORKSPACE_ROLES = ["owner", "admin", "teacher"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
