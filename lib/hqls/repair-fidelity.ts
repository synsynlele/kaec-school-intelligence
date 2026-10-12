import { validateHqlsLesson, type GeneratedHqlsLesson, type HqlsStageContent } from "./engine";
import { mergeStageRepairs } from "./coordinated-repair";

// One bounded repair pass for regressions introduced by a subject/task correction.
// The caller must review the resulting subject/task content again before saving.
export async function repairContentFidelity(
  lesson: GeneratedHqlsLesson,
  topic: string,
  repairStage: (stage: HqlsStageContent, defects: string[]) => Promise<HqlsStageContent>,
) {
  const validation = validateHqlsLesson(lesson, topic);
  if (validation.passed) return { lesson, validation, repairedStages: 0 };
  const failedStages = lesson.stages.filter((stage) => !validation.stageValidation[stage.stageKey]?.passed);
  if (!failedStages.length || failedStages.length > 2) return { lesson, validation, repairedStages: 0 };
  const replacements = await Promise.all(failedStages.map((stage) => repairStage(
    stage, validation.violations.filter((issue) => issue.stageKey === stage.stageKey).map((issue) => `${issue.code}: ${issue.message}`),
  )));
  const repaired = mergeStageRepairs(lesson, replacements, failedStages.map((stage) => stage.stageNumber));
  return { lesson: repaired, validation: validateHqlsLesson(repaired, topic), repairedStages: replacements.length };
}
