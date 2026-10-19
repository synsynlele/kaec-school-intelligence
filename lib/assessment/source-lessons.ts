import type { AssessmentItemCounts } from "@/lib/assessment/engine";
import { ZERO_TOPIC_QUESTION_COUNTS } from "@/lib/assessment/topic-allocation";

export const MAX_ASSESSMENT_SOURCE_LESSONS = 12;

export type HqlsAssessmentSource = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  subject_id: string | null;
  class_id: string | null;
  status: string;
};

export type LinkedAssessmentTopic = {
  topic: string;
  objective: string;
  weight: number;
  itemCounts: AssessmentItemCounts;
  sourceLessonId?: string;
};

export function parseAssessmentSourceLessonIds(
  rawIds: unknown,
  rawLegacyId: unknown,
): string[] {
  const legacyId = typeof rawLegacyId === "string" ? rawLegacyId.trim() : "";
  if (rawIds !== undefined && !Array.isArray(rawIds)) {
    throw new Error("Source HQLS lessons must be a list.");
  }
  const ids = Array.isArray(rawIds) ? rawIds.map((value) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Every selected HQLS lesson must have a valid id.");
    }
    return value.trim();
  }) : legacyId ? [legacyId] : [];
  if (ids.length > MAX_ASSESSMENT_SOURCE_LESSONS) {
    throw new Error("Select no more than " + MAX_ASSESSMENT_SOURCE_LESSONS + " HQLS lessons.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Select each HQLS lesson only once.");
  }
  if (legacyId && ids[0] !== legacyId) {
    throw new Error("The primary HQLS lesson does not match the selected source lessons.");
  }
  return ids;
}

export function assertCompatibleHqlsSources(
  lessons: readonly HqlsAssessmentSource[],
  requestedTopicNames?: readonly string[],
  subjectId?: string | null,
  classId?: string | null,
): void {
  if (!lessons.length) return;
  if (lessons.length > MAX_ASSESSMENT_SOURCE_LESSONS) {
    throw new Error("Select no more than " + MAX_ASSESSMENT_SOURCE_LESSONS + " HQLS lessons.");
  }
  const first = lessons[0];
  const topicNames = new Set<string>();
  const requested = requestedTopicNames
    ? new Set(requestedTopicNames.map((topic) => topic.trim().toLowerCase()))
    : null;
  for (const lesson of lessons) {
    if (lesson.status !== "validated") {
      throw new Error("Only validated HQLS lessons may be assessment sources.");
    }
    if (lesson.subject_id !== first.subject_id || lesson.class_id !== first.class_id) {
      throw new Error("Select HQLS lessons from the same subject and class for one assessment.");
    }
    const normalizedTopic = lesson.topic.trim().toLowerCase();
    if (!normalizedTopic) {
      throw new Error("A selected HQLS lesson has no topic.");
    }
    if (topicNames.has(normalizedTopic)) {
      throw new Error("Two selected HQLS lessons have the same topic. Choose one lesson per topic.");
    }
    topicNames.add(normalizedTopic);
    if (requested && !requested.has(normalizedTopic)) {
      throw new Error('The topic "' + lesson.topic + '" from a selected HQLS lesson must remain in the assessment blueprint.');
    }
  }
  if (subjectId !== undefined && subjectId !== first.subject_id) {
    throw new Error("The assessment subject must match the selected HQLS lessons.");
  }
  if (classId !== undefined && classId !== first.class_id) {
    throw new Error("The assessment class must match the selected HQLS lessons.");
  }
}

export function reconcileHqlsTopics(
  current: readonly LinkedAssessmentTopic[],
  selectedLessons: readonly HqlsAssessmentSource[],
): LinkedAssessmentTopic[] {
  assertCompatibleHqlsSources(selectedLessons);
  const manual = current.filter((topic) => !topic.sourceLessonId && topic.topic.trim());
  const selected = selectedLessons.map((lesson) => {
    const previous = current.find((topic) => topic.sourceLessonId === lesson.id);
    return previous
      ? { ...previous, topic: lesson.topic }
      : {
          sourceLessonId: lesson.id,
          topic: lesson.topic,
          objective: lesson.objective,
          weight: 0,
          itemCounts: { ...ZERO_TOPIC_QUESTION_COUNTS },
        };
  });
  const merged: LinkedAssessmentTopic[] = [...selected, ...manual];
  if (merged.length > MAX_ASSESSMENT_SOURCE_LESSONS) {
    throw new Error("Use no more than " + MAX_ASSESSMENT_SOURCE_LESSONS + " assessment topics, including manually entered topics.");
  }
  const duplicates = merged.map((topic) => topic.topic.trim().toLowerCase());
  if (new Set(duplicates).size !== duplicates.length) {
    throw new Error("Each assessment topic must be unique. Remove the duplicate manual topic first.");
  }
  const result = merged.length
    ? merged
    : [{ topic: "", objective: "", weight: 100, itemCounts: { ...ZERO_TOPIC_QUESTION_COUNTS } }];
  const baseWeight = Math.floor(100 / result.length);
  let remainder = 100 - baseWeight * result.length;
  return result.map((topic) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { ...topic, weight: baseWeight + extra };
  });
}
