import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  constitution,
  spec,
  hqlsClient,
  assessmentClient,
  diagnosisClient,
  interventionClient,
  nextLessonClient,
  packageJson,
] = await Promise.all([
  text("docs/PRODUCT_CONSTITUTION.md"),
  text("docs/STAGE_6_V1_INTEGRATION_LAUNCH_READINESS.md"),
  text("components/hqls/hqls-client.tsx"),
  text("components/assessment/world-class-assessment-client.tsx"),
  text("components/diagnosis/kaec-diagnosis-client.tsx"),
  text("components/interventions/intervention-client.tsx"),
  text("components/interventions/next-lesson-client.tsx"),
  text("package.json"),
]);

for (const required of [
  "Stage 6 is **not a fourth intelligence engine**",
  "No dead-end core flows",
  "Durable artifact continuity",
  "Clear traceability",
  "Full-loop permission verification",
  "User-facing failure and recovery behaviour",
  "Desktop and mobile usability",
  "Complete authenticated regression",
  "DO NOT MERGE until full Version 1 live acceptance passes",
]) {
  assert(spec.includes(required), `Stage 6 release contract is missing: ${required}`);
}

assert(
  constitution.includes("exactly three core intelligence engines") &&
    constitution.includes("no dead-end core flows") &&
    constitution.includes("Lesson → Assessment → Diagnosis context transfer works"),
  "Stage 6 must remain anchored to the Constitution's three-engine Platform Gate.",
);

for (const required of [
  "requestedLessonId",
  'new URLSearchParams(window.location.search).get("lesson")',
  'next.lessons.some((lesson) => lesson.id === lessonId)',
  "The linked HQLS lesson is not available in the active workspace.",
  "router.replace(`/hqls?lesson=${encodeURIComponent(lessonId)}`",
  'id="hqls-selected-lesson"',
  'selectedLesson.status === "validated"',
  'href={`/assessment?lesson=${encodeURIComponent(selectedLesson.id)}`}',
  "Build Assessment",
]) {
  assert(
    hqlsClient.includes(required),
    `Stage 6 exact HQLS artifact navigation is missing: ${required}`,
  );
}

for (const required of [
  "source_lesson_id",
  "sourceLessonId",
  "applySourceLessonFromState",
  "Source HQLS lesson (optional)",
  'fetch("/api/assessment-v11"',
  'requestedWorkflowId("lesson")',
  'requestedWorkflowId("assessment")',
  'next.lessons.some((lesson) => lesson.id === lessonId)',
  'next.assessments.some((item) => item.id === assessmentId)',
  "The linked HQLS lesson is not available as a validated assessment source in the active workspace.",
  "The linked assessment is not available in the active workspace.",
  "router.replace(`/assessment?lesson=${encodeURIComponent(lessonId)}`",
  "`/assessment?assessment=${encodeURIComponent(assessmentId)}`",
  'id="assessment-selected"',
  'href={`/hqls?lesson=${encodeURIComponent(selectedAssessment.source_lesson_id)}`}',
  'href={`/diagnosis?assessment=${encodeURIComponent(selectedAssessment.id)}`}',
  "Open Source HQLS Lesson",
  "Use in Diagnosis",
]) {
  assert(
    assessmentClient.includes(required),
    `Live world-class Assessment workflow continuity is missing: ${required}`,
  );
}

for (const required of [
  "assessment_id",
  "assessmentId",
  'mode !== "quick_teacher"',
  "Assessment Evidence",
  "Select saved assessment",
  "requestedAssessmentId",
  '.get("assessment")',
  "assessmentHandoffApplied",
  'setMode("assessment_based")',
  "The linked assessment is not available as diagnosis evidence in the active workspace.",
  "Assessment evidence loaded:",
  "replaceAssessmentWorkflowUrl",
  "onAssessmentChange",
]) {
  assert(
    diagnosisClient.includes(required),
    `Diagnosis assessment-evidence continuity is missing: ${required}`,
  );
}

for (const required of [
  'router.push(`/hqls?lesson=${encodeURIComponent(lessonId)}`)',
  'next_lesson_id: lessonId',
  "Do not generate another lesson",
]) {
  assert(
    nextLessonClient.includes(required),
    `Intervention → exact HQLS handoff is missing: ${required}`,
  );
}

for (const required of [
  "nextLessonId",
  "Open Linked HQLS Lesson",
  'href={`/hqls?lesson=${encodeURIComponent(active.nextLessonId)}`}',
  "Governed improvement handoff",
]) {
  assert(
    interventionClient.includes(required),
    `Confirmed intervention history continuity is missing: ${required}`,
  );
}

assert(
  packageJson.includes('"verify:structure"') &&
    packageJson.includes("verify-stage6.mjs"),
  "Permanent Stage 6 structural verification must remain enabled.",
);

console.log(
  "Stage 6 structure verification passed: V1 three-engine boundary, validated HQLS -> exact world-class Assessment, exact saved Assessment -> Diagnosis evidence, exact intervention -> HQLS artifact navigation, and launch-readiness contract are present.",
);
