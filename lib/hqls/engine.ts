import { HQLS_STAGES, type HqlsStageKey } from "@/lib/domain/hqls";

export const HQLS_ENGINE_VERSION = "HQLS_ENGINE_v1.8";
export const HQLS_PROMPT_VERSION = "HQLS_PROMPT_v1.16";

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

STAGES 1–4 — SUSPENSE BEFORE FULL ILLUMINATION:
- Do not start with definitions, notes, formulas, rules, laws, the correct explanation or the formal topic name.
- Keep the formal lesson topic hidden from learners through Stage 4. The teacher knows it; learners should keep wondering what the lesson is really about.
- Related objects, situations, vocabulary clues, examples, images, headlines or fragments MAY appear before Stage 5 when they deepen thinking without plainly giving away the formal topic.
- Do not give the correct meaning, full explanation or worked solution before learners make a meaningful first attempt.
- Treat the opening as one connected flow: Awakening (Curiosity & Meaning) → Exploration (Crude Thinking) → Micro-Illumination (Minimal Clarity) → Trial (First Attempt).
- Awakening puts learners inside one vivid, age-appropriate situation they can imagine or recognise. It may use a short story, headline, image, object, quotation, surprising result or real-life dilemma. Ask at most one central provocative question. Learners wonder, react or take a position, but they do not solve the lesson yet.
- Exploration checks crude knowledge through critical thinking. Stay close to the opening situation and ask 3–5 short oral questions when useful. Expose what learners currently think, what clues/words/ideas they recognise, why they think so and how they connect the situation to life. Wrong, incomplete and conflicting ideas are welcome. The teacher listens; no correction, notes, group task or formal product yet.
- Micro-Illumination gives MINIMAL CLARITY only. Briefly point learners toward the connection, pattern, condition or questions they should keep in mind for Trial 1. It may contain a short orientation plus up to three brief guiding questions, but it must not define the concept, teach the lesson, correct the class, reveal the formal topic or become a separate learner activity.
- Trial 1 is the first real task. Give pairs or small teams a concrete challenge with clear outputs. Learners may sort, classify, predict, explain, decide, design, solve, justify, compare evidence or attempt a meaning using their crude thinking plus the minimal clarity from Stage 3. Expect mistakes and incomplete reasoning. The teacher observes and does not rescue, correct or reveal the formal topic yet.
- Before Stage 5, prefer meaningful cases, images, headlines, word sets, short texts, demonstrations, conflicting claims, prediction problems, evidence sorting and real-life dilemmas over routine recall.

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
- Make every instruction concrete. Say exactly what the teacher says or does, what learners do, what difficulty is expected, and what the teacher should look for. Exploration is an oral prior-thinking check, not an activity or a product to make.
- Keep teacher directions extremely simple. Prefer one action per sentence. A teacher should be able to scan the stage and know immediately: "Say this", "Show this", "Ask this", "Listen for this", or "Put learners into teams and give this challenge."
- teacherPrompts must be short exact words or actions the teacher can use immediately in class, not abstract labels or professional-development language.
- learnerActions must describe visible learner behaviour using simple verbs such as say, compare, write, draw, solve, explain, choose, build or present. Micro-Illumination is the exception: learnerActions may be empty when learners simply receive the tiny clue before Trial 1.
- guideGuardrails must be simple "Do not..." instructions. Micro-Illumination may leave guideGuardrails empty when no extra guardrail is needed beyond giving the clue and moving on.
- evidenceToNotice must describe clear signs the teacher can actually observe. Micro-Illumination may leave evidenceToNotice empty because it is a clue handoff, not an assessment moment.
- productiveStruggle must explain the likely difficulty in plain English and why the teacher should allow learners to work through it.

For Stages 1, 2, 3, 4, 6 and 7:
- give a clear classroom moment in 2–4 short sentences; only the Trial stages need a formal task and an expected product;
- use no more than 5 exact teacher prompts/actions where useful; Stage 1 has at most one central question and Stage 3 has at most three guiding questions;
- use no more than 5 expected learner actions;
- use no more than 3 Guide Guardrails;
- use no more than 4 observable evidence items.
Use productiveStruggle only where struggle is meaningful; use an empty string elsewhere.
Use teachingContent only for Stage 5.
Use reflectionPrompt only for Stage 7 Integration; use an empty string elsewhere.
Use transferTask only for Stage 7 Integration; use an empty string elsewhere.

