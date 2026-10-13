import type { GeneratedHqlsLesson } from "./engine";
import type { CoverageContext } from "./category-coverage";
import { parseHqlsQualityReview } from "./quality";

export type HqlsAdvice = {
  kind: "hqls_content_advice";
  reviewer: "advisory_content_review_v1";
  reviewStatus: "available" | "unavailable";
  attempts: number;
  suggestions: { stageNumber: number; priority: "correct_before_teaching" | "suggestion"; correction: string }[];
  teacherReview: { userId: string; reviewedAt: string } | null;
  stale: boolean;
};

export async function reviewHqlsAdvisory(lesson: GeneratedHqlsLesson, request: () => Promise<unknown>, context: CoverageContext = {}): Promise<HqlsAdvice> {
  let reviewStatus: HqlsAdvice["reviewStatus"] = "available";
  let review: ReturnType<typeof parseHqlsQualityReview>;
  try {
    // Exactly one request. Invalid grounding, refusal and provider failures are
    // review-unavailable, not a reason to discard an otherwise complete lesson.
    review = parseHqlsQualityReview(await request(), lesson, context);
  } catch {
    reviewStatus = "unavailable";
    review = parseHqlsQualityReview({ issues: [] }, lesson, context);
  }
  const suggestions: HqlsAdvice["suggestions"] = [
    ...review.issues.map((issue) => ({ stageNumber: issue.stageNumber, priority: "correct_before_teaching" as const, correction: issue.correction })),
    ...review.warnings.map((issue) => ({ stageNumber: issue.stageNumber, priority: "suggestion" as const, correction: issue.correction })),
  ].filter((item, index, all) => all.findIndex((other) => other.stageNumber === item.stageNumber && other.correction === item.correction) === index);
  return { kind: "hqls_content_advice", reviewer: "advisory_content_review_v1", reviewStatus, attempts: 1, suggestions, teacherReview: null, stale: false };
}

export function readHqlsAdvice(sourceContext: unknown): HqlsAdvice | null {
  if (!Array.isArray(sourceContext)) return null;
  const item = sourceContext.find((value) => value && typeof value === "object" && value.kind === "hqls_content_advice");
  if (!item || !["available", "unavailable"].includes(item.reviewStatus) || !Array.isArray(item.suggestions)) return null;
  return { ...item, suggestions: item.suggestions.filter((value: HqlsAdvice["suggestions"][number]) =>
    value && Number.isInteger(value.stageNumber) && value.stageNumber >= 1 && value.stageNumber <= 7 &&
    ["correct_before_teaching", "suggestion"].includes(value.priority) && typeof value.correction === "string") };
}

export function replaceHqlsAdvice(sourceContext: unknown, advice: HqlsAdvice): unknown[] {
  return [...(Array.isArray(sourceContext) ? sourceContext.filter((value) => !value || typeof value !== "object" || value.kind !== "hqls_content_advice") : []), advice];
}

export function updateTeacherReview(advice: HqlsAdvice, userId: string, markReviewed: boolean): HqlsAdvice {
  return { ...advice, stale: true, teacherReview: markReviewed ? { userId, reviewedAt: new Date().toISOString() } : null };
}

export function hqlsAdviceStatus(fidelityPassed: boolean, sourceContext: unknown): "draft" | "validated" {
  const advice = readHqlsAdvice(sourceContext);
  return fidelityPassed && (!advice || advice.teacherReview) ? "validated" : "draft";
}
