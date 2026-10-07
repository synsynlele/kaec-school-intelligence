import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HQLS_STAGES } from "../lib/domain/hqls";
import { hqlsStageTimings } from "../lib/hqls/timing";
import { parseHqlsQualityReview, requireObservableObjective } from "../lib/hqls/quality";
import { resolvePdfBranding } from "../lib/pdf/pdf-branding";
import { createHqlsLessonPdf } from "../lib/pdf/hqls-lesson-pdf";
import { createAssessmentPdf } from "../lib/pdf/assessment-pdf";
import { createDiagnosisPdf } from "../lib/pdf/diagnosis-pdf";
import { createInterventionPdf } from "../lib/pdf/intervention-pdf";
import type { GeneratedAssessment } from "../lib/assessment/engine";
import type { GeneratedDiagnosis } from "../lib/diagnosis/engine";

for (let duration = 10; duration <= 240; duration++) {
  const schedule = hqlsStageTimings(duration)!;
  assert.equal(schedule.reduce((sum, item) => sum + item.minutes, 0), duration);
  assert.equal(schedule[6].endMinute, duration);
  assert(schedule.every((item) => item.minutes > 0));
}
assert.equal(hqlsStageTimings(null), null);
assert.throws(() => requireObservableObjective("Everything about the topic"));
requireObservableObjective("Identify three vowel contrasts.");
const notation = "ɪ æ ɑː ɒ ɔː ʊ ʌ ɜː ə aɪ ₦ × ÷ √ ≤ ≥ α β é";
const stages = HQLS_STAGES.map((s) => ({ stageNumber: s.index, stageKey: s.key, title: s.title, purpose: s.purpose, experience: `Listen to ${notation}.`, teacherPrompts: ["Explain your idea."], learnerActions: ["Compare your answers."], guideGuardrails: ["Do not give the answer."], evidenceToNotice: ["Everyone explains."], productiveStruggle: "Compare the evidence.", teachingContent: s.index === 5 ? `Meaning: ${notation}\n${"Complete explanation with evidence. ".repeat(300)}\nEND_OF_TEACHING_NOTE` : "", respondsToFirstAttempt: "Check the earlier attempt.", reflectionPrompt: "What changed?", transferTask: "Practise offline." }));
const lesson = { title: "Unicode lesson", lessonIntent: "Distinguish vowel sounds", stages };
assert.equal(parseHqlsQualityReview({ issues: [] }, lesson).passed, true);
assert.equal(parseHqlsQualityReview({ issues: [{ stageNumber: 1, category: "task_integrity", evidence: stages[0].experience, correction: "Provide a mixed card set." }] }, lesson).passed, false);
assert.throws(() => parseHqlsQualityReview({ issues: [{ stageNumber: 1, category: "subject_accuracy", evidence: "invented quotation", correction: "Change it." }] }, lesson));
const resolvedBranding = resolvePdfBranding(null);
const branding = { workspaceName: "School é", brandLogoJpegBase64: resolvedBranding.logoJpegBase64, hasSchoolLogo: false };
const assessment: GeneratedAssessment = { title: "Symbols", studentInstructions: "Answer carefully.", blueprint: { topicsAndObjectives: ["Notation"], masteryEvidence: [], capabilityEvidence: [], itemDistribution: { objective: 0, subjective: 1, critical_thinking: 0, project: 0 }, difficultyDistribution: { easy: 1, moderate: 0, challenging: 0 }, totalItems: 1, totalMarks: 5 }, items: [{ position: 1, itemType: "subjective", criticalThinkingType: "", topic: "Notation", objective: "Read symbols", competency: "Reading", difficulty: "easy", marks: 5, prompt: notation, options: [], correctAnswer: notation, answerRationale: "Compare symbols.", expectedEvidence: [notation], markingGuide: [notation], deliverable: "", constraints: [] }] };
const diagnosis: GeneratedDiagnosis = { observedEvidence: [], detectedPatterns: [], possibleInterpretations: [], academicSkillStrengths: [{ domain: "academic", statement: notation, evidenceIds: [] }], academicSkillChallenges: [], characterStrengths: [], characterChallenges: [], conciseDiagnosis: notation, schoolAcademicActions: [], parentAcademicActions: [], schoolCharacterActions: [], parentCharacterActions: [], builderGrowthDirection: `${notation} ${"Continue with supported practice. ".repeat(300)} END_OF_GROWTH_DIRECTION`, encouragementNote: "Continue practising.", evidenceLimitations: ["Snapshot only."] };
const dir = mkdtempSync(join(tmpdir(), "ksi-export-"));
const outputs = {
  lesson: createHqlsLessonPdf({ ...branding, title: lesson.title, subject: "English", classLevel: "JSS1", ageRange: "10–12", durationMinutes: 90, topic: "Vowels", objective: lesson.lessonIntent, fidelityScore: 100, sources: [], stages }),
  exam: createAssessmentPdf({ ...branding, subject: "English", classLevel: "JSS1", topic: "Vowels", objective: "Read", durationMinutes: 90, assessment }, "exam"),
  marking: createAssessmentPdf({ ...branding, subject: "English", classLevel: "JSS1", topic: "Vowels", objective: "Read", durationMinutes: 90, assessment }, "marking"),
  diagnosis: createDiagnosisPdf({ ...branding, studentName: "Learner é", className: "JSS1", academicSession: "2026/2027", term: "First", diagnosisMode: "teacher", assessmentTitle: "Evidence", diagnosis, reviewedAt: "2026-10-07", finalisedAt: "2026-10-07" }),
  intervention: createInterventionPdf({ ...branding, studentName: "Learner", className: "JSS1", status: "active", diagnosisSummary: notation, priorityGrowthTarget: "Read symbols", evidenceBasis: notation, schoolIntervention: [], parentIntervention: [], timeframe: "Week", successIndicator: "Accurate reading", reviewDate: "2026-10-14", nextLearningAdjustment: notation }),
};
for (const [name, bytes] of Object.entries(outputs)) {
  const path = join(dir, `${name}.pdf`); writeFileSync(path, bytes);
  const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
  for (const symbol of notation.split(" ")) assert(text.includes(symbol), `${name} lost ${symbol}`);
  if (name === "diagnosis") assert(text.includes("END_OF_GROWTH_DIRECTION"));
  if (name === "lesson") { assert(text.includes("END_OF_TEACHING_NOTE")); assert(text.includes("Suggested:")); assert(!text.includes("100/100")); }
}
assert.throws(() => createHqlsLessonPdf({ ...branding, title: "Unsupported", subject: "English", classLevel: "JSS1", ageRange: "10", durationMinutes: 90, topic: "Test", objective: "Test", fidelityScore: null, sources: [], stages: stages.map((s) => ({ ...s, experience: "unsupported \u{10ffff}" })) }), /no content was removed/);
console.log(`KSI runtime checks passed: timing, objective, grounded review findings and five Unicode PDF exports. Visual fixtures: ${dir}`);
