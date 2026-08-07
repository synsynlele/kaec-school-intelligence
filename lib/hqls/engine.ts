import { HQLS_STAGES, type HqlsStageKey } from "@/lib/domain/hqls";

export const HQLS_ENGINE_VERSION = "HQLS_ENGINE_v1.0";
export const HQLS_PROMPT_VERSION = "HQLS_PROMPT_v1.1";

export type HqlsStageAction =
  | "improve"
  | "simplify"
  | "increase_challenge"
  | "make_more_practical"
  | "reduce_resource_dependence"
  | "regenerate";

export type HqlsLessonRequest = {
  workspaceId: string;
  subjectId?: string | null;
  subject: string;
  classId?: string | null;
  classLevel: string;
  ageRange: string;
  durationMinutes: number;
  topic: string;
  objective: string;
  previousLearning?: string;
  availableResources?: string;
  classContext?: string;
  teacherInstructions?: string;
  resourceIds?: string[];
};

export type HqlsStageContent = {
  stageNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  stageKey: HqlsStageKey;
  title: string;
  purpose: string;
  experience: string;
  teacherPrompts: string[];
  learnerActions: string[];
  guideGuardrails: string[];
  evidenceToNotice: string[];
  productiveStruggle: string;
  teachingContent: string;
  respondsToFirstAttempt: string;
  reflectionPrompt: string;
  transferTask: string;
};

export type GeneratedHqlsLesson = {
  title: string;
  lessonIntent: string;
  stages: HqlsStageContent[];
};

export type HqlsViolation = {
  code: string;
  stageKey?: HqlsStageKey;
  message: string;
};

export type HqlsStageValidation = {
  passed: boolean;
  violations: string[];
};

export type HqlsValidationResult = {
  passed: boolean;
  score: number;
  violations: HqlsViolation[];
  evidence: string[];
  stageValidation: Record<HqlsStageKey, HqlsStageValidation>;
};

const STRING_ARRAY_SCHEMA = {
  type: "array",
  items: { type: "string" },
};

export const HQLS_STAGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    stageNumber: { type: "integer" },
    stageKey: {
      type: "string",
      enum: HQLS_STAGES.map((stage) => stage.key),
    },
    title: { type: "string" },
    purpose: { type: "string" },
    experience: { type: "string" },
    teacherPrompts: STRING_ARRAY_SCHEMA,
    learnerActions: STRING_ARRAY_SCHEMA,
    guideGuardrails: STRING_ARRAY_SCHEMA,
    evidenceToNotice: STRING_ARRAY_SCHEMA,
    productiveStruggle: { type: "string" },
    teachingContent: { type: "string" },
    respondsToFirstAttempt: { type: "string" },
    reflectionPrompt: { type: "string" },
    transferTask: { type: "string" },
  },
  required: [
    "stageNumber",
    "stageKey",
    "title",
    "purpose",
    "experience",
    "teacherPrompts",
    "learnerActions",
    "guideGuardrails",
    "evidenceToNotice",
    "productiveStruggle",
    "teachingContent",
    "respondsToFirstAttempt",
    "reflectionPrompt",
    "transferTask",
  ],
};

export const HQLS_LESSON_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    lessonIntent: { type: "string" },
    stages: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: HQLS_STAGE_JSON_SCHEMA,
    },
  },
  required: ["title", "lessonIntent", "stages"],
};

