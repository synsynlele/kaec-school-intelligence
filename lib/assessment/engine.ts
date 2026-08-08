export const ASSESSMENT_ENGINE_VERSION = "ASSESSMENT_ENGINE_v1.0";
export const ASSESSMENT_PROMPT_VERSION = "ASSESSMENT_PROMPT_v1.0";

export type AssessmentMode =
  | "objective"
  | "subjective"
  | "critical_thinking"
  | "project"
  | "mixed";

export type AssessmentItemType = Exclude<AssessmentMode, "mixed">;
export type CriticalThinkingType =
  | "reality_simulation"
  | "imperfect_choice"
  | "hidden_problem"
  | "creation"
  | "crisis";

export type AssessmentDifficulty = "easy" | "moderate" | "challenging";

export type AssessmentItemCounts = {
  objective: number;
  subjective: number;
  critical_thinking: number;
  project: number;
};

export type AssessmentRequest = {
  workspaceId: string;
  subjectId: string | null;
  subject: string;
  classId: string | null;
  classLevel: string;
  ageRange: string;
  title: string;
  topic: string;
  objective: string;
  assessmentMode: AssessmentMode;
  totalItems: number;
  totalMarks: number | null;
  durationMinutes: number | null;
  sourceLessonId: string | null;
  resourceIds: string[];
  purpose: string;
  teacherInstructions: string;
  itemCounts: AssessmentItemCounts;
};

export type AssessmentBlueprint = {
  topicsAndObjectives: string[];
  masteryEvidence: string[];
  capabilityEvidence: string[];
  itemDistribution: AssessmentItemCounts;
  difficultyDistribution: {
    easy: number;
    moderate: number;
    challenging: number;
  };
  totalItems: number;
  totalMarks: number;
};

export type GeneratedAssessmentItem = {
  position: number;
  itemType: AssessmentItemType;
  criticalThinkingType: CriticalThinkingType | "";
  topic: string;
  objective: string;
  competency: string;
  difficulty: AssessmentDifficulty;
  marks: number;
  prompt: string;
  options: string[];
  correctAnswer: string;
  answerRationale: string;
  expectedEvidence: string[];
  markingGuide: string[];
  deliverable: string;
  constraints: string[];
};

export type GeneratedAssessment = {
  title: string;
  studentInstructions: string;
  blueprint: AssessmentBlueprint;
  items: GeneratedAssessmentItem[];
};

export type AssessmentViolation = {
  code: string;
  message: string;
  itemPosition?: number;
};

export type AssessmentValidation = {
  passed: boolean;
  score: number;
  violations: AssessmentViolation[];
  evidence: string[];
};

const ITEM_TYPES: AssessmentItemType[] = [
  "objective",
  "subjective",
  "critical_thinking",
  "project",
];
const CRITICAL_TYPES: CriticalThinkingType[] = [
  "reality_simulation",
  "imperfect_choice",
  "hidden_problem",
  "creation",
  "crisis",
];
const DIFFICULTIES: AssessmentDifficulty[] = [
  "easy",
  "moderate",
  "challenging",
];

const countsSchema = {
  type: "object",
  properties: {
    objective: { type: "integer", minimum: 0 },
    subjective: { type: "integer", minimum: 0 },
    critical_thinking: { type: "integer", minimum: 0 },
    project: { type: "integer", minimum: 0 },
  },
};

