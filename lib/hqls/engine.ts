import { HQLS_STAGES, type HqlsStageKey } from "@/lib/domain/hqls";

export const HQLS_ENGINE_VERSION = "HQLS_ENGINE_v1.3";
export const HQLS_PROMPT_VERSION = "HQLS_PROMPT_v1.11";

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
The exact lesson sequence is immutable:
1 Awakening → 2 Exploration → 3 Micro-Illumination → 4 Trial — First Attempt → 5 Full Illumination → 6 Trial — Second Attempt → 7 Integration.

STAGES 1–4 — CONTROLLED MYSTERY ARC:
- Do not start with definitions, notes, formulas, rules, laws, topic explanation or the formal name of the lesson topic.
- Do not tell learners what today's topic is before Full Illumination. The teacher knows the topic; the learners should keep wondering what connects the clues until Stage 5.
- Do not give full explanations before learners make a meaningful first attempt.
- Treat Stages 1–4 as one escalating reasoning journey: Curiosity → Hypothesis → Clue → Team Challenge.
- Awakening presents one vivid unresolved situation containing a surprise, contradiction, dilemma, missing piece or result that does not fit normal expectation. Use at most one curiosity question. Learners notice and wonder; they are not asked to solve it yet.
- Exploration stays inside that mystery and elicits learners' crude, incomplete or wrong hypotheses. Ask them to say what they think may be happening and briefly give a reason, clue or experience behind the idea. It remains an oral thinking check: no written/group task, required product or correction.
- Micro-Illumination gives ONE carefully chosen clue, fact, hint, constraint, counterexample or small piece of evidence. It should make learners reconsider, strengthen, weaken or revise an idea without naming the topic or explaining the answer. It is a clue, not a mini-lecture.
- Trial 1 is the climax of the mystery before teaching. Give pairs or small teams a genuinely demanding problem, decision, prediction, explanation or design challenge built from the earlier situation and clue. Require every learner to contribute and the team to agree one shared response. The response must include reasoning or evidence, not only an answer. The teacher does not rescue, solve, correct or reveal the topic during the attempt.
- Before Stage 5, prefer puzzles, cases, surprising demonstrations, conflicting claims, imperfect choices, hidden rules, prediction problems, evidence sorting or real-life dilemmas over routine recall questions.

STAGE 5 — FULL ILLUMINATION:
- Full Illumination occurs after Trial 1.
- Once Stage 5 begins, ALL HQLS restrictions on teaching style end for this stage.
- Treat Stage 5 as a normal, conventional lesson-teaching period.
- The teacher may lecture, explain directly, define terms, give detailed notes, dictate or display notes, write on the board, use a textbook-like explanation, teach formulas/rules/laws, demonstrate procedures, solve worked examples, model answers, correct misconceptions and answer questions.
- Do not force learner-discovery language, Guide/Hero language, productive-struggle language, mandatory learner participation, a special prompt count, a Trial 1 repair format, or any anti-lecture/anti-note rule inside Stage 5.
- The only HQLS structural requirement for Stage 5 is its position after Trial 1. Its teaching style is otherwise unrestricted.
- Make the teaching accurate, age-appropriate, concise and genuinely useful to the stated lesson objective. Cover what the objective requires without turning Stage 5 into an exhaustive textbook chapter.

STAGES 6–7:
- Trial 2 requires genuine re-application so improvement is observable.
- Integration includes reflection on changed thinking and transfer beyond the immediate lesson.
`;

const HQLS_MODULE_RULES = `
Return a practical teacher-ready HQLS lesson as structured data.

PLAIN-ENGLISH RULES FOR EVERY STAGE:
- Write so a teacher can understand the plan immediately without knowing HQLS jargon.
- Use short, direct sentences and everyday words. Avoid vague academic phrases such as "facilitate discussion", "activate prior knowledge", "promote metacognition" or "engage learners" unless you explain exactly what the teacher should do.
- Make every instruction concrete. Say what the teacher says or does, what learners do, what difficulty is expected, and what the teacher should look for. Exploration is an oral prior-thinking check, not an activity or a product to make.
- teacherPrompts must be exact words or actions the teacher can use in class, not abstract labels.
- learnerActions must describe visible learner behaviour using simple verbs such as say, compare, write, draw, solve, explain, choose, build or present.
- guideGuardrails must be simple "Do not..." instructions.
- evidenceToNotice must describe clear signs the teacher can actually observe.
- productiveStruggle must explain the likely difficulty in plain English and why the teacher should allow learners to work through it.

For Stages 1, 2, 3, 4, 6 and 7:
- give a clear classroom moment in 2–4 short sentences; only the Trial stages need a task and an expected product;
- use no more than 4 exact teacher prompts/actions where useful;
- use no more than 4 expected learner actions;
- use no more than 3 Guide Guardrails;
- use no more than 4 observable evidence items.
Use productiveStruggle only where struggle is meaningful; use an empty string elsewhere.
Use teachingContent only for Stage 5.
Use reflectionPrompt only for Stage 7 Integration; use an empty string elsewhere.
Use transferTask only for Stage 7 Integration; use an empty string elsewhere.