const HQLS_CONSTITUTIONAL_RULES = `
You are operating inside KAEC School Intelligence under the Human Quest Learning System (HQLS).
The learner is the HERO. The teacher is the GUIDE. The problem is the VILLAIN.
The exact lesson sequence is immutable:
1 Awakening → 2 Exploration → 3 Micro-Illumination → 4 Trial — First Attempt → 5 Full Illumination → 6 Trial — Second Attempt → 7 Integration.

NON-NEGOTIABLE LAW:
- Do not start with definitions, notes, formulas, rules, laws or topic explanation.
- Do not give full explanations before learners make a meaningful first attempt.
- Struggle must come before full clarity, but struggle must have guardrails.
- Exploration must allow crude, incomplete or wrong thinking without premature correction.
- Micro-Illumination gives only minimal orientation, never a worked solution or lecture.
- Trial 1 must require real cognitive effort. The Guide must not rescue, solve or correct during the attempt.
- Full Illumination happens only after Trial 1 and directly addresses the gaps/misconceptions the first attempt is designed to expose.
- Trial 2 must require genuine re-application so improvement is observable.
- Integration must include reflection on changed thinking and transfer beyond the immediate lesson.
- Preserve learner dignity and learner cognitive ownership throughout.
- There is no HQLS Lite.
`;

const HQLS_MODULE_RULES = `
Return a practical teacher-ready HQLS lesson as structured data.
Every stage must include:
- a concrete learning experience/task;
- exact teacher prompts/actions where useful;
- expected learner actions;
- Guide Guardrails describing what the teacher must not do;
- observable evidence the teacher should notice.
Use productiveStruggle only where struggle is meaningful; use an empty string elsewhere.
Use teachingContent only for Stage 5 Full Illumination; it must be clear, sufficient, concise and targeted rather than a lecture dump.
Use respondsToFirstAttempt in Stage 5 to state exactly which likely gaps from Trial 1 the teaching addresses; use an empty string elsewhere.
Use reflectionPrompt only for Stage 7 Integration. It must explicitly ask learners to reflect on how their thinking, understanding or approach changed; use an empty string elsewhere.
Use transferTask only for Stage 7 Integration. It must require application beyond the immediate exercise; use an empty string elsewhere.
For Trial 1, Guide Guardrails must explicitly protect the first attempt from teacher rescue, premature correction or solution-giving, but natural wording is allowed.
Do not invent expensive resources. Prefer activities feasible in ordinary Nigerian/African school conditions unless supplied context says otherwise.
`;

const ACTION_INSTRUCTIONS: Record<HqlsStageAction, string> = {
  improve:
    "Improve the stage for stronger HQLS fidelity, clearer learner ownership and more usable teacher guidance without changing its constitutional purpose.",
  simplify:
    "Simplify language, instructions and logistics while preserving the same intellectual demand and HQLS fidelity. Do not turn the stage into passive recall.",
  increase_challenge:
    "Increase meaningful cognitive challenge and learner reasoning without adding premature teaching or teacher rescue.",
  make_more_practical:
    "Make the stage more practical, realistic and connected to learners' lived environment while preserving its constitutional role.",
  reduce_resource_dependence:
    "Redesign the stage to work with little or no specialised equipment, electricity or internet while preserving learning quality.",
  regenerate:
    "Regenerate the stage from scratch while preserving its exact HQLS constitutional purpose and the lesson context.",
};

function clean(value: string | undefined) {
  return value?.trim() || "Not provided";
}

export function buildHqlsGenerationSystemInstruction() {
  return `${HQLS_CONSTITUTIONAL_RULES}\n${HQLS_MODULE_RULES}`;
}

export function buildHqlsGenerationPrompt(
  input: HqlsLessonRequest,
  sourceLabels: string[],
) {
  return `
Design one complete HQLS lesson for the context below.

SUBJECT: ${input.subject.trim()}
TOPIC: ${input.topic.trim()}
CLASS LEVEL: ${input.classLevel.trim()}
AGE / AGE RANGE: ${input.ageRange.trim()}
DURATION: ${input.durationMinutes} minutes
LESSON OBJECTIVE: ${input.objective.trim()}
PREVIOUS LEARNING: ${clean(input.previousLearning)}
AVAILABLE RESOURCES / CONSTRAINTS: ${clean(input.availableResources)}
CLASS CONTEXT: ${clean(input.classContext)}
TEACHER INSTRUCTIONS: ${clean(input.teacherInstructions)}
AUTHORISED SOURCE MATERIALS: ${sourceLabels.length ? sourceLabels.join(", ") : "None selected"}

Design the seven stages in exact constitutional order. Stage 4 must expose specific likely gaps that Stage 5 can then address explicitly. Stage 6 must make improvement from Stage 4 observable. Stage 7 must populate both reflectionPrompt and transferTask so reflection and transfer are explicit rather than ceremonial.
`;
}

