import assert from "node:assert/strict";
import {
  MAX_ASSESSMENT_SOURCE_LESSONS,
  assertCompatibleHqlsSources,
  parseAssessmentSourceLessonIds,
  reconcileHqlsTopics,
} from "../lib/assessment/source-lessons";
import { ZERO_TOPIC_QUESTION_COUNTS } from "../lib/assessment/topic-allocation";
import { readFileSync } from "node:fs";

const lesson = (id: string, topic: string, extra: Record<string, string> = {}) => ({
  id,
  title: topic + " lesson",
  topic,
  objective: "Explain " + topic,
  status: "validated",
  class_id: "class-jss1",
  subject_id: "subject-maths",
  ...extra,
});

const one = lesson("lesson-one", "Fractions");
const two = lesson("lesson-two", "Decimals");
const three = lesson("lesson-three", "Percentages");

assert.deepEqual(parseAssessmentSourceLessonIds(undefined, null), []);
assert.deepEqual(parseAssessmentSourceLessonIds(undefined, "lesson-one"), ["lesson-one"]);
assert.deepEqual(parseAssessmentSourceLessonIds(["lesson-one", "lesson-two"], "lesson-one"), ["lesson-one", "lesson-two"]);
assert.throws(() => parseAssessmentSourceLessonIds(["lesson-one", "lesson-one"], null), /once/);
assert.throws(() => parseAssessmentSourceLessonIds(["lesson-two"], "lesson-one"), /primary HQLS/);
assert.throws(() => parseAssessmentSourceLessonIds([], "lesson-one"), /primary HQLS/);
assert.throws(() => parseAssessmentSourceLessonIds(new Array(13).fill("id").map((v, i) => v + i), null), /no more than/);
assert.throws(() => parseAssessmentSourceLessonIds(["lesson-one", 4], null), /valid id/);
assert.throws(() => parseAssessmentSourceLessonIds("lesson-one", null), /list/);

assert.doesNotThrow(() => assertCompatibleHqlsSources([one, two], ["Fractions", "Decimals"], "subject-maths", "class-jss1"));
assert.throws(() => assertCompatibleHqlsSources([one, lesson("diff-class","Decimals",{class_id:"class-jss2"})]), /same subject and class/);
assert.throws(() => assertCompatibleHqlsSources([one, lesson("diff-subject","Decimals",{subject_id:"subject-english"})]), /same subject and class/);
assert.throws(() => assertCompatibleHqlsSources([one, lesson("unvalidated","Decimals",{status:"draft"})]), /Only validated/);
assert.throws(() => assertCompatibleHqlsSources([one, lesson("dup","fractions")]), /same topic/);
assert.throws(() => assertCompatibleHqlsSources([one, two], ["Fractions"]), /must remain in the assessment blueprint/);
assert.throws(() => assertCompatibleHqlsSources([one], ["Fractions"], "subject-english"), /subject/);
assert.throws(() => assertCompatibleHqlsSources([one], ["Fractions"], "subject-maths", "class-jss2"), /class/);
assert.equal(MAX_ASSESSMENT_SOURCE_LESSONS, 12);

const initial = [{ topic: "", objective: "", weight: 100, itemCounts: { ...ZERO_TOPIC_QUESTION_COUNTS } }];
const imported = reconcileHqlsTopics(initial, [one, two]);
assert.deepEqual(imported.map((topic) => topic.topic), ["Fractions", "Decimals"]);
assert.deepEqual(imported.map((topic) => topic.weight), [50, 50]);
assert.deepEqual(imported.map((topic) => topic.sourceLessonId), ["lesson-one", "lesson-two"]);
assert.deepEqual(imported.map((topic) => topic.objective), ["Explain Fractions", "Explain Decimals"]);

const modified = imported.map((topic) => topic.sourceLessonId === "lesson-one"
  ? { ...topic, objective: "Teacher-edited objective", itemCounts: { ...topic.itemCounts, subjective: 2 } }
  : topic);
