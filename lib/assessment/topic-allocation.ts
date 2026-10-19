import type { AssessmentItemCounts } from "./engine";

export const QUESTION_FORMAT_KEYS = [
  "objective",
  "subjective",
  "critical_thinking",
  "project",
] as const;

export const ZERO_TOPIC_QUESTION_COUNTS: Readonly<AssessmentItemCounts> = {
  objective: 0,
  subjective: 0,
  critical_thinking: 0,
  project: 0,
};

export type TopicAllocation = {
  topic: string;
  itemCounts?: AssessmentItemCounts;
};

export function expectedQuestionCounts(
  mode: "objective" | "subjective" | "critical_thinking" | "project" | "mixed",
  totalItems: number,
  mixedCounts: AssessmentItemCounts,
): AssessmentItemCounts {
  if (mode === "mixed") return { ...mixedCounts };
  return {
    objective: mode === "objective" ? totalItems : 0,
    subjective: mode === "subjective" ? totalItems : 0,
    critical_thinking: mode === "critical_thinking" ? totalItems : 0,
    project: mode === "project" ? totalItems : 0,
  };
}

export function topicAllocationTotals(
  topics: readonly TopicAllocation[],
): AssessmentItemCounts {
  const totals = { ...ZERO_TOPIC_QUESTION_COUNTS };
  for (const topic of topics) {
    for (const key of QUESTION_FORMAT_KEYS) {
      totals[key] += topic.itemCounts?.[key] ?? 0;
    }
  }
  return totals;
}

export function topicAllocationIssues(
  topics: readonly TopicAllocation[],
  expected: AssessmentItemCounts,
  totalItems: number,
): string[] {
  const issues: string[] = [];
  if (topics.length > totalItems) {
    issues.push("The number of topics cannot exceed the total number of questions when each topic must be assessed.");
  }
  for (const [index, topic] of topics.entries()) {
    const counts = topic.itemCounts;
    if (!counts) {
      issues.push(`Set question counts for Topic ${index + 1}.`);
      continue;
    }
    const valid = QUESTION_FORMAT_KEYS.every(
      (key) => Number.isInteger(counts[key]) && counts[key] >= 0 && counts[key] <= 60,
    );
    if (!valid) {
      issues.push(`Topic ${index + 1} needs valid non-negative whole-number question counts.`);
      continue;
    }
    const count = QUESTION_FORMAT_KEYS.reduce((sum, key) => sum + counts[key], 0);
    if (!count) {
      issues.push(`Topic ${index + 1} needs at least one question. Remove the topic if it should not be tested.`);
    }
  }
  const sums = topicAllocationTotals(topics);
  const total = QUESTION_FORMAT_KEYS.reduce((sum, key) => sum + sums[key], 0);
  if (total !== totalItems) {
    issues.push(`Topic question allocations total ${total}, but the assessment requires ${totalItems} questions.`);
  }
  for (const key of QUESTION_FORMAT_KEYS) {
    if (sums[key] !== expected[key]) {
      issues.push(`Topic allocations include ${sums[key]} ${key.replace("_", " ")} questions; the selected question mix requires ${expected[key]}.`);
    }
  }
  return issues;
}

/**
 * Marks are allocated only for formats that the teacher actually selected.
 * A format with zero questions must never require a mark value.
 */
export function activeQuestionTypes(
  counts: AssessmentItemCounts,
): Array<keyof AssessmentItemCounts> {
  return QUESTION_FORMAT_KEYS.filter((key) => counts[key] > 0);
}

export function marksTotalForActiveTypes(
  counts: AssessmentItemCounts,
  marksByType: AssessmentItemCounts,
): number {
  return activeQuestionTypes(counts).reduce(
    (sum, key) => sum + counts[key] * marksByType[key],
    0,
  );
}

/**
 * Parse only selected formats from an incoming teacher allocation.
 * Obsolete/hidden values from unselected formats are deliberately ignored.
 */
export function parseActiveTypeMarks(
  value: unknown,
  selectedQuestionCounts: AssessmentItemCounts,
): AssessmentItemCounts {
  const provided = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const marks = { ...ZERO_TOPIC_QUESTION_COUNTS };
  for (const key of activeQuestionTypes(selectedQuestionCounts)) {
    const raw = provided[key];
    const next = (typeof raw === "number" || (typeof raw === "string" && raw.trim()))
      ? Number(raw)
      : Number.NaN;
    if (!Number.isInteger(next) || next < 1 || next > 100) {
      throw new Error(`Enter between 1 and 100 marks for each selected ${key.replace("_", " ")} question.`);
    }
    marks[key] = next;
  }
  return marks;
}
