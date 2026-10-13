import { parseHqlsStageContent, type GeneratedHqlsLesson, type HqlsStageContent } from "./engine";

export function needsCoordinatedRepair(issues: { stageNumber: number; category: string }[]) {
  return new Set(issues.map((issue) => issue.stageNumber)).size > 1 && issues.some((issue) => issue.category === "task_integrity");
}

export function mergeStageRepairs(lesson: GeneratedHqlsLesson, rawStages: unknown[], expectedStages: number[]): GeneratedHqlsLesson {
  const replacements = rawStages.map((raw) => parseHqlsStageContent(raw));
  if (replacements.length !== expectedStages.length ||
    new Set(replacements.map((stage) => stage.stageNumber)).size !== replacements.length ||
    replacements.some((stage) => !expectedStages.includes(stage.stageNumber))) {
    throw new Error("The repair did not return exactly the requested stages. No generated changes were saved.");
  }
  const byNumber = new Map<number, HqlsStageContent>(replacements.map((stage) => [stage.stageNumber, stage]));
  return { ...lesson, stages: lesson.stages.map((stage) => byNumber.get(stage.stageNumber) ?? stage) };
}

export function contentRepairStageNumbers(issues: { stageNumber: number; category: string; correction: string }[]) {
  const stages = new Set(issues.map((issue) => issue.stageNumber));
  if (issues.some((issue) => issue.category === "task_integrity" && /\b(?:take[- ]home|homework|at home|home materials)\b/i.test(issue.correction))) {
    stages.add(4);
    stages.add(7);
  }
  return [...stages].sort((a, b) => a - b);
}