BENCHMARK TEACHER-PLAN SHAPE:
- Stage 1: experience = what the teacher says/shows as the vivid scenario; teacherPrompts = the one central provocative question; learnerActions = expected student reactions/ideas.
- Stage 2: experience = brief continuation of the same situation; teacherPrompts = 3–5 crude-thinking questions; learnerActions = expected guesses, arguments, comparisons, predictions or experience-based ideas.
- Stage 3: experience = the short minimal-clarity statement/hint; teacherPrompts = up to three guiding questions learners carry into Trial 1; learnerActions should stay minimal because this is not a separate task.
- Stage 4: experience = the actual collaborative task; learnerActions = the 2–4 clear things students must produce/do; productiveStruggle = the mistakes/confusions expected; guideGuardrails = what the teacher must NOT do before Full Illumination.
- Stage 5: teachingContent = the complete lesson note the teacher can teach from directly; respondsToFirstAttempt = the misconceptions/gaps from Trial 1 that this teaching resolves.
- Stage 6: experience = the second-attempt task using the same Stage 4 material or close equivalent; learnerActions = what students now correct/improve/extend; evidenceToNotice = expected improvement; teacherPrompts = feedback questions without taking ownership; respondsToFirstAttempt = the explicit link back to Trial 1.
- Stage 7: reflectionPrompt = 3–5 reflection questions; experience = the identity connection; transferTask = the concrete real-life assignment/application.

STAGE-SPECIFIC CLARITY:
- Stage 1 Awakening (Curiosity & Meaning): begin with one vivid situation learners can picture or recognise. Use a short story, headline, image, object, quotation, surprising result or real-life dilemma when useful. Keep the formal topic name hidden. Ask at most one central question that makes learners wonder, agree/disagree, predict or take a position. Do not define, explain or solve the lesson yet.
- Stage 2 Exploration (Crude Thinking): stay with the opening situation and ask 3–5 short oral questions when the lesson needs them. Surface what learners think is happening, what key clues/words/ideas might mean, why they think so, how the ideas connect and what experience or assumptions they are using. Learners may guess, argue, compare ideas and predict meanings. Wrong answers are allowed. Keep the formal topic name hidden. Do not correct, teach, write notes, assign a formal group task or require a product yet.
- Stage 3 Micro-Illumination (Minimal Clarity): give a very short orientation that narrows attention without giving the answer. You may add up to three brief guiding questions learners should keep in mind during Trial 1. Keep the formal topic name hidden. Do not define the concept, give the correct answer, explain the target ideas one by one, solve the problem or create a separate learner activity. Move directly into Trial 1.
- Stage 4 Trial (First Attempt): give a concrete collaborative task in pairs or small groups. It may use related vocabulary, examples, source text, data or materials, but it must still withhold the formal topic name when that name would solve the suspense. Require 2–4 clear outputs such as sorting/classifying, an attempted meaning, a prediction/decision, an explanation, a design/solution or a real-life connection. Record the expected struggle explicitly. In guideGuardrails state what the teacher must NOT do: no immediate correction, no formal definition/solution yet, no rescuing groups and no topic reveal.
- Stage 6 Trial (Second Attempt): return to the SAME Stage 4 material or a very close equivalent wherever possible. Learners correct, improve, extend or redo the first attempt using the teaching from Stage 5. Make the expected improvement explicit and use teacherPrompts for brief feedback questions that guide without taking ownership.
- Stage 7 Integration (Reflection & Identity): put 3–5 changed-thinking/reflection questions in reflectionPrompt. Use experience as a short identity connection showing what learners are becoming able to understand/do because of the lesson. Use transferTask for a concrete real-life assignment or application beyond the immediate classroom.

FULL ILLUMINATION — NORMAL LESSON MODE:
Stage 5 is normal teaching, not discovery/facilitation mode. Put the actual lesson content inside teachingContent so the teacher can teach from it directly.

