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

export type HqlsStageDefinition = {
  index: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  key: HqlsStageKey;
  title: string;
  purpose: string;
  nonNegotiable: string;
};

export const HQLS_STAGES: readonly HqlsStageDefinition[] = [
  {
    index: 1,
    key: "awakening",
    title: "Awakening",
    purpose: "Curiosity, meaning and identity.",
    nonNegotiable:
      "Begin with a problem, situation, tension or provocative question. No definitions, notes or full teaching.",
  },
  {
    index: 2,
    key: "exploration",
    title: "Exploration",
    purpose: "Expose crude thinking, assumptions and learner voice.",
    nonNegotiable:
      "Wrong and incomplete thinking may surface. Correction is deliberately withheld while the teacher observes thinking.",
  },
  {
    index: 3,
    key: "micro_illumination",
    title: "Micro-Illumination",
    purpose: "Provide minimal clarity and guardrails.",
    nonNegotiable:
      "Give only enough clarity to prevent hopelessness. Do not convert this stage into full teaching or a worked solution.",
  },
  {
    index: 4,
    key: "trial_first",
    title: "Trial — First Attempt",
    purpose: "Create productive struggle and expose gaps.",
    nonNegotiable:
      "Students attempt before full explanation. The teacher does not rescue, solve or remove meaningful cognitive effort.",
  },
  {
    index: 5,
    key: "full_illumination",
    title: "Full Illumination",
    purpose: "Teach after effort.",
    nonNegotiable:
      "Teaching is targeted, concise and connected directly to misconceptions or gaps revealed by the first attempt.",
  },
  {
    index: 6,
    key: "trial_second",
    title: "Trial — Second Attempt",
    purpose: "Apply new understanding and make growth visible.",
    nonNegotiable:
      "Students reattempt with better tools and clearer reasoning while the teacher returns ownership to the learner.",
  },
  {
    index: 7,
    key: "integration",
    title: "Integration",
    purpose: "Reflection, identity and transfer.",
    nonNegotiable:
      "Learners reflect on how thinking changed and connect the learning to life, future action or self-understanding.",
  },
] as const;

export const HQLS_AUTOMATIC_FAILURES = [
  "full_teaching_before_first_struggle",
  "awakening_starts_with_content_dump",
  "exploration_corrects_too_early",
  "micro_illumination_becomes_full_solution",
  "trial_first_is_rescued",
  "full_illumination_ignores_revealed_gaps",
  "trial_second_has_no_genuine_reattempt",
  "integration_missing",
  "teacher_carries_cognitive_load",
] as const;

export type HqlsAutomaticFailure =
  (typeof HQLS_AUTOMATIC_FAILURES)[number];

export function isHqlsStageKey(value: string): value is HqlsStageKey {
  return HQLS_STAGE_KEYS.includes(value as HqlsStageKey);
}
