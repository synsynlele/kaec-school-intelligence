import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HQLS_STAGES } from "../lib/domain/hqls";
import { hqlsStageTimings } from "../lib/hqls/timing";
import { HqlsQualityGroundingError, HqlsQualityCorrectionError, parseHqlsQualityReview, runHqlsQualityReview, requireObservableObjective } from "../lib/hqls/quality";
import { checkPromisedMaterials } from "../lib/hqls/materials";
import { validateHqlsLesson, buildHqlsGenerationPrompt, lessonContextSummary } from "../lib/hqls/engine";
import { resolveLearningLevel, learningLevelGuidance } from "../lib/domain/learning-level";
import { buildAssessmentPrompt } from "../lib/assessment/engine";
import { buildDiagnosisPrompt } from "../lib/diagnosis/engine";
import { resolvePdfBranding } from "../lib/pdf/pdf-branding";
import { createHqlsLessonPdf } from "../lib/pdf/hqls-lesson-pdf";
import { createAssessmentPdf } from "../lib/pdf/assessment-pdf";
import { createDiagnosisPdf } from "../lib/pdf/diagnosis-pdf";
import { createInterventionPdf } from "../lib/pdf/intervention-pdf";
import type { GeneratedAssessment } from "../lib/assessment/engine";
import type { GeneratedDiagnosis } from "../lib/diagnosis/engine";