Keep Full Illumination focused but substantial enough to carry the lesson seriously. For an ordinary lesson, aim for roughly 400–650 words; use up to about 750 only when a calculation, procedure, worked example, vocabulary set or concept sequence genuinely needs the extra space. Prioritise:
- a clear explanation of the essential concept and why it matters;
- the key definitions, rule/process/formula, relationships or core facts the objective requires;
- one clear worked example, demonstration or model answer when it improves understanding;
- the most important misconception, common error or confusing point to correct;
- a brief real-life or familiar-context connection when useful;
- a concise correct summary or board-ready takeaway that fixes the main idea in memory;
- the common mistakes or misconceptions revealed by the first attempt, corrected explicitly.

Write Stage 5 as a real teacher-ready lesson note in very clear plain English. Use short paragraphs. Where useful, organise teachingContent with simple text labels followed by a colon, for example:
Meaning:
Key ideas / vocabulary:
Example:
Why it matters / application:
Correct summary:
Common mistakes corrected:
Real-life connection:
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

Stages 1–4 must feel like one connected suspense journey:
1. Awakening (Curiosity & Meaning): create one vivid scenario, image/headline/object/story or real-life situation learners can imagine, plus one central provocative question. Keep the formal topic name hidden.
2. Exploration (Crude Thinking): ask 3–5 short oral questions that expose what learners currently think, what clues/words/ideas might mean, why they think so and how the situation connects to life. Allow guesses, arguments and wrong ideas. Do not correct yet.
3. Micro-Illumination (Minimal Clarity): give a very short orientation that points learners toward the connection they need for Trial 1. You may include up to three brief guiding questions to carry into the task. Do not define, teach, correct or reveal the formal topic.
4. Trial — First Attempt: give pairs or small teams a concrete challenge with 2–4 clear outputs. Let learners sort/classify, predict, explain, decide, design, solve, justify, connect ideas or attempt a meaning using the clues available. State the expected struggle and what the teacher must NOT do. Keep the formal topic name hidden through this first attempt.

Stage 5 is the reveal and full teaching. Name the topic clearly there, teach it properly, correct misconceptions and provide a real lesson note. Stage 6 should return to the same first-attempt material or a very close equivalent and make improvement visible. Stage 7 should close with changed-thinking reflection, an identity connection and a concrete real-life assignment/application.

IMPORTANT: Write every stage in very simple plain English that a teacher can use immediately. Teacher directions should be short and operational: "Say...", "Show...", "Ask...", "Listen...", "Put learners in teams...", "Give them...". Avoid abstract teaching language. Say exactly what happens, what learners do, what struggle is expected, and what the teacher should notice.

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

Return the full corrected seven-stage lesson in very simple plain English. Never move Full Illumination before Trial 1. Preserve this exact flow: Awakening = vivid curiosity/meaning scenario with one central question; Exploration = 3–5 oral crude-thinking questions with no correction or product; Micro-Illumination = brief minimal clarity plus at most three guiding questions for Trial 1; Trial 1 = a concrete collaborative first attempt with 2–4 clear outputs, expected struggle and explicit "teacher must not" guardrails. Keep the formal topic name hidden through Stage 4. Stage 5 is the reveal and must contain a proper teacher-ready lesson note with clear explanation, key ideas/vocabulary or process, application, correct summary and common mistakes corrected. Stage 6 should revisit the same first-attempt material and show obvious improvement. Stage 7 must include 3–5 reflection questions, an identity connection and a distinct real-life assignment/application.
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

Return only one stage object with stageNumber ${definition.index} and stageKey "${definition.key}". Do not rewrite any other stage. Write the stage in very simple plain English with short teacher actions. For Stages 1–4 keep the formal topic name hidden. If the target is Stage 1, use one vivid scenario/headline/image/object/story or real-life situation and one central provocative question; no definition, task or solution. If the target is Stage 2, continue from the same situation and ask 3–5 short oral questions that reveal crude thinking, meanings, reasons and life connections; no correction, formal group task or product. If the target is Stage 3, give brief minimal clarity plus at most three guiding questions learners should carry into Trial 1; do not define, correct, solve or create a separate learner activity. If the target is Stage 4, give pairs or small teams a concrete challenge with 2–4 clear outputs, state the expected struggle, and include explicit guardrails saying what the teacher must not do. If the target is Stage 5, teachingContent must reveal/name the topic and provide a proper teacher-ready lesson note: clear explanation, key ideas/vocabulary or process, useful example/application, correct summary and common mistakes corrected. Stage 6 should revisit the same first-attempt material or a very close equivalent and make improvement visible. Stage 7 should keep 3–5 reflection questions, an identity connection and a concrete real-life assignment/application.
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function studentFacingStageText(stage: HqlsStageContent) {
  return [stage.experience, ...stage.teacherPrompts, ...stage.learnerActions].join(" ");
}


