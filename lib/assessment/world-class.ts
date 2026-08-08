import {
  buildAssessmentPrompt,
  buildAssessmentRepairPrompt,
  buildAssessmentSystemInstruction,
  validateAssessment,
  type AssessmentRequest,
  type AssessmentValidation,
  type GeneratedAssessment,
} from "@/lib/assessment/engine";

export const ASSESSMENT_ENGINE_VERSION_V11 = "ASSESSMENT_ENGINE_v1.1";
export const ASSESSMENT_PROMPT_VERSION_V11 = "ASSESSMENT_PROMPT_v1.1";
export const ASSESSMENT_QUALITY_STANDARD_VERSION = "KAEC_ASSESSMENT_QUALITY_v1.0";

export const ASSESSMENT_KINDS = [
  "assignment",
  "quiz",
  "test",
  "exam",
  "project",
] as const;

export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export const ASSESSMENT_OVERALL_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const;

export type AssessmentOverallDifficulty =
  (typeof ASSESSMENT_OVERALL_DIFFICULTIES)[number];

export type AssessmentTopicSpec = {
  topic: string;
  objectives: string[];
  weight: number;
};

export type WorldClassAssessmentRequest = AssessmentRequest & {
  assessmentKind: AssessmentKind;
  overallDifficulty: AssessmentOverallDifficulty;
  topics: AssessmentTopicSpec[];
};

export type TopicCoverageEvidence = {
  topic: string;
  requestedWeight: number;
  itemCount: number;
  marks: number;
  markShare: number;
};

export type WorldClassQualitySummary = {
  qualityStandardVersion: string;
  assessmentKind: AssessmentKind;
  overallDifficulty: AssessmentOverallDifficulty;
  requestedTopics: AssessmentTopicSpec[];
  topicCoverage: TopicCoverageEvidence[];
  difficultyProfile: {
    easy: number;
    moderate: number;
    challenging: number;
  };
};

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topicMatches(itemTopic: string, requestedTopic: string) {
  const item = normalized(itemTopic);
  const requested = normalized(requestedTopic);
  return Boolean(item && requested && item === requested);
}

function duplicatePromptKey(prompt: string) {
  return normalized(prompt)
    .replace(/\b(the|a|an|and|or|of|to|in|on|for)\b/g, " ")
    .replace(/\s+/g, " ");
}

export function worldClassDifficultyTarget(
  difficulty: AssessmentOverallDifficulty,
) {
  if (difficulty === "easy") {
    return { easy: 60, moderate: 30, challenging: 10 };
  }
  if (difficulty === "hard") {
    return { easy: 10, moderate: 35, challenging: 55 };
  }
  return { easy: 25, moderate: 50, challenging: 25 };
}

export function assessmentKindGuidance(kind: AssessmentKind) {
  switch (kind) {
    case "assignment":
      return "An assignment may be completed over a longer period. Prioritise meaningful application, explanation, practice and evidence of independent work over speed.";
    case "quiz":
      return "A quiz should be focused and efficient, checking a limited body of recent learning with clear feedback value. Avoid unnecessary breadth.";
    case "test":
      return "A test should sample the taught objectives with balanced breadth and depth, giving teachers dependable evidence for instructional decisions.";
    case "exam":
      return "An examination should provide broad, defensible coverage across the supplied topics/objectives, with suitable cognitive range, fair wording and a reliable marking scheme.";
    case "project":
      return "A project assessment must culminate in an observable product, performance or solution and use explicit criteria that make quality judgeable.";
  }
}