export function buildHqlsRepairPrompt(
  input: HqlsLessonRequest,
  lesson: GeneratedHqlsLesson,
  validation: HqlsValidationResult,
) {
  return `
The draft below failed deterministic HQLS fidelity validation. Repair only what is necessary while keeping the lesson context and useful content intact.

CONTEXT:
Subject: ${input.subject}
Topic: ${input.topic}
Class: ${input.classLevel}
Age: ${input.ageRange}
Duration: ${input.durationMinutes} minutes
Objective: ${input.objective}

VALIDATION FAILURES:
${validation.violations.map((item) => `- ${item.code}: ${item.message}`).join("\n")}

DRAFT JSON:
${JSON.stringify(lesson)}

Return the full corrected seven-stage lesson. Never move Full Illumination before Trial 1. Stage 7 must keep an explicit reflectionPrompt and a distinct transferTask.
`;
}

export function buildStageRegenerationPrompt(args: {
  lesson: GeneratedHqlsLesson;
  targetStage: HqlsStageContent;
  action: HqlsStageAction;
  lessonContext: string;
}) {
  const definition = HQLS_STAGES[args.targetStage.stageNumber - 1];
  return `
Revise ONLY Stage ${definition.index} — ${definition.title} of the HQLS lesson below.
Action requested: ${ACTION_INSTRUCTIONS[args.action]}

Constitutional purpose: ${definition.purpose}
Non-negotiable behaviour: ${definition.nonNegotiable}

LESSON CONTEXT:
${args.lessonContext}

CURRENT FULL LESSON JSON (use it only to preserve continuity):
${JSON.stringify(args.lesson)}

CURRENT TARGET STAGE JSON:
${JSON.stringify(args.targetStage)}

Return only one stage object with stageNumber ${definition.index} and stageKey "${definition.key}". Do not rewrite any other stage. Stage 5 must remain responsive to Trial 1; Stage 6 must remain a genuine re-application; Stage 7 must retain both explicit changed-thinking reflection and transfer.
`;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }
  return value.trim();
}

function readStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

export function parseHqlsStageContent(
  value: unknown,
  expectedIndex?: number,
): HqlsStageContent {
  const record = asRecord(value, "HQLS stage");
  const rawNumber = record.stageNumber;
  if (!Number.isInteger(rawNumber) || Number(rawNumber) < 1 || Number(rawNumber) > 7) {
    throw new Error("stageNumber must be an integer from 1 to 7.");
  }
  const stageNumber = Number(rawNumber) as HqlsStageContent["stageNumber"];
  if (expectedIndex && stageNumber !== expectedIndex) {
    throw new Error(`Expected HQLS stage ${expectedIndex}, received stage ${stageNumber}.`);
  }

  const definition = HQLS_STAGES[stageNumber - 1];
  const stageKey = readString(record, "stageKey") as HqlsStageKey;
  if (stageKey !== definition.key) {
    throw new Error(
      `HQLS stage ${stageNumber} must use stageKey "${definition.key}".`,
    );
  }

  return {
    stageNumber,
    stageKey,
    title: readString(record, "title") || definition.title,
    purpose: readString(record, "purpose") || definition.purpose,
    experience: readString(record, "experience"),
    teacherPrompts: readStringArray(record, "teacherPrompts"),
    learnerActions: readStringArray(record, "learnerActions"),
    guideGuardrails: readStringArray(record, "guideGuardrails"),
    evidenceToNotice: readStringArray(record, "evidenceToNotice"),
    productiveStruggle: readString(record, "productiveStruggle"),
    teachingContent: readString(record, "teachingContent"),
    respondsToFirstAttempt: readString(record, "respondsToFirstAttempt"),
    reflectionPrompt: readString(record, "reflectionPrompt"),
    transferTask: readString(record, "transferTask"),
  };
}