function topicRevealCandidates(topic?: string) {
  const cleanTopic = topic?.trim().replace(/\s+/g, " ");
  if (!cleanTopic || cleanTopic.length < 3) return [];

  const candidates = new Set<string>([cleanTopic]);
  const colonParts = cleanTopic
    .split(":")
    .map((item) => item.trim())
    .filter(Boolean);
  if (colonParts.length > 1) candidates.add(colonParts[colonParts.length - 1]);

  const genericPrefixes = [
    /^vocabulary development\s*[-:]?\s*/i,
    /^words? associated with\s+/i,
    /^introduction to\s+/i,
    /^meaning of\s+/i,
    /^concept of\s+/i,
    /^study of\s+/i,
    /^revision of\s+/i,
    /^lesson on\s+/i,
  ];

  for (const value of [...candidates]) {
    let stripped = value;
    for (const prefix of genericPrefixes) {
      stripped = stripped.replace(prefix, "").trim();
    }
    if (stripped.length >= 3) candidates.add(stripped);

    const associated = value.match(/\bassociated with\s+(.+)$/i)?.[1]?.trim();
    if (associated && associated.length >= 3) candidates.add(associated);
  }

  return [...candidates]
    .filter((value) => value.length >= 3)
    .sort((a, b) => b.length - a.length);
}