STAGE-SPECIFIC CLARITY:
- Stage 1 Awakening — Curiosity: create a short mystery learners can enter immediately. Use a familiar event, object, story, result, image, demonstration, claim or dilemma, but add something surprising, contradictory or incomplete. Use at most one compelling question such as "What do you notice that does not fit what you expected?" The question opens the mystery; it must not ask for the lesson answer. Learners react, notice or wonder. Do not ask what they already know, assign an activity, reveal the topic name or give topic content yet.
- Stage 2 Exploration — Hypothesis: continue the exact same mystery. Invite crude prior ideas orally. Ask at most two open prompts that make learners state what they currently think AND why they think it, for example "What might be happening here?" and "What makes you think that?" Accept conflicting and incomplete ideas. Do not judge, correct, write a solution, assign groups, require a product or turn Exploration into Trial 1.
- Stage 3 Micro-Illumination — Clue: reveal one small clue only: a fact, observation, counterexample, constraint, hint, short data point or tiny demonstration. The clue should force learners to reconsider at least one earlier idea. Ask for one brief reasoning move such as predict, eliminate, strengthen/weaken, revise or choose which hypothesis now seems more plausible. Do not define the concept, state a rule/formula, reveal the formal topic name or provide the solution.
- Stage 4 Trial — First Attempt — Team Challenge: turn the unresolved mystery into a precise collaborative challenge in pairs or small teams. It must demand reasoning, not recall. Require learners to interpret clues/evidence, make a decision/inference/prediction/design/explanation, and justify the team's shared response. Every learner contributes before the team agrees. Make the shared output clear. Do not substitute simultaneous individual work for teamwork. State the likely struggle and what the teacher must not do. Guide Guardrails must protect the team's first attempt from teacher rescue, premature correction, topic-revealing hints or solution-giving.
- Stage 6 Trial — Second Attempt: return to the work from Stage 4. Have learners improve or retry that work using the teaching from Stage 5, so the difference is visible.
- Stage 7 Integration: include 3–5 simple reflection questions in reflectionPrompt and a practical real-life follow-up task in transferTask.

FULL ILLUMINATION — NORMAL LESSON MODE:
Stage 5 is normal teaching, not discovery/facilitation mode. Put the actual lesson content inside teachingContent so the teacher can teach from it directly.

Keep Full Illumination focused but substantial enough to carry the lesson seriously. For an ordinary lesson, aim for roughly 350–550 words; use up to about 700 only when a calculation, procedure, worked example or concept sequence genuinely needs the extra space. Prioritise:
- a clear explanation of the essential concept and why it matters;
- the key definitions, rule/process/formula, relationships or core facts the objective requires;
- one clear worked example, demonstration or model answer when it improves understanding;
- the most important misconception, common error or confusing point to correct;
- a brief real-life or familiar-context connection when useful;
- a concise teaching summary or board-ready takeaway that fixes the main idea in memory.

Write Stage 5 in very clear plain English. Use short paragraphs. Where useful, organise teachingContent with simple text labels followed by a colon, for example:
Meaning:
Key ideas:
Example:
Common mistake:
Real-life connection:
Takeaway:
Use only the labels that genuinely help the lesson. Do not use markdown headings or placeholder phrases such as "teacher explains".

Use enough development to give the lesson intellectual weight: explain the central idea in a connected way rather than reducing it to bare bullet points or fragments. Avoid long introductions, repeated explanations, exhaustive classifications, multiple similar examples and textbook-style padding. The teacher needs a serious teaching core, not a chapter. Keep enough substantive teaching that a competent teacher can deliver the lesson confidently without needing a separate lesson note.

Because the JSON schema is shared across all stages, Stage 5 must still return all schema fields. For Stage 5, experience, teacherPrompts, learnerActions, guideGuardrails, evidenceToNotice, productiveStruggle, respondsToFirstAttempt, reflectionPrompt and transferTask may be empty when they do not naturally belong in a normal lesson. Do not invent HQLS restrictions merely to fill those fields.

