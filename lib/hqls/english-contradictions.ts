import type { GeneratedHqlsLesson } from "./engine";
import type { CoverageContext } from "./category-coverage";

// Narrow regressions for confirmed wrong teaching/answer keys, not a general
// grammar parser. Unknown phrasing still receives the independent model review.
export function checkKnownEnglishContradictions(lesson: GeneratedHqlsLesson, context: CoverageContext = {}) {
  if (!/\benglish\b/i.test(context.subject ?? "")) return [];
  const issues: { stageNumber: number; category: string; repairScope: string; evidence: string; correction: string; evidenceMatch: string }[] = [];
  for (const stage of lesson.stages.filter((item) => item.stageNumber >= 5)) {
    const fields = [stage.teachingContent, stage.respondsToFirstAttempt, ...stage.evidenceToNotice];
    for (const text of fields) {
      if (/\bproper nouns?\s*\([^)]*\bteacher\b[^)]*\)/i.test(text) &&
          !/\bteacher['’]?\s*(?:is|=|:)\s*(?:a\s+)?common noun\b/i.test(text)) {
        issues.push({ stageNumber: stage.stageNumber, category: "subject_accuracy", repairScope: "stage", evidence: text,
          correction: "Correct the noun classification: teacher is a common noun; Mary is a proper noun. Keep the distinction from pronouns accurate.", evidenceMatch: "known_contradiction" });
      }
      if (/\bI did the work by\s*_+/i.test(stage.experience) &&
          /\b(?:sentence|blank)\s+D\b[^.!?\n]*\bourselves\b/i.test(text) &&
          !/\b(?:not|never|incorrect|reject)\s+ourselves\b/i.test(text)) {
        issues.push({ stageNumber: stage.stageNumber, category: "subject_accuracy", repairScope: "stage", evidence: text,
          correction: "For sentence D, 'I did the work by _____', the answer is myself. Ourselves requires the subject We; remove it from the accepted answers for this sentence.", evidenceMatch: "known_contradiction" });
      }
    }
  }
  return issues;
}
