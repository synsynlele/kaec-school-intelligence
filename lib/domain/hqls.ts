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
    purpose: "Awaken learners' imagination with a vivid scenario that makes them picture, wonder and think before they know the lesson topic.",
    nonNegotiable:
      "Present one short imagined scenario or situation and at most one thinking question. Do not test prior knowledge, assign a task, ask for a solution, reveal the topic or start teaching it.",
  },
  {
    index: 2,
    key: "exploration",
    title: "Exploration",
    purpose: "Check learners' crude knowledge through critical thinking about the imagined situation.",
    nonNegotiable:
      "Ask one or two short oral questions that reveal what learners currently think and why. Wrong and incomplete ideas may surface. Do not correct, teach, assign group work or require a product.",
  },
  {
    index: 3,
    key: "micro_illumination",
    title: "Micro-Illumination",
    purpose: "Give one tiny clue learners need for Trial — First Attempt.",
    nonNegotiable:
      "Say or show one small clue that directly prepares learners for Trial 1, then move on. Do not ask another question, create another task, explain the concept, reveal the topic or give the solution.",
  },
  {
    index: 4,
    key: "trial_first",
    title: "Trial — First Attempt",
    purpose: "Let learners use the Micro-Illumination clue together in a demanding first attempt before full teaching.",
    nonNegotiable:
      "Pairs or small teams use the Stage 3 clue, combine every learner's contribution and agree one justified shared response. The teacher gives the challenge clearly, observes, and does not rescue, correct, reveal the topic or remove meaningful cognitive effort.",
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
  "micro_illumination_becomes_full_solution",
  "micro_illumination_becomes_task",
  "trial_first_is_rescued",
  "trial_first_lacks_teamwork",
  "trial_first_has_no_productive_struggle",
  "trial_second_has_no_genuine_reattempt",
  "integration_missing",
] as const;

export type HqlsAutomaticFailure =
  (typeof HQLS_AUTOMATIC_FAILURES)[number];

export function isHqlsStageKey(value: string): value is HqlsStageKey {
  return HQLS_STAGE_KEYS.includes(value as HqlsStageKey);
}