Do not invent expensive resources. Prefer activities feasible in ordinary Nigerian/African school conditions unless supplied context says otherwise.
`;

const ACTION_INSTRUCTIONS: Record<HqlsStageAction, string> = {
  improve:
    "Improve the stage for stronger clarity, usefulness and age-appropriate learning while preserving its stage purpose.",
  simplify:
    "Simplify language, instructions and logistics while preserving intellectual correctness and the lesson objective.",
  increase_challenge:
    "Increase meaningful cognitive challenge and learner reasoning while preserving the stage purpose.",
  make_more_practical:
    "Make the stage more practical, realistic and connected to learners' lived environment.",
  reduce_resource_dependence:
    "Redesign the stage to work with little or no specialised equipment, electricity or internet while preserving learning quality.",
  regenerate:
    "Regenerate the stage from scratch while preserving its stage purpose and lesson context.",
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

Design the seven stages in exact order.

Stages 1–4 must feel like one controlled mystery. Stage 1 creates a surprising unresolved situation. Stage 2 collects learners' uncorrected hypotheses and brief reasons. Stage 3 adds one clue that changes the thinking without giving the answer. Stage 4 turns the same mystery into a demanding collaborative first attempt that requires a justified shared response. Do not reveal or explicitly name the lesson topic to learners anywhere before Stage 5. Stage 5 is where the mystery is formally named, explained and taught. Stage 6 returns to the first attempt and improves it after teaching.

IMPORTANT: Write every stage in simple plain English that a teacher can use immediately. Avoid vague directions. Say exactly what happens, what the teacher says or does, what learners do, what struggle is expected, and what the teacher should notice.

Stage 5 Full Illumination is NORMAL LESSON MODE. Write the complete teaching content inside teachingContent. Make it focused, objective-led and substantial enough to give the lesson serious meaning: clearly explain the central concept, include the key terms/rule/process or core facts, one useful example when needed, the main misconception to correct, a brief practical connection where useful, and a short takeaway. Use short paragraphs and simple labels with colons when they improve clarity. Develop the explanation enough that the teacher can teach confidently from it, but do not turn it into a long textbook chapter. Do not write placeholders such as “teacher explains”, and do not pad the lesson with repeated detail.

Stage 6 must make learners apply the now-taught concept again and make the improvement from the first attempt easy to see. Stage 7 must populate both reflectionPrompt and transferTask in plain English.
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

Return the full corrected seven-stage lesson in simple plain English. Never move Full Illumination before Trial 1. Preserve the controlled mystery arc across Stages 1–4: Curiosity → Hypothesis → Clue → Team Challenge. Do not explicitly reveal the lesson topic to learners before Stage 5. Make the pre-illumination reasoning increasingly demanding without turning Exploration into a written/group task or Micro-Illumination into a mini-lecture. Keep every instruction concrete and classroom-ready. Stage 5 remains normal teaching and should formally name/explain the concept and be focused but substantial: enough connected explanation to teach the objective seriously, without unnecessary textbook-length expansion. Stage 7 must keep clear reflection questions and a distinct real-life transfer task.
`;
}

