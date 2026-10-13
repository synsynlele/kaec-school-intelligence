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
  // The objective is a whole-lesson requirement, not a demand that Trial 1
  // already contain every formal category. Check Trial 1 only when it explicitly
  // requires this category; the independent review handles dependent-set reuse.
  const firstRequires = /\breflexive\b/i.test([first?.experience, ...(first?.learnerActions ?? [])].join(" "));
  for (const stage of [firstRequires ? first : undefined, teaching]) {
    if (!stage) continue;
    const content = stage.stageNumber === 4 ? stage.experience : [stage.experience, stage.teachingContent].join("\n");
    if (!form.test(content)) issues.push({ stageNumber: stage.stageNumber, category: "task_integrity", repairScope: "materials_chain",
      evidence: stage.stageNumber === 4 ? stage.experience : stage.teachingContent,
      evidenceMatch: "required_form_absent",
      correction: stage.stageNumber === 4
        ? "Reflexive identification is required, but no English reflexive form occurs in the Trial 1 material. Supply an actual example such as 'Mary taught herself to play the piano.' Keep any declared set and dependent uses consistent; printed cards are optional."
        : "Reflexive identification is required, but no English reflexive form occurs in the teaching examples. Supply a worked example such as 'She washed herself.' and explain that herself refers back to She; reconcile the learner card set and follow-up pools.",
    });
  }
  return issues;
}
