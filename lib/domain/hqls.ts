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
    purpose: "Create curiosity and meaning through a vivid scenario while the formal lesson topic remains hidden.",
    nonNegotiable:
      "Present one short scenario, image/headline/object/story or real-life situation and at most one central provocative question. Learners may wonder, react or take a position, but the teacher must not reveal the formal topic, define it, solve it or assign the first task.",
  },
  {
    index: 2,
    key: "exploration",
    title: "Exploration",
    purpose: "Check learners' crude knowledge and critical thinking before any correction or teaching.",
    nonNegotiable:
      "Ask 3–5 short oral questions when useful to reveal what learners think, what clues/words/ideas might mean, why they think so and how they connect the situation to life. Wrong and incomplete ideas may surface. Keep the formal topic hidden. Do not correct, teach, assign formal group work or require a product.",
  },
  {
    index: 3,
    key: "micro_illumination",
    title: "Micro-Illumination",
    purpose: "Give only the minimal clarity learners need to enter Trial — First Attempt.",
    nonNegotiable:
      "Give a brief orientation and, when useful, up to three guiding questions learners should keep in mind during Trial 1. Do not define the concept, correct the class, teach the lesson, reveal the formal topic, give the solution or create a separate learner activity.",
  },
  {
    index: 4,
    key: "trial_first",
    title: "Trial — First Attempt",
    purpose: "Give learners their first real collaborative struggle before full teaching.",
    nonNegotiable:
      "Pairs or small teams complete a concrete challenge with 2–4 clear outputs using the clues available. Expect errors and incomplete reasoning. The teacher states the expected struggle and explicitly does not correct, define, solve, rescue groups or reveal the formal topic yet.",
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
    purpose: "Let learners revisit the first attempt and make the improvement visible after teaching.",
    nonNegotiable:
      "Return to the same Stage 4 material or a very close equivalent wherever possible. Learners correct, improve, extend or redo the work using what they now understand while the teacher guides without taking ownership.",
  },
  {
    index: 7,
    key: "integration",
    title: "Integration",
    purpose: "Help learners reflect on changed thinking, connect learning to identity and apply it beyond the classroom.",
    nonNegotiable:
      "Include 3–5 reflection questions, a short identity connection and a concrete real-life assignment or application.",
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
  "integration_identity_connection_missing",
] as const;

export type HqlsAutomaticFailure =
  (typeof HQLS_AUTOMATIC_FAILURES)[number];

export function isHqlsStageKey(value: string): value is HqlsStageKey {
  return HQLS_STAGE_KEYS.includes(value as HqlsStageKey);
}