function topicsText(topics: AssessmentTopicSpec[]) {
  return topics
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.topic} — ${entry.weight}% of assessment emphasis\n   Objectives: ${entry.objectives.join("; ") || "Use the supplied curriculum/source evidence to define suitable assessable objectives."}`,
    )
    .join("\n");
}

export function buildWorldClassAssessmentSystemInstruction() {
  return `${buildAssessmentSystemInstruction()}\n\nYou are also operating under KAEC Assessment Quality Standard v1.0. Design for validity, reliability, fairness, accessibility and manageability. Measure the intended learning rather than irrelevant literacy, cultural familiarity or trick-taking skill. Avoid ambiguous wording, duplicate questions, implausible distractors, stereotypes, unnecessary emotional barriers and hidden requirements. Match marks to the evidence demanded. Across the assessment, use an appropriate progression from knowledge/understanding into application, analysis/reasoning and, where suitable, evaluation/creation. Do not allow recall to dominate merely because objective items are requested. The assessment type, topic weights and overall difficulty are binding design constraints.`;
}

export function buildWorldClassAssessmentPrompt(
  request: WorldClassAssessmentRequest,
  sourceLessonContext: string,
  sourceLabels: string[],
) {
  const base = buildAssessmentPrompt(request, sourceLessonContext, sourceLabels);
  const target = worldClassDifficultyTarget(request.overallDifficulty);
  return `${base}\n\nWORLD-CLASS ASSESSMENT BLUEPRINT REQUIREMENTS\nAssessment type: ${request.assessmentKind.toUpperCase()}\nAssessment-type intent: ${assessmentKindGuidance(request.assessmentKind)}\nOverall difficulty: ${request.overallDifficulty.toUpperCase()}\nTarget difficulty profile (approximate item share): easy ${target.easy}%, moderate ${target.moderate}%, challenging ${target.challenging}%.\n\nMULTI-TOPIC COVERAGE\n${topicsText(request.topics)}\n\nAdditional rules:\n10. Every requested topic must be represented by at least one meaningful item. Topic emphasis should follow the requested weights primarily by marks, not by superficial mentions.\n11. Every item.topic must be EXACTLY one of the requested topic labels, preserving that label verbatim. Do not merge topic labels and do not use broader or narrower aliases. Every item.objective must be assessable and connected to that topic's supplied objectives.\n12. Use a deliberate cognitive-demand progression. Even objective questions can assess application or reasoning; do not make the paper a memory dump.\n13. Avoid duplicate or near-duplicate prompts and avoid testing the same evidence repeatedly unless deliberate spiral evidence is necessary.\n14. Objective options must be mutually distinct, grammatically compatible with the stem and free from clueing or trick wording.\n15. Marking guides must describe observable evidence sufficiently clearly that another competent teacher could mark consistently.\n16. Use plain, age-appropriate language. Do not introduce irrelevant cultural, financial, disability, gender or emotional barriers unrelated to the learning being assessed.\n17. Keep workload realistic for the stated duration and assessment type.\n18. If assessment type is PROJECT, include at least one project item with an observable deliverable and explicit criteria.\n19. In blueprint.topicsAndObjectives, include every requested topic and its objectives; in blueprint.difficultyDistribution, make the final counts consistent with the actual items.`;
}

export function buildWorldClassAssessmentRepairPrompt(
  request: WorldClassAssessmentRequest,
  current: GeneratedAssessment,
  validation: AssessmentValidation,
) {
  return `${buildAssessmentRepairPrompt(request, current, validation)}\n\nWORLD-CLASS REPAIR REQUIREMENTS:\n${buildWorldClassAssessmentPrompt(request, "", [])}`;
}

function topicCoverage(
  assessment: GeneratedAssessment,
  request: WorldClassAssessmentRequest,
): TopicCoverageEvidence[] {
  const totalMarks = assessment.items.reduce((sum, item) => sum + item.marks, 0);
  return request.topics.map((entry) => {
    const matching = assessment.items.filter((item) =>
      topicMatches(item.topic, entry.topic),
    );
    const marks = matching.reduce((sum, item) => sum + item.marks, 0);
    return {
      topic: entry.topic,
      requestedWeight: entry.weight,
      itemCount: matching.length,
      marks,
      markShare: totalMarks > 0 ? (marks / totalMarks) * 100 : 0,
    };
  });
}

function difficultyProfile(assessment: GeneratedAssessment) {
  return assessment.items.reduce(
    (acc, item) => {
      acc[item.difficulty] += 1;
      return acc;
    },
    { easy: 0, moderate: 0, challenging: 0 },
  );
}

export function worldClassQualitySummary(
  assessment: GeneratedAssessment,
  request: WorldClassAssessmentRequest,
): WorldClassQualitySummary {
  return {
    qualityStandardVersion: ASSESSMENT_QUALITY_STANDARD_VERSION,
    assessmentKind: request.assessmentKind,
    overallDifficulty: request.overallDifficulty,
    requestedTopics: request.topics,
    topicCoverage: topicCoverage(assessment, request),
    difficultyProfile: difficultyProfile(assessment),
  };
}

