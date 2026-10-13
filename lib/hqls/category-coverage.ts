import type { GeneratedHqlsLesson } from "./engine";

export type CoverageContext = { subject?: string; objective?: string };

// Presence is necessary, not sufficient: the independent reviewer still checks
// sentence context, grammatical role and whether these are usable task examples.
export function checkRequiredReflexiveForms(lesson: GeneratedHqlsLesson, context: CoverageContext = {}) {
  if (!/\benglish\b/i.test(context.subject ?? "")) return [];
  const first = lesson.stages.find((stage) => stage.stageNumber === 4);
  const teaching = lesson.stages.find((stage) => stage.stageNumber === 5);
  const second = lesson.stages.find((stage) => stage.stageNumber === 6);
  const requested = /\breflexive\b/i.test(context.objective ?? "") ||
    /\breflexive\b/i.test([second?.experience, ...(second?.learnerActions ?? [])].join(" "));
  if (!requested) return [];
  const form = /\b(?:myself|yourself|yourselves|himself|herself|itself|ourselves|themselves|oneself)\b/i;
  const issues = [];
  for (const stage of [first, teaching]) {
    if (!stage) continue;
    const content = stage.stageNumber === 4 ? stage.experience : [stage.experience, stage.teachingContent].join("\n");
    if (!form.test(content)) issues.push({ stageNumber: stage.stageNumber, category: "task_integrity", repairScope: "materials_chain",
      evidence: stage.stageNumber === 4 ? stage.experience : stage.teachingContent,
      evidenceMatch: "required_form_absent",
      correction: stage.stageNumber === 4
        ? "Reflexive identification is required, but no English reflexive form occurs in the Trial 1 material. Supply a sentence card such as 'Mary taught herself to play the piano.' Replace an appropriate entry to retain the declared count and reconcile all dependent pools."
        : "Reflexive identification is required, but no English reflexive form occurs in the teaching examples. Supply a worked example such as 'She washed herself.' and explain that herself refers back to She; reconcile the learner card set and follow-up pools.",
    });
  }
  return issues;
}
