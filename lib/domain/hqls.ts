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
    purpose: "Create a mystery that makes learners curious before they know the lesson topic.",
    nonNegotiable:
      "Begin with a surprising problem, contradiction, dilemma or missing piece. Use at most one curiosity question. Do not reveal the topic, define it or start teaching it.",
  },
  {
    index: 2,
    key: "exploration",
    title: "Exploration",
    purpose: "Surface learners' crude hypotheses and the reasons behind them while the mystery remains open.",
    nonNegotiable:
      "Wrong and incomplete thinking may surface. Learners briefly say what they think and why; correction, formal naming and task-setting are deliberately withheld.",
  },
  {
    index: 3,
    key: "micro_illumination",
    title: "Micro-Illumination",
    purpose: "Add one clue that forces learners to reconsider their earlier ideas without solving the mystery.",
    nonNegotiable:
      "Give one small fact, hint, constraint, counterexample or observation. Learners revise, predict or eliminate an idea. Do not reveal the topic, define it or give a worked solution.",
  },
  {
    index: 4,
    key: "trial_first",
    title: "Trial — First Attempt",
    purpose: "Make learners use the clues together in a demanding first attempt before the mystery is explained.",
    nonNegotiable:
      "Pairs or small teams combine every learner's contribution into one justified shared decision, inference, prediction, design or explanation. The teacher does not rescue, correct, reveal the topic or remove meaningful cognitive effort.",
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
  "pre_illumination_topic_revealed",
  "awakening_starts_with_content_dump",
  "exploration_corrects_too_early",
  "exploration_lacks_reasoning",
  "micro_illumination_becomes_full_solution",
  "micro_illumination_lacks_reconsideration",
  "trial_first_is_rescued",
  "trial_first_lacks_reasoning",
  "trial_second_has_no_genuine_reattempt",
  "integration_missing",
] as const;

export type HqlsAutomaticFailure =
  (typeof HQLS_AUTOMATIC_FAILURES)[number];

export function isHqlsStageKey(value: string): value is HqlsStageKey {
  return HQLS_STAGE_KEYS.includes(value as HqlsStageKey);
}