export function buildStageRegenerationPrompt(args: {
  lesson: GeneratedHqlsLesson;
  targetStage: HqlsStageContent;
  action: HqlsStageAction;
  lessonContext: string;
}) {
  const definition = HQLS_STAGES[args.targetStage.stageNumber - 1];
  const actionInstruction =
    definition.index === 5
      ? `${ACTION_INSTRUCTIONS[args.action]} Stage 5 is normal lesson mode: do not reintroduce discovery, anti-lecture, anti-note, mandatory learner-participation, Trial-1-repair or Guide/Hero restrictions. Preserve focused, accurate conventional teaching with enough connected explanation to carry the lesson seriously, written in simple plain English.`
      : ACTION_INSTRUCTIONS[args.action];

  return `
Revise ONLY Stage ${definition.index} — ${definition.title} of the HQLS lesson below.
Action requested: ${actionInstruction}

Stage purpose: ${definition.purpose}
Stage rule: ${definition.nonNegotiable}

LESSON CONTEXT:
${args.lessonContext}

CURRENT FULL LESSON JSON (use it only to preserve continuity):
${JSON.stringify(args.lesson)}

CURRENT TARGET STAGE JSON:
${JSON.stringify(args.targetStage)}

Return only one stage object with stageNumber ${definition.index} and stageKey "${definition.key}". Do not rewrite any other stage. Write the stage in simple plain English with concrete teacher and learner instructions. For Stages 1–4 preserve the controlled mystery and do not explicitly name/reveal the lesson topic to learners. If the target is Stage 1, create one vivid surprising or contradictory unresolved situation with at most one curiosity question; learners notice or wonder rather than explain or solve. If the target is Stage 2, continue that same situation and ask at most two brief oral prompts that draw out learners' crude hypotheses plus a reason or clue behind them; do not set a task, list, comparison, assigned group work or written output. If the target is Stage 3, add one clue/fact/constraint/counterexample that makes learners reconsider earlier ideas and make one brief reasoning move; do not define, explain or reveal the topic. If the target is Stage 4, pairs or small teams must interpret the earlier clues, make a non-routine decision/inference/prediction/design/explanation and justify one shared first attempt with a contribution from every learner; do not assign independent individual work. If the target is Stage 5, teachingContent must formally illuminate the mystery with a focused but substantial normal teaching explanation centred on the lesson objective, with enough connected explanation, one useful example where appropriate, misconception correction and a concise takeaway. Do not add HQLS teaching-style restrictions beyond remaining Stage 5 after Trial 1. Stage 6 must improve or retry the work from Stage 4 after the teaching; Stage 7 must retain clear changed-thinking reflection and a practical transfer task.
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

function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
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
    reflectionPrompt: readOptionalString(record, "reflectionPrompt"),
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

    if (stage.stageNumber === 5) {
      if (!stage.teachingContent.trim()) {
        fail(
          definition.key,
          "full_illumination_teaching_missing",
          "Full Illumination must contain the actual normal lesson teaching content.",
        );
      }
      return;
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
    if (stage.teachingContent.length > 0) {
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
    awakening.teacherPrompts.length > 1 ||
    includesAny([awakening.experience, ...awakening.learnerActions].join(" "), [
      /\b(?:students|learners)\s+(?:will\s+|should\s+)?(?:list|draw|solve|calculate|draft|complete|produce)\b/i,
      /\b(?:work|discuss)\s+in\s+(?:pairs|groups)\b/i,
    ]) ||
    awakening.teacherPrompts.some((prompt) =>
      /^(?:in\s+(?:pairs|groups),?\s+)?(?:list|draw|solve|calculate|draft|complete|produce)\b/i.test(prompt.trim()),
    )
  ) {
    fail(
      "awakening",
      "awakening_becomes_task",
      "Awakening needs one curiosity hook, at most one open question and no assigned task or solution. Explore existing ideas in Stage 2.",
    );
  }
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
    "Awakening is checked for problem-first entry and absence of premature full teaching.",
  );

  const exploration = lesson.stages[1];
  const explorationText = [exploration.experience, ...exploration.teacherPrompts].join(" ");
  const explorationDirections = [exploration.experience, ...exploration.learnerActions].join(" ");
  if (
    exploration.teacherPrompts.length > 2 ||
    includesAny(explorationDirections, [
      /\b(?:students|learners)\s+(?:will\s+|should\s+)?(?:list|write|draw|solve|calculate|draft|design|complete|produce|compare)\b/i,
      /\b(?:work|discuss)\s+in\s+(?:pairs|groups)\b/i,
    ]) ||
    exploration.teacherPrompts.some((prompt) =>
      /^(?:in\s+(?:pairs|groups),?\s+)?(?:list|write|draw|solve|calculate|draft|design|complete|produce|compare)\b/i.test(prompt.trim()),
    )
  ) {
    fail(
      "exploration",
      "exploration_becomes_task",
      "Exploration should briefly hear learners' existing ideas, not assign group work, a list, a comparison, a solution or a product. Save the first task for Trial 1.",
    );
  }
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
    "Micro-Illumination is checked for minimal guidance before the full teaching stage.",
  );

  const trialFirst = lesson.stages[3];
  const firstAttemptText = [trialFirst.experience, ...trialFirst.teacherPrompts, ...trialFirst.learnerActions].join(" ");
  if (
    !includesAny(firstAttemptText, [/\b(?:pairs?|teams?|groups?|partners?)\b/i]) ||
    !includesAny(firstAttemptText, [/\b(?:each|every|share|discuss|agree|joint|together|contribut\w*|take turns|members?)\b/i]) ||
    !includesAny(firstAttemptText, [/\b(?:shared|joint|group|team|together|collaborat\w*)\b/i])
  ) {
    fail(
      "trial_first",
      "trial_first_lacks_teamwork",
      "Trial 1 must give pairs or small teams one shared first attempt with a contribution from every learner.",
    );
  }
  if (trialFirst.productiveStruggle.length < 20) {
    fail(
      "trial_first",
      "trial_first_has_no_productive_struggle",
      "Trial 1 must state the productive struggle expected from learners.",
    );
  }
  evidence.push(
    "Trial 1 is checked for real cognitive effort before normal full teaching begins.",
  );

  const illumination = lesson.stages[4];
  if (illumination.teachingContent.trim()) {
    evidence.push(
      "Full Illumination contains teaching content and is intentionally exempt from HQLS teaching-style validation; normal conventional teaching is allowed without prompt-count, learner-ownership, anti-lecture, anti-note or Trial-1-response constraints.",
    );
  }

  const trialSecond = lesson.stages[5];
  if (trialSecond.learnerActions.length === 0 || trialSecond.evidenceToNotice.length === 0) {
    fail(
      "trial_second",
      "trial_second_has_no_genuine_reattempt",
      "Trial 2 must require learner re-application and make improvement observable.",
    );
  }
  evidence.push(
    "Trial 2 is checked for learner re-application after Full Illumination.",
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
    "Integration is checked through dedicated reflectionPrompt and transferTask fields.",
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