export const ASSESSMENT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    studentInstructions: { type: "string" },
    blueprint: {
      type: "object",
      properties: {
        topicsAndObjectives: { type: "array", items: { type: "string" } },
        masteryEvidence: { type: "array", items: { type: "string" } },
        capabilityEvidence: { type: "array", items: { type: "string" } },
        itemDistribution: countsSchema,
        difficultyDistribution: {
          type: "object",
          properties: {
            easy: { type: "integer", minimum: 0 },
            moderate: { type: "integer", minimum: 0 },
            challenging: { type: "integer", minimum: 0 },
          },
        },
        totalItems: { type: "integer", minimum: 1 },
        totalMarks: { type: "number", minimum: 0 },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          position: { type: "integer", minimum: 1 },
          itemType: {
            type: "string",
            enum: ["objective", "subjective", "critical_thinking", "project"],
          },
          criticalThinkingType: {
            type: "string",
            enum: ["", ...CRITICAL_TYPES],
          },
          topic: { type: "string" },
          objective: { type: "string" },
          competency: { type: "string" },
          difficulty: {
            type: "string",
            enum: DIFFICULTIES,
          },
          marks: { type: "number", minimum: 0 },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctAnswer: { type: "string" },
          answerRationale: { type: "string" },
          expectedEvidence: { type: "array", items: { type: "string" } },
          markingGuide: { type: "array", items: { type: "string" } },
          deliverable: { type: "string" },
          constraints: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Assessment generation returned an invalid object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value.trim();
}

function number(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return value;
}

function integer(value: unknown, label: string) {
  const next = number(value, label);
  if (!Number.isInteger(next)) throw new Error(`${label} must be an integer.`);
  return next;
}

function strings(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string list.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseCounts(value: unknown, label: string): AssessmentItemCounts {
  const row = record(value);
  return {
    objective: integer(row.objective, `${label}.objective`),
    subjective: integer(row.subjective, `${label}.subjective`),
    critical_thinking: integer(
      row.critical_thinking,
      `${label}.critical_thinking`,
    ),
    project: integer(row.project, `${label}.project`),
  };
}

export function parseGeneratedAssessment(value: unknown): GeneratedAssessment {
  const row = record(value);
  const blueprintRow = record(row.blueprint);
  const difficultyRow = record(blueprintRow.difficultyDistribution);
  if (!Array.isArray(row.items)) throw new Error("Assessment items are missing.");

  const items = row.items.map((item, index): GeneratedAssessmentItem => {
    const itemRow = record(item);
    const itemType = string(itemRow.itemType, `Item ${index + 1} type`);
    const difficulty = string(
      itemRow.difficulty,
      `Item ${index + 1} difficulty`,
    );
    const criticalThinkingType = string(
      itemRow.criticalThinkingType,
      `Item ${index + 1} critical-thinking type`,
    );
    if (!ITEM_TYPES.includes(itemType as AssessmentItemType)) {
      throw new Error(`Item ${index + 1} has an invalid type.`);
    }
    if (!DIFFICULTIES.includes(difficulty as AssessmentDifficulty)) {
      throw new Error(`Item ${index + 1} has an invalid difficulty.`);
    }
    if (
      criticalThinkingType &&
      !CRITICAL_TYPES.includes(criticalThinkingType as CriticalThinkingType)
    ) {
      throw new Error(`Item ${index + 1} has an invalid critical-thinking type.`);
    }

    return {
      position: integer(itemRow.position, `Item ${index + 1} position`),
      itemType: itemType as AssessmentItemType,
      criticalThinkingType:
        criticalThinkingType as CriticalThinkingType | "",
      topic: string(itemRow.topic, `Item ${index + 1} topic`),
      objective: string(itemRow.objective, `Item ${index + 1} objective`),
      competency: string(itemRow.competency, `Item ${index + 1} competency`),
      difficulty: difficulty as AssessmentDifficulty,
      marks: number(itemRow.marks, `Item ${index + 1} marks`),
      prompt: string(itemRow.prompt, `Item ${index + 1} prompt`),
      options: strings(itemRow.options, `Item ${index + 1} options`),
      correctAnswer: string(
        itemRow.correctAnswer,
        `Item ${index + 1} correct answer`,
      ),
      answerRationale: string(
        itemRow.answerRationale,
        `Item ${index + 1} answer rationale`,
      ),
      expectedEvidence: strings(
        itemRow.expectedEvidence,
        `Item ${index + 1} expected evidence`,
      ),
      markingGuide: strings(
        itemRow.markingGuide,
        `Item ${index + 1} marking guide`,
      ),
      deliverable: string(
        itemRow.deliverable,
        `Item ${index + 1} deliverable`,
      ),
      constraints: strings(
        itemRow.constraints,
        `Item ${index + 1} constraints`,
      ),
    };
  });

  return {
    title: string(row.title, "Assessment title"),
    studentInstructions: string(
      row.studentInstructions,
      "Student instructions",
    ),
    blueprint: {
      topicsAndObjectives: strings(
        blueprintRow.topicsAndObjectives,
        "Blueprint topics/objectives",
      ),
      masteryEvidence: strings(
        blueprintRow.masteryEvidence,
        "Blueprint mastery evidence",
      ),
      capabilityEvidence: strings(
        blueprintRow.capabilityEvidence,
        "Blueprint capability evidence",
      ),
      itemDistribution: parseCounts(
        blueprintRow.itemDistribution,
        "Blueprint item distribution",
      ),
      difficultyDistribution: {
        easy: integer(difficultyRow.easy, "Blueprint easy count"),
        moderate: integer(difficultyRow.moderate, "Blueprint moderate count"),
        challenging: integer(
          difficultyRow.challenging,
          "Blueprint challenging count",
        ),
      },
      totalItems: integer(blueprintRow.totalItems, "Blueprint total items"),
      totalMarks: number(blueprintRow.totalMarks, "Blueprint total marks"),
    },
    items,
  };
}

export function countsForItems(items: GeneratedAssessmentItem[]): AssessmentItemCounts {
  return items.reduce<AssessmentItemCounts>(
    (acc, item) => {
      acc[item.itemType] += 1;
      return acc;
    },
    { objective: 0, subjective: 0, critical_thinking: 0, project: 0 },
  );
}

function countsEqual(a: AssessmentItemCounts, b: AssessmentItemCounts) {
  return ITEM_TYPES.every((key) => a[key] === b[key]);
}

function expectedCounts(request: AssessmentRequest): AssessmentItemCounts {
  if (request.assessmentMode === "mixed") return request.itemCounts;
  return {
    objective: request.assessmentMode === "objective" ? request.totalItems : 0,
    subjective: request.assessmentMode === "subjective" ? request.totalItems : 0,
    critical_thinking:
      request.assessmentMode === "critical_thinking" ? request.totalItems : 0,
    project: request.assessmentMode === "project" ? request.totalItems : 0,
  };
}

function hasReasoningDemand(prompt: string) {
  const lower = prompt.toLowerCase();
  const reasoningSignals = [
    "justify",
    "explain why",
    "decide",
    "choose",
    "recommend",
    "design",
    "create",
    "solve",
    "respond",
    "what would you do",
    "best course",
    "identify the hidden",
    "trade-off",
  ];
  return prompt.length >= 70 && reasoningSignals.some((term) => lower.includes(term));
}

export function validateAssessment(
  assessment: GeneratedAssessment,
  request: AssessmentRequest,
): AssessmentValidation {
  const violations: AssessmentViolation[] = [];
  const evidence: string[] = [];
  const add = (code: string, message: string, itemPosition?: number) =>
    violations.push({ code, message, itemPosition });

  if (assessment.items.length !== request.totalItems) {
    add(
      "item_count_mismatch",
      `Expected ${request.totalItems} items but received ${assessment.items.length}.`,
    );
  }

  const positions = assessment.items.map((item) => item.position);
  const expectedPositions = Array.from(
    { length: assessment.items.length },
    (_, index) => index + 1,
  );
  if (positions.some((position, index) => position !== expectedPositions[index])) {
    add("item_order_invalid", "Assessment item positions must be consecutive from 1.");
  }

  const actualCounts = countsForItems(assessment.items);
  const requestedCounts = expectedCounts(request);
  if (!countsEqual(actualCounts, requestedCounts)) {
    add(
      "item_type_distribution_mismatch",
      `Requested item distribution was ${JSON.stringify(requestedCounts)} but received ${JSON.stringify(actualCounts)}.`,
    );
  } else {
    evidence.push("Requested assessment item-type distribution is preserved.");
  }

  const marks = assessment.items.reduce((sum, item) => sum + item.marks, 0);
  if (request.totalMarks !== null && Math.abs(marks - request.totalMarks) > 0.001) {
    add(
      "total_marks_mismatch",
      `Requested ${request.totalMarks} total marks but generated items sum to ${marks}.`,
    );
  }
  if (Math.abs(assessment.blueprint.totalMarks - marks) > 0.001) {
    add(
      "blueprint_marks_mismatch",
      "Blueprint total marks do not match the generated item marks.",
    );
  }
  if (assessment.blueprint.totalItems !== assessment.items.length) {
    add(
      "blueprint_item_count_mismatch",
      "Blueprint total items do not match the generated item count.",
    );
  }
  if (!countsEqual(assessment.blueprint.itemDistribution, actualCounts)) {
    add(
      "blueprint_distribution_mismatch",
      "Blueprint item distribution does not match the generated items.",
    );
  }

  for (const item of assessment.items) {
    if (!item.topic || !item.objective || !item.competency || !item.expectedEvidence.length) {
      add(
        "item_metadata_incomplete",
        `Item ${item.position} is missing required topic/objective/competency/expected-evidence metadata.`,
        item.position,
      );
    }
    if (!item.prompt || item.prompt.length < 15) {
      add(
        "item_prompt_inadequate",
        `Item ${item.position} does not contain a usable assessment prompt.`,
        item.position,
      );
    }
    if (item.marks <= 0) {
      add(
        "item_marks_invalid",
        `Item ${item.position} must carry positive marks.`,
        item.position,
      );
    }

    if (item.itemType === "objective") {
      if (item.options.length < 4) {
        add(
          "objective_options_inadequate",
          `Objective item ${item.position} must contain at least four plausible options.`,
          item.position,
        );
      }
      if (!item.correctAnswer || !item.options.includes(item.correctAnswer)) {
        add(
          "objective_answer_invalid",
          `Objective item ${item.position} must identify one answer exactly matching an option.`,
          item.position,
        );
      }
      if (!item.answerRationale) {
        add(
          "objective_rationale_missing",
          `Objective item ${item.position} requires a teacher rationale.`,
          item.position,
        );
      }
    } else if (item.markingGuide.length === 0) {
      add(
        "marking_guide_missing",
        `Item ${item.position} requires a usable marking guide.`,
        item.position,
      );
    }

    if (item.itemType === "critical_thinking") {
      if (!item.criticalThinkingType) {
        add(
          "critical_thinking_type_missing",
          `Critical-thinking item ${item.position} must use one KAEC experience type.`,
          item.position,
        );
      }
      if (!hasReasoningDemand(item.prompt)) {
        add(
          "critical_thinking_recall_risk",
          `Critical-thinking item ${item.position} does not make genuine reasoning/choice/creation sufficiently visible.`,
          item.position,
        );
      }
    } else if (item.criticalThinkingType) {
      add(
        "critical_type_on_noncritical_item",
        `Item ${item.position} should not carry a critical-thinking experience type.`,
        item.position,
      );
    }

    if (item.itemType === "project" && !item.deliverable) {
      add(
        "project_deliverable_missing",
        `Project item ${item.position} requires an observable deliverable.`,
        item.position,
      );
    }
  }

  if (request.topic && !assessment.blueprint.topicsAndObjectives.length) {
    add("blueprint_alignment_missing", "Blueprint must describe topic/objective coverage.");
  }
  if (!assessment.blueprint.masteryEvidence.length) {
    add("mastery_evidence_missing", "Blueprint must describe academic mastery evidence.");
  }

  if (!violations.length) {
    evidence.push("Item metadata, answer/marking guidance and blueprint consistency passed deterministic validation.");
    if (actualCounts.critical_thinking > 0) {
      evidence.push("Critical-thinking items use KAEC experience types and visible reasoning demands.");
    }
  }

  return {
    passed: violations.length === 0,
    score: Math.max(0, 100 - violations.length * 8),
    violations,
    evidence,
  };
}

export function buildAssessmentSystemInstruction() {
  return `You are the KAEC School Intelligence Assessment Engine. Assessment reveals understanding, guides growth and informs instruction. It must not rank human worth or reward recall as the dominant mode. Generate only the requested structured assessment. Preserve Academic Mastery and, where genuinely observable, Human Capability Evidence. Critical Thinking must use KAEC Reality Simulation, Imperfect Choice, Hidden Problem, Creation or Crisis experiences and must require genuine reasoning, choice, problem identification or creation. Objective distractors should reveal likely misunderstanding, not use tricks. Marking guidance must be usable by a teacher. Do not include medical, psychological or character diagnoses.`;
}

function distributionText(counts: AssessmentItemCounts) {
  return `objective ${counts.objective}, subjective ${counts.subjective}, critical thinking ${counts.critical_thinking}, project ${counts.project}`;
}

export function buildAssessmentPrompt(
  request: AssessmentRequest,
  sourceLessonContext: string,
  sourceLabels: string[],
) {
  const counts = expectedCounts(request);
  return `Create a teacher-ready assessment for ${request.subject}, ${request.classLevel} (${request.ageRange}).\n\nTitle: ${request.title}\nTopic: ${request.topic}\nObjective: ${request.objective}\nAssessment mode: ${request.assessmentMode}\nRequired total items: ${request.totalItems}\nRequired distribution: ${distributionText(counts)}\n${request.totalMarks === null ? "Choose a sensible total mark and ensure blueprint/item marks match." : `Required total marks: ${request.totalMarks}`}\n${request.durationMinutes === null ? "" : `Duration: ${request.durationMinutes} minutes`}\nPurpose/instructions from teacher: ${request.purpose || "Not supplied"}\nTeacher constraints: ${request.teacherInstructions || "None"}\n\n${sourceLessonContext ? `SOURCE HQLS LESSON CONTEXT:\n${sourceLessonContext}\n\n` : ""}${sourceLabels.length ? `AUTHORISED SCHOOL SOURCES: ${sourceLabels.join(", ")}\nUse them materially and keep the assessment aligned to them.\n\n` : ""}Rules:\n1. Return exactly ${request.totalItems} ordered items positions 1..${request.totalItems}.\n2. Blueprint counts and marks must exactly match the actual items.\n3. Every item needs topic, objective, competency, difficulty, marks and expected evidence.\n4. Objective: >=4 options, correctAnswer must exactly equal one option, include teacher rationale.\n5. Subjective: require constructed response/application and a marking guide.\n6. Critical Thinking: use one KAEC experience type and require actual reasoning/choice/creation; no recall question disguised as critical thinking.\n7. Project: include observable deliverable and marking criteria.\n8. Student instructions must not expose answers or marking guidance.\n9. Keep language appropriate to the class and Nigerian/African realities where a realistic context is useful.`;
}

export function buildAssessmentRepairPrompt(
  request: AssessmentRequest,
  current: GeneratedAssessment,
  validation: AssessmentValidation,
) {
  return `Repair this assessment so it fully satisfies the requested blueprint and KAEC assessment rules. Change only what is necessary.\n\nREQUEST:\n${buildAssessmentPrompt(request, "", [])}\n\nVALIDATION FAILURES:\n${validation.violations.map((item) => `- ${item.code}: ${item.message}`).join("\n")}\n\nCURRENT ASSESSMENT JSON:\n${JSON.stringify(current)}`;
}

export type AssessmentItemAction =
  | "improve"
  | "simplify"
  | "increase_challenge"
  | "make_more_practical"
  | "regenerate";

export function buildAssessmentItemRegenerationPrompt(
  assessment: GeneratedAssessment,
  item: GeneratedAssessmentItem,
  action: AssessmentItemAction,
) {
  const instructions: Record<AssessmentItemAction, string> = {
    improve: "Improve clarity, validity and evidence quality while preserving item type, topic, objective and marks.",
    simplify: "Make the language easier and more accessible without reducing the intended learning objective or marks unfairly.",
    increase_challenge: "Increase cognitive challenge while remaining age-appropriate and preserving item type, topic, objective and marks.",
    make_more_practical: "Make the item more realistic and applied, preferably using a credible Nigerian/African context where appropriate.",
    regenerate: "Regenerate a materially different but equivalent item with the same type, topic, objective, difficulty target and marks.",
  };
  return `${instructions[action]}\nReturn the COMPLETE replacement item only, with the same position ${item.position}. It must remain consistent with this assessment blueprint:\n${JSON.stringify(assessment.blueprint)}\n\nCURRENT ITEM:\n${JSON.stringify(item)}`;
}

export const ASSESSMENT_ITEM_JSON_SCHEMA = (
  ASSESSMENT_JSON_SCHEMA.properties as Record<string, unknown>
).items as Record<string, unknown>;

export function assessmentSnapshot(assessment: GeneratedAssessment) {
  return {
    title: assessment.title,
    studentInstructions: assessment.studentInstructions,
    blueprint: assessment.blueprint,
    items: assessment.items,
  };
}