function topicIsExplicitlyRevealed(stage: HqlsStageContent, topic?: string) {
  const studentText = studentFacingStageText(stage);
  if (
    includesAny(studentText, [
      /today(?:'s| is)?\s+(?:lesson\s+)?topic\s+(?:is|will be)/i,
      /we (?:are|will be) (?:learning|studying|looking at)/i,
      /this (?:idea|concept|topic|lesson) is (?:called|known as)/i,
      /the (?:idea|concept|topic) is called/i,
    ])
  ) {
    return true;
  }

  return topicRevealCandidates(topic).some((candidate) =>
    new RegExp(
      "(^|[^a-z0-9])" + escapeRegExp(candidate) + "([^a-z0-9]|$)",
      "i",
    ).test(studentText),
  );
}

export function validateHqlsLesson(
  lesson: GeneratedHqlsLesson,
  topic?: string,
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

    if (!stage.experience || (stage.stageNumber !== 3 && stage.learnerActions.length === 0)) {
      fail(
        definition.key,
        "learner_activity_missing",
        stage.stageNumber === 3
          ? "Micro-Illumination must contain the tiny clue the teacher gives or shows."
          : `${definition.title} must make learner activity visible.`,
      );
    }
    if (stage.stageNumber !== 3 && stage.guideGuardrails.length === 0) {
      fail(
        definition.key,
        "guide_guardrail_missing",
        `${definition.title} must include explicit Guide Guardrails that protect learner ownership.`,
      );
    }
    if (stage.stageNumber !== 3 && stage.evidenceToNotice.length === 0) {
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
    "Awakening is checked for problem-first entry, no assigned task and absence of premature teaching; mystery quality is governed by the HQLS generation contract rather than brittle keyword matching.",
  );

  const exploration = lesson.stages[1];
  const explorationText = [exploration.experience, ...exploration.teacherPrompts].join(" ");
  const explorationDirections = [exploration.experience, ...exploration.learnerActions].join(" ");
  if (
    exploration.teacherPrompts.length > 5 ||
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
      "Exploration may ask several short oral questions, but it must not assign group work, written work, a formal comparison, a solution or a product. Save the first real task for Trial 1.",
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
  evidence.push(
    "Exploration is structurally checked as an oral crude-thinking stage with no correction, product or group task; the quality of its critical-thinking questions is governed by the generation contract rather than keyword matching.",
  );

  const micro = lesson.stages[2];
  const microText = studentFacingStageText(micro);
  if (
    includesAny(microText, [
      /is defined as/i,
      /the formula is/i,
      /the rule is/i,
      /this (?:idea|concept) is called/i,
      /the correct answer is/i,
      /therefore the answer is/i,
    ])
  ) {
    fail(
      "micro_illumination",
      "micro_illumination_becomes_full_solution",
      "Micro-Illumination may add a small clue or orientation, but it must not define the concept, state the rule/formula or give the solution.",
    );
  }
  const microActivityText = [
    micro.experience,
    ...micro.teacherPrompts,
    ...micro.learnerActions,
  ].join(" ");
  if (
    includesAny(microActivityText, [
      /\b(?:work|discuss|collaborate)\s+in\s+(?:pairs|groups|teams)\b/i,
      /\bin\s+(?:pairs|groups|teams),?\s+(?:write|solve|calculate|design|produce|create|complete|prepare|present)\b/i,
      /\b(?:students|learners)\s+(?:will\s+|should\s+|must\s+)?(?:write|solve|calculate|design|produce|create|complete|prepare|present)\b/i,
      /\b(?:complete|fill in)\s+(?:the\s+)?(?:worksheet|table|chart|task|exercise)\b/i,
      /\b(?:submit|produce|prepare|present)\s+(?:a|an|the|their)\s+(?:response|answer|report|poster|solution|design|presentation|product)\b/i,
    ])
  ) {
    fail(
      "micro_illumination",
      "micro_illumination_becomes_task",
      "Micro-Illumination may give brief orientation, guiding questions and light learner thinking, but it must not become a formal pair/group, written, problem-solving or product task before Trial 1.",
    );
  }
  evidence.push(
    "Micro-Illumination is checked by function, not field counts: brief orientation, several guiding prompts and light learner responses are allowed; only premature teaching/solution-giving or a distinct formal task is blocked.",
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
    "Trial 1 is structurally checked for pairs/small-team collaboration, contribution from learners, one shared response and explicit productive struggle; the intellectual quality of the challenge and justification is governed by the generation contract rather than keyword matching.",
  );

  const preIlluminationStages = lesson.stages.slice(0, 4);
  for (const stage of preIlluminationStages) {
    if (topicIsExplicitlyRevealed(stage, topic)) {
      fail(
        stage.stageKey,
        "pre_illumination_topic_revealed",
        "Stages 1–4 must preserve suspense. Do not explicitly announce, name or teach the lesson topic to learners before Full Illumination.",
      );
    }
  }
  evidence.push(
    "Stages 1–4 are checked as Curiosity & Meaning → Crude Thinking → Minimal Clarity → First Attempt, with the formal topic concealed until Full Illumination.",
  );
  evidence.push(
    "Trial 1 is checked for collaborative first-attempt structure before normal full teaching begins.",
  );

  const illumination = lesson.stages[4];
  if (illumination.teachingContent.trim()) {
    evidence.push(
      "Full Illumination contains teaching content and is intentionally exempt from HQLS teaching-style validation; normal conventional teaching is allowed without prompt-count, learner-ownership, anti-lecture, anti-note or Trial-1-response constraints.",
    );
  }

  const trialSecond = lesson.stages[5];
  if (
    trialSecond.learnerActions.length === 0 ||
    trialSecond.evidenceToNotice.length === 0 ||
    trialSecond.respondsToFirstAttempt.trim().length < 20
  ) {
    fail(
      "trial_second",
      "trial_second_has_no_genuine_reattempt",
      "Trial 2 must return to the first attempt, require learner re-application and make the improvement observable.",
    );
  }
  evidence.push(
    "Trial 2 is checked for learner re-application after Full Illumination.",
  );

  const integration = lesson.stages[6];
  if (integration.experience.trim().length < 20) {
    fail(
      "integration",
      "integration_identity_connection_missing",
      "Integration must include a short identity connection showing what learners are becoming able to understand, do or contribute because of the lesson.",
    );
  }
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
