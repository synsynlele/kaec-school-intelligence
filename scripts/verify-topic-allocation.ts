import {
  activeQuestionTypes,
  expectedQuestionCounts,
  marksTotalForActiveTypes,
  parseActiveTypeMarks,
  topicAllocationIssues,
  topicAllocationTotals,
} from "../lib/assessment/topic-allocation";
import { readFile } from "node:fs/promises";

async function main() {
const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const mixed = { objective: 4, subjective: 1, critical_thinking: 2, project: 1 };
const topics = [
  { topic: "Fractions", itemCounts: { objective: 2, subjective: 0, critical_thinking: 1, project: 0 } },
  { topic: "Percentages", itemCounts: { objective: 2, subjective: 1, critical_thinking: 1, project: 1 } },
];

assert(topicAllocationIssues(topics, mixed, 8).length === 0, "Valid topic-question allocation was rejected.");
const totals = topicAllocationTotals(topics);
assert(JSON.stringify(totals) === JSON.stringify(mixed), "Topic totals are not aggregated accurately.");
assert(
  expectedQuestionCounts("subjective", 3, mixed).subjective === 3 &&
  expectedQuestionCounts("subjective", 3, mixed).objective === 0,
  "Single-format question allocation must override the mixed question counts.",
);
assert(
  topicAllocationIssues(topics, mixed, 9).some((issue) => issue.includes("total 8")),
  "A total-items mismatch must be rejected.",
);
assert(
  topicAllocationIssues(topics, { ...mixed, critical_thinking: 3 }, 9)
    .some((issue) => issue.includes("critical thinking")),
  "Wrong topic-by-type allocation must be rejected.",
);
assert(
  topicAllocationIssues([{ topic: "Fractions", itemCounts: { objective: 0, subjective: 0, critical_thinking: 0, project: 0 } }], expectedQuestionCounts("objective", 1, mixed), 1)
    .some((issue) => issue.includes("at least one question")),
  "Every topic must receive a question or be removed.",
);
assert(
  topicAllocationIssues([
    { topic: "Fractions", itemCounts: { objective: 1, subjective: 0, critical_thinking: 0, project: 0 } },
    { topic: "Percentages", itemCounts: { objective: 0, subjective: 0, critical_thinking: 0, project: 0 } },
  ], expectedQuestionCounts("objective", 1, mixed), 1)
    .some((issue) => issue.includes("number of topics")),
  "Assessments cannot require more represented topics than available questions.",
);
// Only two formats are selected: unused Objective/Project values are not required.
const selected = { objective: 0, subjective: 3, critical_thinking: 2, project: 0 };
const applicable = activeQuestionTypes(selected);
assert(applicable.length === 2 && applicable.includes("subjective") &&
  applicable.includes("critical_thinking") && !applicable.includes("objective") &&
  !applicable.includes("project"), "Only selected formats should have marks controls.");

const parsed = parseActiveTypeMarks({ subjective: 5, critical_thinking: 8 }, selected);
assert(parsed.subjective === 5 && parsed.critical_thinking === 8 &&
  parsed.objective === 0 && parsed.project === 0,
  "Inactive question formats must not require marks and must remain zero.");
assert(marksTotalForActiveTypes(selected, parsed) === 31,
  "Teacher-selected marks must total 3×5 + 2×8 = 31.");
assert(marksTotalForActiveTypes(selected, { ...parsed, objective: 100, project: 100 }) === 31,
  "Hidden inactive marks must never affect the assessment total.");
const ignoredValues = parseActiveTypeMarks({ objective: 999, subjective: 5, critical_thinking: 8, project: -1 }, selected);
assert(ignoredValues.objective === 0 && ignoredValues.project === 0,
  "Invalid values for unselected question types must be ignored.");

const singleFormat = expectedQuestionCounts("subjective", 4, mixed);
assert(activeQuestionTypes(singleFormat).length === 1 &&
  activeQuestionTypes(singleFormat)[0] === "subjective",
  "Single-format assessments must show only one marks-per-type field.");
assert(marksTotalForActiveTypes(singleFormat, parseActiveTypeMarks({ subjective: 4 }, singleFormat)) === 16,
  "Single-format marks must be counted using only the selected type.");

for (const invalid of [undefined, 0, -1, 101, 1.5, ""]) {
  let rejected = false;
  try { parseActiveTypeMarks({ subjective: invalid, critical_thinking: 8 }, selected); }
  catch { rejected = true; }
  assert(rejected, "Invalid marks for a selected question type must be rejected.");
}

const ui = await readFile("components/assessment/world-class-assessment-client.tsx", "utf8");
const route = await readFile("app/api/assessment-v11/route.ts", "utf8");
const engine = await readFile("lib/assessment/engine.ts", "utf8");
const world = await readFile("lib/assessment/world-class.ts", "utf8");
for (const required of ["topicAllocationMode", "updateTopicItemCount", "topicAllocationIssues", "computedManualMarks", "questionStyleInstructions"]) {
  assert(ui.includes(required), `Missing teacher control in assessment form: ${required}`);
}
for (const required of ["topicAllocationIssues(topics", "topicAllocationMode: input.topicAllocationMode", "markMode: input.markMode", "topicAllocationMode: blueprint.topicAllocationMode"]) {
  assert(route.includes(required), `Missing server-side topic enforcement or blueprint preservation: ${required}`);
}
for (const required of ["topic_question_distribution_mismatch", "topicAllocationText", "ASSESSMENT_PROMPT_v1.5"]) {
  assert(world.includes(required), `Missing generation/validation control: ${required}`);
}
assert(engine.includes("teacher_mark_mismatch") && engine.includes("questionStyleInstructions"),
  "Teacher marking and question-language preferences must persist in generation.");
for (const needle of [
  'ITEM_TYPES.filter((item) => effectiveCounts[item.value] > 0)',
  'activeMarkTypes.some((key)',
  'activeMarkTypes.map((key) => [key, typeMarks[key]])',
]) assert(ui.includes(needle), `Marks UI must ignore unselected question formats: ${needle}`);

assert(route.includes('parseActiveTypeMarks(input.typeMarks, effectiveCounts)'),
  "Server must normalise marks for selected question formats only.");
assert(route.includes('marksTotalForActiveTypes(effectiveCounts, typeMarks)'),
  "Server must calculate marks only from selected formats.");
assert(engine.includes('activeMarkDistributionText(counts, request.typeMarks)'),
  "AI prompt must not ask for marks on unselected formats.");

console.log("Assessment topic-by-format and active question-type marks checks passed.");
 
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
