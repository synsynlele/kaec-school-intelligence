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
  securityRegression,
  homePage,
  signInPage,
  dashboardPage,
  dashboardClient,
  setupClient,
  resourceClient,
  hqlsClient,
  assessmentClient,
  diagnosisClient,
  diagnosisPage,
  interventionClient,
  interventionPage,
  nextLessonPage,
  nextLessonClient,
  savedWorkClient,
  packageJson,
  vercel,
] = await Promise.all([
  text("docs/PRODUCT_CONSTITUTION.md"),
  text("docs/STAGE_6_V1_INTEGRATION_LAUNCH_READINESS.md"),
  text("docs/STAGE_6_SECURITY_REGRESSION.md"),
  text("app/page.tsx"),
  text("app/sign-in/page.tsx"),
  text("app/dashboard/page.tsx"),
  text("components/dashboard/dashboard-client.tsx"),
  text("components/workspace/academic-setup-client.tsx"),
  text("components/resources/resource-library-client.tsx"),
  text("components/hqls/hqls-client.tsx"),
  text("components/assessment/world-class-assessment-client.tsx"),
  text("components/diagnosis/kaec-diagnosis-client.tsx"),
  text("app/diagnosis/page.tsx"),
  text("components/interventions/intervention-client.tsx"),
  text("app/interventions/page.tsx"),
  text("app/interventions/next-lesson/page.tsx"),
  text("components/interventions/next-lesson-client.tsx"),
  text("components/saved-work/saved-work-client.tsx"),
  text("package.json"),
  text("vercel.json"),
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
  "branch-level Git deployment gating",
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
  "PASS — READ-ONLY LIVE DATABASE SECURITY AUDIT",
  "0 visible rows",
  "private.is_workspace_member",
  "creator or workspace owner/admin",
  "intervention handoff delete: owner/admin **and draft status only**",
  "no anonymous data exposure",
]) {
  assert(
    securityRegression.includes(required),
    `Stage 6 live security regression evidence is missing: ${required}`,
  );
}

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
  "function openDiagnosis(entry: DiagnosisEntry)",
  "setError(null)",
  "setNotice(null)",
  "onClick={() => openDiagnosis(entry)}",
]) {
  assert(
    diagnosisClient.includes(required),
    `Diagnosis assessment/recovery continuity is missing: ${required}`,
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
  diagnosisPage.includes("Student Diagnosis Intelligence") &&
    !diagnosisPage.includes("Stage 4"),
  "Diagnosis release UI must not expose internal development-stage labels.",
);
assert(
  !interventionPage.includes("Stage 5") &&
    !nextLessonPage.includes("Stage 5") &&
    !interventionClient.includes("Stage 5 ·"),
  "Intervention release UI must not expose internal development-stage labels.",
);

for (const required of [
  "Connected school intelligence",
  "One workspace. One connected learning loop.",
  "Ready for lesson planning and validation",
  "Ready for aligned assessment design",
  "Ready for evidence-based diagnosis",
]) {
  assert(
    dashboardClient.includes(required),
    `Dashboard release copy is missing: ${required}`,
  );
}

assert(
  setupClient.includes("Academic Setup") &&
    setupClient.includes(
      "Define the school context used across HQLS lessons, assessments and diagnoses.",
    ),
  "Academic Setup must describe the current connected product rather than a future stage.",
);
assert(
  resourceClient.includes("governed source context for HQLS lessons and assessments") &&
    resourceClient.includes(
      "HQLS and assessment generation can preserve provenance back to these files.",
    ),
  "Resource Library must describe the active intelligence engines rather than future functionality.",
);

const releaseCopySurfaces = [
  homePage,
  signInPage,
  dashboardPage,
  dashboardClient,
  setupClient,
  resourceClient,
  assessmentClient,
  diagnosisPage,
  diagnosisClient,
  interventionPage,
  interventionClient,
  nextLessonPage,
  nextLessonClient,
  savedWorkClient,
];
const staleReleasePhrases = [
  "Engine build follows Stage 1",
  "Stage 1 foundation",
  "Stage 1 Academic Setup",
  "future KSI engines",
  "Future HQLS and assessment generation",
  "future HQLS lessons, assessments and diagnoses",
  "before the final AI engines are connected",
  "Stage 4 · Student Diagnosis Intelligence",
  "Stage 5 ·",
];
for (const phrase of staleReleasePhrases) {
  assert(
    releaseCopySurfaces.every((surface) => !surface.includes(phrase)),
    `Release-facing UI still contains obsolete development copy: ${phrase}`,
  );
}

assert(
  vercel.includes('"deploymentEnabled"') &&
    vercel.includes('"*": false') &&
    vercel.includes('"main": true') &&
    vercel.includes('"*-preview": true') &&
    !vercel.includes("ignoreCommand"),
  "Stage 6 must use quota-safe Vercel branch gating instead of canceled ignored builds.",
);

assert(
  packageJson.includes('"verify:structure"') &&
    packageJson.includes("verify-stage6.mjs"),
  "Permanent Stage 6 structural verification must remain enabled.",
);

console.log(
  "Stage 6 structure verification passed: V1 three-engine boundary, live isolation evidence, validated HQLS -> exact world-class Assessment, exact saved Assessment -> Diagnosis evidence, clean saved-diagnosis record switching, exact intervention -> HQLS artifact navigation, clean release-facing product copy, quota-safe preview gating, and launch-readiness contract are present.",
);
