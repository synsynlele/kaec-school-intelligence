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
    purpose: "Make learners curious and show why the lesson matters.",
    nonNegotiable:
      "Begin with a problem, situation, tension or provocative question. No definitions, notes or full teaching.",
  },
  {
    index: 2,
    key: "exploration",
    title: "Exploration",
    purpose: "Let learners share what they already think, including wrong or incomplete ideas.",
    nonNegotiable:
      "Wrong and incomplete thinking may surface. Correction is deliberately withheld while the teacher observes thinking.",
  },
  {
    index: 3,
    key: "micro_illumination",
    title: "Micro-Illumination",
    purpose: "Give only a small amount of clarification so learners can continue.",
    nonNegotiable:
      "Give only enough clarity to prevent hopelessness. Do not convert this stage into full teaching or a worked solution.",
  },
  {
    index: 4,
    key: "trial_first",
    title: "Trial — First Attempt",
    purpose: "Let learners try before full teaching so their gaps and difficulties become clear.",
    nonNegotiable:
      "Students attempt before full explanation. The teacher does not rescue, solve or remove meaningful cognitive effort.",
  },
  {
    index: 5,
    key: "full_illumination",
    title: "Full Illumination",
    purpose: "Teach the concept fully in a clear, normal lesson style.",
    nonNegotiable:
      "Full Illumination must occur after Trial — First Attempt. Inside Stage 5, normal teaching is unrestricted: the teacher may explain, lecture, define, give notes, write on the board, demonstrate, solve examples, use formulas/rules/laws and teach in the conventional style best suited to the subject and class.",
  },
  {
    index: 6,
    key: "trial_second",
    title: "Trial — Second Attempt",
    purpose: "Let learners try again using what they have now learned.",
    nonNegotiable:
      "Students reattempt with better tools and clearer reasoning while the teacher returns ownership to the learner.",
  },
  {
    index: 7,
    key: "integration",
    title: "Integration",
    purpose: "Help learners reflect on what changed and connect the lesson to real life.",
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
  "trial_second_has_no_genuine_reattempt",
  "integration_missing",
] as const;

export type HqlsAutomaticFailure =
  (typeof HQLS_AUTOMATIC_FAILURES)[number];

export function isHqlsStageKey(value: string): value is HqlsStageKey {
  return HQLS_STAGE_KEYS.includes(value as HqlsStageKey);
}
