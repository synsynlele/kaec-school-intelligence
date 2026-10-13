import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HQLS_STAGES } from "../lib/domain/hqls";
import { hqlsStageTimings, hqlsPacingNotes } from "../lib/hqls/timing";
import { HqlsQualityGroundingError, HqlsQualityCorrectionError, parseHqlsQualityReview, hqlsQualityReviewSchema, hqlsReviewSources, runHqlsQualityReview, requireObservableObjective } from "../lib/hqls/quality";
import { reviewHqlsAdvisory, readHqlsAdvice, replaceHqlsAdvice, updateTeacherReview, hqlsAdviceStatus } from "../lib/hqls/advisory-review";
import { checkKnownEnglishContradictions } from "../lib/hqls/english-contradictions";
import { checkRequiredReflexiveForms } from "../lib/hqls/category-coverage";
import { checkPromisedMaterials } from "../lib/hqls/materials";
import { needsCoordinatedRepair, mergeStageRepairs, contentRepairStageNumbers } from "../lib/hqls/coordinated-repair";
import { repairContentFidelity } from "../lib/hqls/repair-fidelity";
import { validateHqlsLesson, buildHqlsGenerationPrompt, buildHqlsRepairPrompt, buildStageRegenerationPrompt, lessonContextSummary } from "../lib/hqls/engine";
import { resolveLearningLevel, learningLevelGuidance, primaryTaskBand, teacherUsabilityGuidance } from "../lib/domain/learning-level";
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
  assert.equal(primaryTaskBand("Primary 1", "6–7"), "younger_primary");
  assert.equal(primaryTaskBand("Primary 3"), "younger_primary");
  assert.equal(primaryTaskBand("Primary 6", "10–11"), "older_primary");
  assert.equal(primaryTaskBand("University Year 1", "18–22"), null);
  assert.equal(primaryTaskBand("SS2", "15–16"), null);
  assert(teacherUsabilityGuidance("Primary 1", "6–7").includes("known starting amounts, one change"));
  assert(teacherUsabilityGuidance("Primary 1", "6–7").includes("preserve an explicitly requested advanced objective"));
  assert(!teacherUsabilityGuidance("University Year 1", "18–22").includes("within ten"));
  assert(teacherUsabilityGuidance("University Year 1", "18–22").includes("preserve advanced reasoning"));
  const primaryContext = { workspaceId: "test", subject: "Mathematics", topic: "Addition and subtraction", objective: "Show adding with counters", classLevel: "Primary 1", ageRange: "6–7", durationMinutes: 90 };
  const primaryPrompt = buildHqlsGenerationPrompt(primaryContext, []);
  assert(primaryPrompt.includes("one short direction at a time"));
  assert(primaryPrompt.includes("unknown starting number"));
  assert(primaryPrompt.includes("hands-on episodes"));
  assert(lessonContextSummary(primaryContext).includes("YOUNGER PRIMARY TASK DESIGN"), "Stage repair and review must receive the same task guidance.");
  assert(lessonContextSummary({ ...primaryContext, previousLearning: "Already solves one-change missing-start problems with objects." }).includes("Already solves one-change missing-start problems"));
  const primaryAssessmentPrompt = buildAssessmentPrompt({ ...primaryContext, subjectId: null, classId: null, sourceLessonId: null, resourceIds: [], title: "Adding", assessmentMode: "subjective", totalItems: 1, totalMarks: 5, purpose: "Practice", teacherInstructions: "", itemCounts: { objective: 0, subjective: 1, critical_thinking: 0, project: 0 } }, "", []);
  assert(primaryAssessmentPrompt.includes("known starting amounts, one change"));
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
  const microDefault = "default to no additional questions";
  assert(primaryPrompt.toLowerCase().includes(microDefault), "Generation must prefer one clue without extra Stage 3 questions.");
  assert(buildHqlsRepairPrompt(primaryContext, lesson, validateHqlsLesson(lesson)).toLowerCase().includes(microDefault), "Fidelity repair must preserve Micro-Illumination's no-extra-question default.");
  assert(buildStageRegenerationPrompt({ lesson, targetStage: stages[2], action: "improve", lessonContext: "Primary 1" }).toLowerCase().includes(microDefault), "Stage regeneration must not reintroduce redundant questions.");
  assert(!primaryPrompt.includes("up to three brief guiding questions"), "The default generator must not encourage question padding.");
  const collaborationCodes = (experience: string) => validateHqlsLesson({ ...lesson, stages: stages.map((stage) =>
    stage.stageNumber === 4 ? { ...stage, experience, teacherPrompts: [], learnerActions: [] } : stage),
  }).violations.filter((issue) => issue.code === "trial_first_lacks_teamwork");
  assert.equal(collaborationCodes("Work in pairs. Both partners propose a choice, explain it and agree on one answer.").length, 0);
  assert.equal(collaborationCodes("Work in small teams. Every member explains a choice and the team produces a shared arrangement.").length, 0);
  assert.equal(collaborationCodes("Work in pairs. Each learner independently submits a separate answer.").length, 1);
  assert.equal(collaborationCodes("Each learner completes the task alone.").length, 1);
  const regressionLesson = { ...lesson, stages: stages.map((stage) => ({ ...stage,
    teachingContent: stage.stageNumber === 5 ? stage.teachingContent : "",
    reflectionPrompt: stage.stageNumber === 7 ? "What changed in your reasoning and why?" : "",
    transferTask: stage.stageNumber === 7 ? "Explain the new idea to someone at home using an example." : "",
    experience: stage.stageNumber === 4 ? "Each learner completes the task alone." : stage.experience,
    learnerActions: stage.stageNumber === 4 ? ["Submit an individual answer."] : stage.learnerActions,
  })) };
  let regressionCalls = 0;
  const repairedRegression = await repairContentFidelity(regressionLesson, "Unrelated topic", async (stage, defects) => {
    regressionCalls++;
    assert.equal(stage.stageNumber, 4);
    assert(defects.some((defect) => defect.includes("trial_first_lacks_teamwork")));
    return { ...stage, experience: "Work in pairs. Each partner explains a choice; both agree on one shared answer." };
  });
  assert.equal(regressionCalls, 1);
  assert.equal(repairedRegression.validation.passed, true, JSON.stringify(repairedRegression.validation.violations));
  assert.equal(repairedRegression.lesson.stages[4], regressionLesson.stages[4]);
  await repairContentFidelity(repairedRegression.lesson, "Unrelated topic", async () => { throw new Error("Valid repairs must not add AI calls."); });
  let failedFidelityCalls = 0;
  const stillInvalid = await repairContentFidelity(regressionLesson, "Unrelated topic", async (stage) => { failedFidelityCalls++; return stage; });
  assert.equal(failedFidelityCalls, 1, "Repair failure must not create a retry loop.");
  assert.equal(stillInvalid.validation.passed, false);
  assert.equal(needsCoordinatedRepair([{ stageNumber: 1, category: "task_integrity" }, { stageNumber: 4, category: "task_integrity" }]), true);
  assert.equal(needsCoordinatedRepair([{ stageNumber: 4, category: "task_integrity" }]), false);
  assert.equal(needsCoordinatedRepair([{ stageNumber: 1, category: "subject_accuracy" }, { stageNumber: 5, category: "subject_accuracy" }]), false);
  const jointReplacements = [
    { ...stages[0], experience: "Teacher preparation: each box serves two pairs, with one complete card set per pair." },
    { ...stages[3], experience: "Two pairs share each box. Give each pair one complete card set." },
  ];
  const joinedLesson = mergeStageRepairs(lesson, jointReplacements, [1, 4]);
  assert.equal(joinedLesson.stages[0].experience, jointReplacements[0].experience);
  assert.equal(joinedLesson.stages[3].experience, jointReplacements[1].experience);
  assert.equal(joinedLesson.stages[4], lesson.stages[4], "Untouched teaching content must be preserved.");
  assert.throws(() => mergeStageRepairs(lesson, [jointReplacements[0], jointReplacements[0]], [1, 4]));
  assert.throws(() => mergeStageRepairs(lesson, [jointReplacements[0]], [1, 4]));
  assert.throws(() => mergeStageRepairs(lesson, [jointReplacements[0], stages[4]], [1, 4]));
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
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock(words).replace(/\n/g, " "))).length, 0, "A complete inline numbered list must not be rejected as missing.");
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + "\nWord cards (16): " + words.join(", "))).length, 0, "A compact word list supplies actual material.");
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + "\nWord cards (16): " + words.slice(0, 15).join(", "))).length, 1, "A genuinely short list still fails.");
  const inlineSentences = "Use the two sentence cards below. Sentence cards (2): 1. She washed herself. 2. He blamed himself.";
  assert.equal(checkPromisedMaterials(materialLesson(inlineSentences)).length, 0, "Complete inline sentences are valid cards.");
  const unheaded = materialLesson('Use the two sentence cards below. "She washed herself." "He blamed himself."');
  assert.equal(parseHqlsQualityReview({ issues: [] }, unheaded).passed, true, "Alternative complete material layout must not become a false missing-material rejection.");
  assert.equal(parseHqlsQualityReview({ issues: [] }, unheaded).warnings[0].category, "teacher_guidance");
  assert.equal(parseHqlsQualityReview({ issues: [] }, materialLesson('Use the two sentence cards below. "She washed herself."')).passed, false, "One supplied card must not fulfil a two-card promise.");


  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock(words.slice(0, 15)))).length, 1);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock([...words.slice(0, 15), words[0]]))).length, 0, "Repeated practice words are valid physical cards.");
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock([...words.slice(0, 15), "etc."]))).length, 1);
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask.replace("16", "sixteen") + materialBlock(words))).length, 0);
  const integrationMaterials = (experience: string) => ({ ...lesson, stages: stages.map((stage) => stage.stageNumber === 7 ? { ...stage, experience } : { ...stage }) });
  assert.equal(checkPromisedMaterials(integrationMaterials("Use the two cards below.\nCards (2):\n1. at\n2. bus")).length, 0);
  assert.equal(checkPromisedMaterials(integrationMaterials("Use the two cards below. Reflect on how you learned.")).length, 1);
  assert.equal(checkPromisedMaterials(integrationMaterials("Use the two cards below.\nCards (2):\n1. at")).length, 1);
  const earlierMaterials = { ...lesson, stages: stages.map((stage) => stage.stageNumber === 1 ? { ...stage, experience: materialBlock(words) } : stage.stageNumber === 4 ? { ...stage, experience: brokenTask.replace("below", "provided in Stage 1") } : stage) };
  assert.equal(checkPromisedMaterials(earlierMaterials).length, 0);
  const sentenceSet = "\nSentence cards (12):\n" + Array.from({ length: 12 }, (_, index) => `${index + 1}. The learner builds example ${index + 1}.`).join("\n");
  const subsetLesson = (instruction: string, supplied = sentenceSet) => ({ ...lesson, stages: stages.map((stage) => stage.stageNumber === 4 ? { ...stage, experience: "Use the 12 sentence cards below." + supplied } : stage.stageNumber === 5 ? { ...stage, experience: instruction, teachingContent: "" } : stage) });
  assert.equal(checkPromisedMaterials(subsetLesson("Use 1 sentence cards from Stage 4 to model a choice.")).length, 0, "A supplied subset must not require a new one-card list.");
  assert.equal(checkPromisedMaterials(subsetLesson("Show card 1 sentence cards from Stage 4.")).length, 0, "A card label is not a quantity promise.");
  assert.equal(checkPromisedMaterials(subsetLesson("Use 1 cards from Stage 4 to model a choice.")).length, 0, "Generic card references resolve to supplied sentence cards.");
  assert(checkPromisedMaterials(subsetLesson("Use 1 sentence cards from Stage 4.", sentenceSet.replace("12. The learner builds example 12.", ""))).length > 0, "Incomplete source lists still block subsets.");
  assert(checkPromisedMaterials(subsetLesson("Use 1 word cards from Stage 4.")).length > 0, "Typed word-card requests cannot resolve to sentence cards.");
  assert(checkPromisedMaterials(subsetLesson("Use 13 sentence cards from Stage 4.")).length > 0, "A subset cannot exceed the source set.");
  assert(checkPromisedMaterials(subsetLesson("Use the 1 sentence cards below.")).some((issue) => issue.stageNumber === 5), "A new missing set must still be rejected.");
  assert.equal(checkPromisedMaterials(materialLesson(brokenTask + materialBlock(words).replace(/\d+\. /g, "- "))).length, 0, "Bullets may supply complete materials.");
  const pictureBlock = "Picture-word cards per pair (12):\n" + Array.from({ length: 12 }, (_, index) => `${index + 1}. picture and word ${index + 1}`).join("\n");
  const pictureReuse = (instruction: string, source = pictureBlock) => ({ ...lesson, stages: stages.map((stage) => stage.stageNumber === 4 ? { ...stage, experience: source } : stage.stageNumber === 6 ? { ...stage, experience: instruction } : stage) });
  assert.equal(checkPromisedMaterials(pictureReuse("Reuse the 12 cards from Stage 4.")).length, 0);
  assert.equal(checkPromisedMaterials(pictureReuse("Use the same 12 cards again.")).length, 0);
  assert.equal(checkPromisedMaterials(pictureReuse("Use the 12 cards from the first trial.")).length, 0);
  assert(checkPromisedMaterials(pictureReuse("Reuse the 12 cards from Stage 4.", pictureBlock.replace("12. picture and word 12", ""))).length > 0);
  const ambiguousReuse = pictureReuse("Use the same 12 cards again.");
  ambiguousReuse.stages[1].experience = pictureBlock;
  assert(checkPromisedMaterials(ambiguousReuse).length > 0, "Unlabelled reuse cannot select between two complete earlier sets.");
  assert.deepEqual(contentRepairStageNumbers([{ stageNumber: 4, category: "task_integrity", correction: "Supply extra take-home copies per child." }]), [4, 7]);
  assert.deepEqual(contentRepairStageNumbers([{ stageNumber: 5, category: "subject_accuracy", correction: "Correct the meaning." }]), [5]);
  assert.deepEqual(contentRepairStageNumbers([{ stageNumber: 4, category: "task_integrity", correction: "Add a missing reflexive and update the mini-card pool.", repairScope: "materials_chain" }]), [4, 5, 6, 7]);
  assert.deepEqual(contentRepairStageNumbers([{ stageNumber: 5, category: "pacing_guidance", correction: "Use suggested pacing.", repairScope: "materials_chain" }]), [5]);
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
  const sources = hqlsReviewSources(quoteLesson);
  assert.equal(new Set(sources.map((source) => source.evidenceId)).size, sources.length);
  assert.deepEqual(hqlsQualityReviewSchema(quoteLesson).properties.issues.items.properties.evidenceId.enum, sources.map((source) => source.evidenceId));
  const referenced = parseHqlsQualityReview({ issues: [{ evidenceId: "stage1.experience", category: "subject_accuracy", correction: "Correct 2 + 3 to 5." }] }, quoteLesson);
  assert.equal(referenced.passed, false);
  assert.equal(referenced.issues[0].stageNumber, 1);
  assert.equal(referenced.issues[0].evidence, quoteLesson.stages[0].experience);
  assert.equal(referenced.issues[0].evidenceMatch, "source_reference");
  assert.throws(() => parseHqlsQualityReview({ issues: [{ evidenceId: "stage8.experience", category: "subject_accuracy", correction: "Change it." }] }, quoteLesson), HqlsQualityGroundingError);
  const psychologyLesson = { ...quoteLesson, stages: quoteLesson.stages.map((stage) => stage.stageNumber === 5 ? { ...stage, teachingContent: "Human potential is a fixed, universal score.\nA learner’s development follows only one theory." } : stage) };
  const psychologyReview = parseHqlsQualityReview({ issues: [{ evidenceId: "stage5.teachingContent", category: "subject_accuracy", correction: "Present human potential as a contextual concept rather than a universal fixed score." }] }, psychologyLesson);
  assert.equal(psychologyReview.issues[0].evidence, psychologyLesson.stages[4].teachingContent);
  assert.equal(psychologyReview.issues[0].stageNumber, 5);
  await assert.rejects(runHqlsQualityReview(quoteLesson, async () => ({ issues: [{ evidenceId: "invented", category: "task_integrity", correction: "Change it." }] })), HqlsQualityGroundingError);
  assert.deepEqual(hqlsPacingNotes([{ title: "Source" }, { kind: "hqls_pacing_notes", notes: ["Stage 5: Use suggested pacing.", 4] }]), ["Stage 5: Use suggested pacing."]);
  assert.deepEqual(hqlsPacingNotes(null), []);
  const timingLesson = { ...quoteLesson, stages: quoteLesson.stages.map((stage) => stage.stageNumber === 5 ? { ...stage, teachingContent: "Teach and model: 10 minutes. Guided rewriting: 8 minutes. Check: 4 minutes. Feedback: 5 minutes. Recap: 3 minutes. While modelling, use 8 minutes total." } : stage) };
  const timingFinding = { evidenceId: "stage5.teachingContent", category: "pacing_guidance", correction: "Use the app's suggested stage timing; remove duplicate minute estimates in the teaching note." };
  const timingReview = parseHqlsQualityReview({ issues: [timingFinding] }, timingLesson);
  assert.equal(timingReview.passed, true, "Minor pacing discrepancies must not reject usable lessons.");
  assert.equal(timingReview.warnings.length, 1);
  const advice = { evidenceId: "stage5.teachingContent", category: "teacher_guidance", correction: "Optionally add a familiar example." };
  assert.equal(parseHqlsQualityReview({ issues: [advice] }, timingLesson).passed, true);
  assert.equal(parseHqlsQualityReview({ issues: [advice] }, timingLesson).warnings.length, 1);
  assert.equal(parseHqlsQualityReview({ issues: [advice, { evidenceId: "stage1.experience", category: "subject_accuracy", correction: "Correct 2 + 3 to 5." }] }, timingLesson).passed, false, "Advice must not hide factual errors.");

  assert.equal(timingReview.issues.length, 0);
  const mixedReview = parseHqlsQualityReview({ issues: [timingFinding, { evidenceId: "stage1.experience", category: "subject_accuracy", correction: "Correct 2 + 3 to 5." }] }, timingLesson);
  assert.equal(mixedReview.passed, false, "A pacing note must not hide a factual error.");
  assert.equal(mixedReview.issues.length, 1);
  assert.equal(mixedReview.warnings.length, 1);
  const missingWithTiming = parseHqlsQualityReview({ issues: [timingFinding] }, { ...timingLesson, stages: timingLesson.stages.map((stage) => stage.stageNumber === 4 ? { ...stage, experience: "Use the two cards below." } : stage) });
  assert.equal(missingWithTiming.passed, false, "Missing promised materials still block saving.");
  const impossibleTask = parseHqlsQualityReview({ issues: [{ evidenceId: "stage5.teachingContent", category: "task_integrity", correction: "The mandatory workload cannot fit; reduce the required outputs." }] }, timingLesson);
  assert.equal(impossibleTask.passed, false);
  const coverageReview = parseHqlsQualityReview({ issues: [{ evidenceId: "stage4.experience", category: "task_integrity", correction: "Supply an actual reflexive example and align subsequent card pools.", repairScope: "materials_chain" }] }, quoteLesson);
  assert.equal(coverageReview.passed, false);
  assert.deepEqual(contentRepairStageNumbers(coverageReview.issues), [4, 5, 6, 7]);
  assert.throws(() => parseHqlsQualityReview({ issues: [{ evidenceId: "stage4.experience", category: "task_integrity", correction: "Correct it.", repairScope: "invented" }] }, quoteLesson));
  const prematureFinding = { evidenceId: "stage4.experience", category: "task_integrity", impact: "optional_improvement", impactExplanation: "The provisional labels differ; the task is still runnable before teaching.", repairScope: "materials_chain", correction: 'Change the required label list in Stage 4 to the exact labels used in Stage 6: subject, object, possessive adjective, possessive pronoun, reflexive, special.' };
  const provisionalReview = parseHqlsQualityReview({ issues: [prematureFinding] }, quoteLesson);
  assert.equal(provisionalReview.passed, true, "Different crude and taught labels alone must not reject Trial 1.");
  assert.equal(provisionalReview.warnings.length, 1);
  assert.equal(provisionalReview.warnings[0].category, "teacher_guidance");
  const provisionalWithError = parseHqlsQualityReview({ issues: [prematureFinding, { evidenceId: "stage5.teachingContent", category: "subject_accuracy", correction: "Correct the factual definition." }] }, quoteLesson);
  assert.equal(provisionalWithError.passed, false, "Permitting provisional labels must not hide a separate factual defect.");
  assert.equal(provisionalWithError.issues.length, 1);
  const missingCategory = parseHqlsQualityReview({ issues: [{ ...prematureFinding, impact: "missing_essential_content", impactExplanation: "The required reflexive identification has no actual reflexive example.", correction: "Supply the missing example." }] }, quoteLesson);
  assert.equal(missingCategory.passed, false, "An actual missing category remains blocking.");
  for (const explanation of ["A clearer chemistry diagram would help but the data already suffice.", "The history source uses an equivalent heading.", "The mathematics pairs could use a different role split.", "The business discussion could use an extra case."]) {
    const review = parseHqlsQualityReview({ issues: [{ ...prematureFinding, impactExplanation: explanation, correction: "Optional preparation improvement." }] }, quoteLesson);
    assert.equal(review.passed, true, "Optional improvements across subjects must not reject usable lessons.");
  }
  for (const [impact, category] of [["wrong_fact_or_answer", "subject_accuracy"], ["missing_essential_content", "task_integrity"], ["impossible_required_task", "task_integrity"]]) {
    assert.equal(parseHqlsQualityReview({ issues: [{ ...prematureFinding, impact, category, impactExplanation: "A concrete required result is invalid or unavailable.", correction: "Repair the specific defect." }] }, quoteLesson).passed, false);
  }
  assert.throws(() => parseHqlsQualityReview({ issues: [{ ...prematureFinding, impact: "wrong_fact_or_answer", impactExplanation: "" }] }, quoteLesson));
  assert.equal(parseHqlsQualityReview({ issues: [{ ...prematureFinding, impact: "wrong_fact_or_answer", category: "teacher_guidance" }] }, quoteLesson).passed, false, "Concrete wrong facts cannot be hidden by a mismatched advisory category.");
  assert(hqlsQualityReviewSchema(quoteLesson).properties.issues.items.required.includes("impactExplanation"));

  const requiredContext = { subject: "English Language", objective: "Identify reflexive pronouns in sentences." };
  const reportedLesson = { ...quoteLesson, stages: quoteLesson.stages.map((stage) => stage.stageNumber === 5
    ? { ...stage, teachingContent: "Mistake: Calling a proper noun (Mary, teacher) a pronoun. Fix: Proper nouns are names." }
    : stage.stageNumber === 6 ? { ...stage, experience: 'D) "I did the work by _____ ."', evidenceToNotice: ["Correct reflexive usage in sentence D when expected (myself, ourselves)"] } : stage) };
  assert.deepEqual(checkKnownEnglishContradictions(reportedLesson, { subject: "English Language" }).map((issue) => issue.stageNumber), [5, 6]);
  assert.equal(parseHqlsQualityReview({ issues: [] }, reportedLesson, { subject: "English" }).passed, false, "The confirmed wrong teaching keys must not pass an AI all-clear.");
  const correctedKeys = { ...reportedLesson, stages: reportedLesson.stages.map((stage) => stage.stageNumber === 5
    ? { ...stage, teachingContent: "Teacher is a common noun; Mary is a proper noun." }
    : stage.stageNumber === 6 ? { ...stage, evidenceToNotice: ["Sentence D: myself, not ourselves."] } : stage) };
  assert.equal(checkKnownEnglishContradictions(correctedKeys, { subject: "English" }).length, 0);
  const pluralKey = { ...reportedLesson, stages: correctedKeys.stages.map((stage) => stage.stageNumber === 6
    ? { ...stage, experience: 'D) "We did the work by _____ ."', evidenceToNotice: ["Sentence D: ourselves."] } : stage) };
  assert.equal(checkKnownEnglishContradictions(pluralKey, { subject: "English" }).length, 0, "A plural subject legitimately takes ourselves.");
  assert.equal(checkKnownEnglishContradictions(reportedLesson, { subject: "French" }).length, 0);

  assert.deepEqual(checkRequiredReflexiveForms(quoteLesson, requiredContext).map((issue) => issue.stageNumber), [5]);
  assert.equal(parseHqlsQualityReview({ issues: [] }, quoteLesson, requiredContext).passed, false, "An AI all-clear cannot bypass missing required reflexive forms.");
  const withForms = { ...quoteLesson, stages: quoteLesson.stages.map((stage) => stage.stageNumber === 4 ? { ...stage, experience: "Sentence cards (1):\n1. Mary taught herself to play the piano." } : stage.stageNumber === 5 ? { ...stage, teachingContent: "She washed herself. Here herself refers back to She." } : stage) };
  assert.equal(checkRequiredReflexiveForms(withForms, requiredContext).length, 0);
  assert.equal(checkRequiredReflexiveForms(quoteLesson, { subject: "French", objective: "Identify reflexive pronouns." }).length, 0, "English forms must not be imposed on another language.");
  assert.equal(checkRequiredReflexiveForms(quoteLesson, { subject: "English", objective: "Identify personal pronouns." }).length, 0);
  const stage6Requires = { ...quoteLesson, stages: quoteLesson.stages.map((stage) => stage.stageNumber === 6 ? { ...stage, experience: "Label the Reflexive group." } : stage) };
  assert.equal(checkRequiredReflexiveForms(stage6Requires, { subject: "English" }).length, 1);
  const firstExplicitlyRequires = { ...quoteLesson, stages: quoteLesson.stages.map((stage) => stage.stageNumber === 4 ? { ...stage, experience: "Find the reflexive example in the supplied set." } : stage) };
  assert.deepEqual(checkRequiredReflexiveForms(firstExplicitlyRequires, requiredContext).map((issue) => issue.stageNumber), [4, 5]);


  let advisoryCalls = 0;
  const advisoryResult = await reviewHqlsAdvisory(quoteLesson, async () => { advisoryCalls++; return { issues: [{ evidenceId: "stage5.teachingContent", category: "subject_accuracy", correction: "Correct the factual example." }] }; });
  assert.equal(advisoryCalls, 1);
  assert.equal(advisoryResult.reviewStatus, "available");
  assert.equal(advisoryResult.suggestions[0].priority, "correct_before_teaching");
  const sourceWithAdvice = replaceHqlsAdvice([{ title: "Curriculum source" }], advisoryResult);
  assert.equal(hqlsAdviceStatus(true, sourceWithAdvice), "draft", "A complete generated lesson is a draft until human review.");
  assert.equal(readHqlsAdvice(JSON.parse(JSON.stringify(sourceWithAdvice)))?.suggestions[0].stageNumber, 5, "Advice must survive saved JSON and reload.");
  const acknowledged = updateTeacherReview(advisoryResult, "authenticated-teacher", true);
  assert.equal(hqlsAdviceStatus(true, replaceHqlsAdvice(sourceWithAdvice, acknowledged)), "validated");
  assert.equal(hqlsAdviceStatus(false, replaceHqlsAdvice(sourceWithAdvice, acknowledged)), "draft", "Teacher review cannot bypass failed HQLS fidelity.");
  assert.equal(hqlsAdviceStatus(true, replaceHqlsAdvice(sourceWithAdvice, updateTeacherReview(acknowledged, "authenticated-teacher", false))), "draft", "Later edits reset human review.");
  assert.equal(replaceHqlsAdvice(sourceWithAdvice, advisoryResult).length, 2, "Replacing advisoryResult must preserve resources without duplicating review records.");
  for (const response of [() => { throw new Error("Provider unavailable"); }, () => ({ issues: [{ evidenceId: "invented", category: "task_integrity", correction: "Change it." }] })]) {
    let calls = 0;
    const unavailable = await reviewHqlsAdvisory(quoteLesson, async () => { calls++; return response(); });
    assert.equal(calls, 1, "Advisory review never retries a provider or grounding failure.");
    assert.equal(unavailable.reviewStatus, "unavailable");
  }
  const missingAdvice = await reviewHqlsAdvisory(materialLesson(brokenTask), async () => { throw new Error("Unavailable"); });
  assert(missingAdvice.suggestions.some((item) => item.stageNumber === 4 && item.priority === "correct_before_teaching"), "Local known defects remain visible when model review is unavailable.");
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
    lesson: createHqlsLessonPdf({ ...branding, title: lesson.title, subject: "English", classLevel: "JSS1", ageRange: "10–12", durationMinutes: 90, topic: "Vowels", objective: lesson.lessonIntent, fidelityScore: 100, sources: [], stages, contentAdvice: advisoryResult }),
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