async function verifyQuality() {
  for (const [name, age, level] of [
    ["Nursery 1", "3–4", "early_years"], ["KG2", "5", "early_years"],
    ["Primary 4", "8–9", "primary"], ["JSS 1", "11–12", "secondary"],
    ["Primary", "", "primary"], ["Primary1", "", "primary"], ["NCE1", "18–22", "tertiary"],
    ["SS2", "15–16", "secondary"], ["100 Level", "18–22", "tertiary"],
    ["University Year 1", "18–22", "tertiary"], ["Postgraduate", "", "tertiary"],
    ["Year 1", "18–22", "unspecified"], ["Year 1", "5–6", "primary"],
    ["College", "", "unspecified"], ["Adult literacy", "35", "unspecified"],
    ["Custom group", "4–5", "early_years"], ["Custom group", "5–16", "unspecified"],
  ]) assert.equal(resolveLearningLevel(name, age), level, `${name} (${age})`);
  for (const [name, age] of [["Nursery 1", "3–4"], ["Primary 3", "7–8"], ["SS2", "15–16"], ["University 100 Level", "18–22"]]) {
    const level = resolveLearningLevel(name, age);
    const context = { workspaceId: "test", subject: "Example subject", topic: "Example topic", objective: "Explain a choice using evidence", classLevel: name, ageRange: age, durationMinutes: 30 };
    assert(buildHqlsGenerationPrompt(context, []).includes(`; ${level})`));
    assert(lessonContextSummary(context).includes(`; ${level})`));
    assert(buildAssessmentPrompt({ ...context, subjectId: null, classId: null, sourceLessonId: null, resourceIds: [], title: "Practice", assessmentMode: "subjective", totalItems: 1, totalMarks: 5, purpose: "Practice", teacherInstructions: "", itemCounts: { objective: 0, subjective: 1, critical_thinking: 0, project: 0 } }, "", []).includes(`; ${level})`));
    assert(buildDiagnosisPrompt({ studentName: "Fictional learner", className: name, ageRange: age, mode: "quick_teacher", assessmentTitle: "", evidence: [] }).includes(`; ${level})`));
  }
  assert(learningLevelGuidance("Nursery 1").includes("Do not assume independent reading or writing"));
  assert(learningLevelGuidance("100 Level").includes("Do not invent research sources"));
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
  const microCodes = (experience: string, learnerActions: string[] = []) => validateHqlsLesson({ ...lesson,
    stages: stages.map((stage) => stage.stageNumber === 3 ? { ...stage, experience, teacherPrompts: [], learnerActions } : { ...stage }),
  }, "Syllable stress").violations.filter((issue) => issue.stageKey === "micro_illumination").map((issue) => issue.code);
  assert.deepEqual(microCodes("Notice which part of the word your voice makes more noticeable. Do not work in pairs. Do not reveal syllable stress."), []);
  assert(microCodes("Work in pairs and write two answers.").includes("micro_illumination_becomes_task"));
  assert(microCodes("Do not work in pairs; learners must write two answers.").includes("micro_illumination_becomes_task"));
  assert(microCodes("Today the topic is syllable stress.").includes("pre_illumination_topic_revealed"));
  assert(microCodes("Do not write; this concept is called syllable stress.").includes("pre_illumination_topic_revealed"));
  assert(microCodes('Say: "Do not reveal syllable stress."').includes("pre_illumination_topic_revealed"), "Quoted speech still exposes the topic to learners.");
  assert(microCodes("The rule is to stress the first part.").includes("micro_illumination_becomes_full_solution"));
  assert(microCodes("Listen for the noticeable part.", ["Learners produce a poster."]).includes("micro_illumination_becomes_task"));
  const brokenTask = "Put learners in teams of three. Give each team the 16 word cards below. Each team must produce: (1) two piles, (2) a group paragraph, and (3) an individual slip listing five assigned words.";
  const materialLesson = (experience: string) => ({ ...lesson, stages: stages.map((stage) => stage.stageNumber === 4 ? { ...stage, experience } : { ...stage }) });
  const words = ["TAble", "DOCtor", "WINdow", "TEAcher", "GARden", "HAPpy", "PICture", "MARket", "aBOUT", "beGIN", "reLAX", "deCIDE", "aLONE", "inVITE", "toDAY", "beLIEVE"];
  const materialBlock = (items: string[]) => "\nWord cards (16):\n" + items.map((word, index) => `${index + 1}. ${word}`).join("\n");
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask)).length, 1);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask.replace(" below", ""))).length, 1, "Removing 'below' must not evade a direct material assignment.");
  assert.equal(parseHqlsQualityReview({ issues: [] }, materialLesson(brokenTask)).passed, false, "An AI all-clear cannot bypass the material count gate.");
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock(words))).length, 0);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock(words.slice(0, 15)))).length, 1);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock([...words.slice(0, 15), words[0]]))).length, 1);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock([...words.slice(0, 15), "etc."]))).length, 1);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask.replace("16", "sixteen") + materialBlock(words))).length, 0);
  const earlierMaterials = { ...lesson, stages: stages.map((stage) => stage.stageNumber === 1 ? { ...stage, experience: materialBlock(words) } : stage.stageNumber === 4 ? { ...stage, experience: brokenTask.replace("below", "provided in Stage 1") } : stage) };
  assert.equal(checkPromisedMaterials(earlierMaterials).length, 0);
  const answerOnly = materialLesson(brokenTask);
  answerOnly.stages[4].teachingContent = materialBlock(words);
  assert.equal(checkPromisedMaterials(answerOnly).length, 1, "Later teacher answers do not supply Trial 1 materials.");
  assert.equal(checkPromisedMaterials(materialLesson("Three learners each explain their idea." )).length, 0);
  assert.equal(parseHqlsQualityReview({ issues: [] }, lesson).passed, true);
  const pronounFinding = (correction: string) => ({ issues: [{ stageNumber: 5, category: "subject_accuracy", evidence: stages[4].experience, correction }] });
  assert.throws(() => parseHqlsQualityReview(pronounFinding("Pronouns are usually function words but can be content words when contrastively stressed."), lesson), HqlsQualityCorrectionError);
  assert.equal(parseHqlsQualityReview(pronounFinding("Pronouns are not content words merely because they are stressed. Explain that function words can receive contrastive stress."), lesson).passed, false);
  const correctionRetries: boolean[] = [];
  const reviewedCorrection = await runHqlsQualityReview(lesson, async (retry, reason) => {
    correctionRetries.push(retry);
    if (retry) assert(reason?.includes("incorrect reclassification"));
    return retry ? pronounFinding("Function words can receive contrastive stress; pronouns remain function words.") : pronounFinding("Pronouns can be content words when stressed.");
  });
  assert.deepEqual(correctionRetries, [false, true]);
  assert.equal(reviewedCorrection.passed, false, "Re-review must preserve genuine findings rather than silently approving.");
  await assert.rejects(runHqlsQualityReview(lesson, async () => pronounFinding("Pronouns can be content words when stressed.")), HqlsQualityCorrectionError);
  assert.equal(parseHqlsQualityReview({ issues: [{ stageNumber: 1, category: "task_integrity", evidence: stages[0].experience, correction: "Provide a mixed card set." }] }, lesson).passed, false);
  assert.throws(() => parseHqlsQualityReview({ issues: [{ stageNumber: 1, category: "subject_accuracy", evidence: "invented quotation", correction: "Change it." }] }, lesson));
  const finding = (evidence: string, stageNumber = 1) => ({ issues: [{ stageNumber, category: "task_integrity", evidence, correction: "Supply both required categories." }] });
  const quoteLesson = { ...lesson, stages: stages.map((stage) => ({ ...stage,
    experience: stage.stageNumber === 1 ? "Compare the teacher’s ‘steady’ cards.\nExplain 2 + 3 = 6." : stage.experience })) };
  const formatted = parseHqlsQualityReview(finding("Compare the teacher's 'steady' cards. Explain 2 + 3 = 6."), quoteLesson);
  assert.equal(formatted.passed, false);
  assert.equal(formatted.issues[0].evidenceMatch, "format_normalised");
  assert.throws(() => parseHqlsQualityReview(finding("Explain 2 + 3 = 5."), quoteLesson), HqlsQualityGroundingError);
  assert.throws(() => parseHqlsQualityReview(finding("Explain 2 + 3 = 6.", 2), quoteLesson), HqlsQualityGroundingError);
  assert.throws(() => parseHqlsQualityReview(finding("Compare the Teacher's 'steady' cards."), quoteLesson), HqlsQualityGroundingError);
  const beforeReview = JSON.stringify(quoteLesson);
  const calls: boolean[] = [];
  const retried = await runHqlsQualityReview(quoteLesson, async (retry) => {
    calls.push(retry);
    return finding(retry ? "Explain 2 + 3 = 6." : "invented quotation");
  });
  assert.deepEqual(calls, [false, true]);
  assert.equal(retried.attempts, 2);
  assert.equal(retried.passed, false); // A real defect survives the retry.
  assert.equal(JSON.stringify(quoteLesson), beforeReview);
  let failedCalls = 0;
  await assert.rejects(runHqlsQualityReview(quoteLesson, async () => { failedCalls++; return finding("invented quotation"); }), HqlsQualityGroundingError);
  assert.equal(failedCalls, 2);
  let providerCalls = 0;
  await assert.rejects(runHqlsQualityReview(quoteLesson, async () => { providerCalls++; throw new Error("Provider unavailable"); }), /Provider unavailable/);
  assert.equal(providerCalls, 1);
  let validCalls = 0;
  const cleanReview = await runHqlsQualityReview(quoteLesson, async () => { validCalls++; return { issues: [] }; });
  assert.equal(validCalls, 1);
  assert.equal(cleanReview.attempts, 1);
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
}

void verifyQuality().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