export function parseGeneratedHqlsLesson(value: unknown): GeneratedHqlsLesson {
  const record = asRecord(value, "Generated HQLS lesson");
  if (!Array.isArray(record.stages) || record.stages.length !== 7) {
    throw new Error("A generated HQLS lesson must contain exactly seven stages.");
  }

  return {
    title: readString(record, "title"),
    lessonIntent: readString(record, "lessonIntent"),
    stages: record.stages.map((stage, index) =>
      parseHqlsStageContent(stage, index + 1),
    ),
  };
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function validateHqlsLesson(
  lesson: GeneratedHqlsLesson,
): HqlsValidationResult {
  const violations: HqlsViolation[] = [];
  const evidence: string[] = [];
  const perStage = new Map<HqlsStageKey, string[]>();
  HQLS_STAGES.forEach((stage) => perStage.set(stage.key, []));

  function fail(stageKey: HqlsStageKey, code: string, message: string) {
    violations.push({ code, stageKey, message });
    perStage.get(stageKey)?.push(message);
  }

  if (lesson.stages.length !== 7) {
    throw new Error("HQLS validation requires all seven stages.");
  }

  lesson.stages.forEach((stage, index) => {
    const definition = HQLS_STAGES[index];
    if (stage.stageNumber !== definition.index || stage.stageKey !== definition.key) {
      fail(
        definition.key,
        "stage_order_mismatch",
        `Stage ${definition.index} must remain ${definition.title} in constitutional order.`,
      );
    }
    if (!stage.experience || stage.learnerActions.length === 0) {
      fail(
        definition.key,
        "learner_activity_missing",
        `${definition.title} must make learner activity visible.`,
      );
    }
    if (stage.guideGuardrails.length === 0) {
      fail(
        definition.key,
        "guide_guardrail_missing",
        `${definition.title} must include explicit Guide Guardrails that protect learner ownership.`,
      );
    }
    if (stage.evidenceToNotice.length === 0) {
      fail(
        definition.key,
        "observable_evidence_missing",
        `${definition.title} must tell the Guide what learner evidence to notice.`,
      );
    }
    if (stage.stageNumber !== 5 && stage.teachingContent.length > 0) {
      fail(
        definition.key,
        "teaching_content_outside_full_illumination",
        `${definition.title} may not contain full teaching content; Full Illumination is the teaching stage.`,
      );
    }
  });

  const awakening = lesson.stages[0];
  const awakeningText = [awakening.experience, ...awakening.teacherPrompts].join(" ");
  if (
    includesAny(awakeningText, [
      /today we are learning/i,
      /is defined as/i,
      /the formula is/i,
      /the rule is/i,
      /copy (?:this|the) note/i,
    ])
  ) {
    fail(
      "awakening",
      "awakening_starts_with_content_dump",
      "Awakening appears to begin with explanation, definition, rule or notes instead of curiosity/tension.",
    );
  }
  evidence.push(
    "Awakening is checked for problem-first entry and explicit absence of premature teaching content.",
  );

  const exploration = lesson.stages[1];
  const explorationText = [exploration.experience, ...exploration.teacherPrompts].join(" ");
  if (
    includesAny(explorationText, [
      /that(?:'s| is) wrong/i,
      /incorrect answer/i,
      /the correct answer/i,
      /let me correct/i,
    ])
  ) {
    fail(
      "exploration",
      "exploration_corrects_too_early",
      "Exploration must permit crude or wrong thinking without premature correction.",
    );
  }

  const micro = lesson.stages[2];
  if (micro.guideGuardrails.length === 0) {
    fail(
      "micro_illumination",
      "micro_guardrail_missing",
      "Micro-Illumination needs an explicit Guide Guardrail that protects learner struggle.",
    );
  }
  evidence.push(
    "Micro-Illumination is checked structurally for minimal guidance without teaching content, rather than by an arbitrary prompt-count limit.",
  );

  const trialFirst = lesson.stages[3];
  if (trialFirst.productiveStruggle.length < 20) {
    fail(
      "trial_first",
      "trial_first_has_no_productive_struggle",
      "Trial 1 must state the productive struggle expected from learners.",
    );
  }
  evidence.push(
    "Trial 1 is checked for real cognitive effort, no teaching content and explicit Guide Guardrails; natural guardrail wording is accepted.",
  );

  const illumination = lesson.stages[4];
  if (illumination.teachingContent.length < 80) {
    fail(
      "full_illumination",
      "full_illumination_insufficient",
      "Full Illumination must contain enough targeted teaching content to produce clarity after effort.",
    );
  }
  if (illumination.respondsToFirstAttempt.length < 25) {
    fail(
      "full_illumination",
      "full_illumination_ignores_revealed_gaps",
      "Full Illumination must explicitly connect its teaching to gaps exposed by Trial 1.",
    );
  }
  evidence.push(
    "Full Illumination is checked for adequate targeted teaching and an explicit Trial 1 gap connection.",
  );

  const trialSecond = lesson.stages[5];
  if (trialSecond.learnerActions.length === 0 || trialSecond.evidenceToNotice.length === 0) {
    fail(
      "trial_second",
      "trial_second_has_no_genuine_reattempt",
      "Trial 2 must require learner re-application and make improvement observable.",
    );
  }
  evidence.push(
    "Trial 2 is checked for learner re-application, observable evidence and return of cognitive ownership after illumination.",
  );

  const integration = lesson.stages[6];
  if (integration.reflectionPrompt.length < 20) {
    fail(
      "integration",
      "integration_reflection_missing",
      "Integration must contain an explicit prompt for learners to reflect on how their thinking, understanding or approach changed.",
    );
  }
  if (integration.transferTask.length < 20) {
    fail(
      "integration",
      "integration_transfer_missing",
      "Integration needs a substantive real-life, future or new-context transfer task/question.",
    );
  }
  evidence.push(
    "Integration is checked through dedicated reflectionPrompt and transferTask fields, avoiding fragile keyword guessing.",
  );

  const stageValidation = Object.fromEntries(
    HQLS_STAGES.map((stage) => {
      const stageViolations = perStage.get(stage.key) ?? [];
      return [
        stage.key,
        { passed: stageViolations.length === 0, violations: stageViolations },
      ];
    }),
  ) as Record<HqlsStageKey, HqlsStageValidation>;

  return {
    passed: violations.length === 0,
    score: Math.max(0, 100 - violations.length * 12),
    violations,
    evidence,
    stageValidation,
  };
}

export function toLessonStageInputs(
  lesson: GeneratedHqlsLesson,
  validation: HqlsValidationResult,
) {
  return lesson.stages.map((stage) => ({
    index: stage.stageNumber,
    key: stage.stageKey,
    content: stage as unknown as Record<string, unknown>,
    validation: validation.stageValidation[stage.stageKey] as unknown as Record<
      string,
      unknown
    >,
  }));
}

export function lessonContextSummary(args: {
  subject: string;
  classLevel: string;
  topic: string;
  objective: string;
  ageRange?: string | null;
  durationMinutes?: number | null;
}) {
  return [
    `Subject: ${args.subject}`,
    `Class: ${args.classLevel}`,
    `Topic: ${args.topic}`,
    `Objective: ${args.objective}`,
    `Age: ${args.ageRange || "Not provided"}`,
    `Duration: ${args.durationMinutes ? `${args.durationMinutes} minutes` : "Not provided"}`,
  ].join("\n");
}