const extended = reconcileHqlsTopics(modified, [one, two, three]);
assert.deepEqual(extended.map((topic) => topic.weight), [34, 33, 33]);
assert.equal(extended[0].objective, "Teacher-edited objective");
assert.equal(extended[0].itemCounts.subjective, 2);

const removed = reconcileHqlsTopics(extended, [two, three]);
assert.deepEqual(removed.map((topic) => topic.topic), ["Decimals", "Percentages"]);
const manual = { topic: "Ratio", objective: "Solve ratio problems", weight: 25, itemCounts: { ...ZERO_TOPIC_QUESTION_COUNTS } };
assert.deepEqual(reconcileHqlsTopics([...imported, manual], [one]).map((topic) => topic.topic), ["Fractions","Ratio"]);
assert.throws(() => reconcileHqlsTopics([...imported, { ...manual, topic: "fractions" }], [one,two]), /duplicate manual topic/);
assert.deepEqual(reconcileHqlsTopics(imported, []).map((topic) => topic.topic), [""]);
const original = reconcileHqlsTopics(initial, [one]);
assert.deepEqual(original.map((topic) => topic.topic), ["Fractions"]);

const api = readFileSync("app/api/assessment-v11/route.ts","utf8");
const ui = readFileSync("components/assessment/world-class-assessment-client.tsx","utf8");
const picker = readFileSync("components/assessment/hqls-lesson-picker.tsx","utf8");
for (const required of [
  "parseAssessmentSourceLessonIds",
  "loadSourceLessons(",
  '.eq("workspace_id", workspaceId)',
  '.eq("status", "validated")',
  "assertCompatibleHqlsSources(",
  "sourceLessonIds: input.sourceLessonIds",
  "sourceLessonIds: Array.isArray(blueprint.sourceLessonIds)",
  "...sourceLessons.sourceContext",
  "sourceLessons.context",
]) assert.ok(api.includes(required), "Missing multi-HQLS backend safeguard: " + required);

for (const required of [
  "HqlsLessonPicker",
  "onApply={applySourceLessons}",
  "lessons={state.lessons}",
  "selectedIds={sourceLessonIds}",
  "reconcileHqlsTopics(topics, selected)",
  "sourceLessonIds,",
  "sourceLessonId: sourceLessonIds[0] ?? null",
  "applySourceLessonsFromState",
  "requestedWorkflowLessonIds",
  "topic.sourceLessonId",
  "topicAllocationMode",
  "itemCounts: topic.itemCounts",
]) assert.ok(ui.includes(required), "Missing HQLS multi-topic UX: " + required);

// The HQLS chooser is an isolated, mobile-first modal rather than a
// nested scrollable checkbox list embedded in the assessment form.
for (const required of [
  'createPortal(',
  'document.body,',
  'role="dialog"',
  'aria-modal="true"',
  'aria-labelledby={headingId}',
  'aria-describedby={hintId}',
  'h-[100dvh]',
  'sm:max-w-2xl',
  'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  'pb-[max(1rem,env(safe-area-inset-bottom))]',
  'type="search"',
  'text-base outline-none',
  'aria-label="Search saved HQLS lessons by topic or title"',
  'aria-label="Filter HQLS lessons by subject"',
  'aria-label="Filter HQLS lessons by class"',
  'aria-label="Close HQLS lesson picker"',
  'setDraftIds([...selectedIds])',
  'const error = onApply(draftIds);',
  'onClick={dismissPicker}',
  'event.key === "Escape"',
  'event.key !== "Tab"',
  'document.body.style.overflow = "hidden"',
  'Choose HQLS topics',
  'Edit selected HQLS topics',
  'Use direct context',
  'role="alert"',
  'Clear selection',
  'Show more lessons',
]) assert.ok(picker.includes(required), "Missing mobile lesson-picker behavior: " + required);
assert.ok(!ui.includes('label="Source HQLS lesson (optional)"'),"Legacy single-source picker remains");
assert.ok(!ui.includes('max-h-60 space-y-2 overflow-y-auto'),"Legacy nested-scroll lesson list remains");
console.log("KSI multi-HQLS assessment source and mobile picker checks passed.");