export function validateWorldClassAssessment(
  assessment: GeneratedAssessment,
  request: WorldClassAssessmentRequest,
): AssessmentValidation {
  const base = validateAssessment(assessment, request);
  const violations = [...base.violations];
  const evidence = [...base.evidence];
  const add = (code: string, message: string, itemPosition?: number) =>
    violations.push({ code, message, itemPosition });

  const requestedTopicKeys = new Set(
    request.topics.map((entry) => normalized(entry.topic)),
  );
  for (const item of assessment.items) {
    if (!requestedTopicKeys.has(normalized(item.topic))) {
      add(
        "item_topic_not_canonical",
        `Item ${item.position} must use exactly one requested topic label. Received \"${item.topic}\".`,
        item.position,
      );
    }
  }

  const coverage = topicCoverage(assessment, request);
  for (const entry of coverage) {
    if (entry.itemCount === 0) {
      add(
        "requested_topic_missing",
        `Requested topic \"${entry.topic}\" is not meaningfully assessed.`,
      );
      continue;
    }
    const tolerance = Math.max(15, entry.requestedWeight * 0.35);
    if (Math.abs(entry.markShare - entry.requestedWeight) > tolerance) {
      add(
        "topic_weight_misaligned",
        `Topic \"${entry.topic}\" was weighted at ${entry.requestedWeight}% but receives about ${Math.round(entry.markShare)}% of marks.`,
      );
    }
  }
  if (coverage.every((entry) => entry.itemCount > 0)) {
    evidence.push("All requested topics are represented in the assessment.");
  }

  const topicsInBlueprint = assessment.blueprint.topicsAndObjectives
    .map(normalized)
    .join(" | ");
  for (const entry of request.topics) {
    if (!topicsInBlueprint.includes(normalized(entry.topic))) {
      add(
        "blueprint_topic_missing",
        `Blueprint does not explicitly include requested topic \"${entry.topic}\".`,
      );
    }
  }

  const profile = difficultyProfile(assessment);
  const count = Math.max(1, assessment.items.length);
  const easyShare = profile.easy / count;
  const moderateShare = profile.moderate / count;
  const challengingShare = profile.challenging / count;
  if (request.overallDifficulty === "easy") {
    if (easyShare < 0.4 || challengingShare > 0.25) {
      add(
        "overall_difficulty_misaligned",
        "Easy assessment must be predominantly accessible and must not contain too many challenging items.",
      );
    }
  } else if (request.overallDifficulty === "hard") {
    if (challengingShare < 0.4 || easyShare > 0.3) {
      add(
        "overall_difficulty_misaligned",
        "Hard assessment must contain substantial challenging cognitive demand and limited easy items.",
      );
    }
  } else if (moderateShare < 0.3 || easyShare > 0.55 || challengingShare > 0.55) {
    add(
      "overall_difficulty_misaligned",
      "Medium assessment must maintain a balanced difficulty profile centred on moderate items.",
    );
  } else {
    evidence.push("Generated item difficulty profile matches the requested overall difficulty.");
  }

  const seenPrompts = new Map<string, number>();
  for (const item of assessment.items) {
    const key = duplicatePromptKey(item.prompt);
    const previous = seenPrompts.get(key);
    if (key.length > 20 && previous !== undefined) {
      add(
        "duplicate_item_prompt",
        `Item ${item.position} duplicates the assessment demand of item ${previous}.`,
        item.position,
      );
    } else {
      seenPrompts.set(key, item.position);
    }

    if (item.itemType === "objective") {
      const normalizedOptions = item.options.map(normalized);
      if (new Set(normalizedOptions).size !== normalizedOptions.length) {
        add(
          "objective_duplicate_options",
          `Objective item ${item.position} contains duplicate or effectively identical options.`,
          item.position,
        );
      }
      const answerMatches = item.options.filter(
        (option) => normalized(option) === normalized(item.correctAnswer),
      ).length;
      if (answerMatches !== 1) {
        add(
          "objective_answer_not_unique",
          `Objective item ${item.position} must have exactly one uniquely identifiable correct option.`,
          item.position,
        );
      }
    }
  }

  if (
    request.assessmentKind === "project" &&
    !assessment.items.some((item) => item.itemType === "project")
  ) {
    add(
      "project_assessment_missing_project",
      "A Project assessment must contain at least one observable project deliverable.",
    );
  }

  if (!violations.length) {
    evidence.push(
      "Multi-topic coverage, requested weighting, canonical topic labels, difficulty profile and duplicate-option checks passed KAEC Assessment Quality validation.",
    );
  }

  return {
    passed: violations.length === 0,
    score: Math.max(0, 100 - violations.length * 6),
    violations,
    evidence,
  };
}
