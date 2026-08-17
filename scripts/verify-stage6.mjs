import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  constitution,
  simplification,
  spec,
  securityRegression,
  homePage,
  signInPage,
  dashboardPage,
  dashboardClient,
  setupClient,
  resourceClient,
  hqlsPage,
  hqlsClient,
  hqlsResultPage,
  hqlsResultClient,
  assessmentPage,
  assessmentClient,
  assessmentResultPage,
  assessmentResultClient,
  diagnosisPage,
  diagnosisBuilder,
  diagnosisResultPage,
  diagnosisResultClient,
  diagnosisManage,
  diagnosisPdf,
  interventionPage,
  interventionWorkspace,
  interventionResultPage,
  interventionResultClient,
  interventionManage,
  nextLessonPage,
  nextLessonClient,
  resultRedirect,
  lifecycleMigration,
  savedWorkClient,
  packageJson,
  vercel,
] = await Promise.all([
  text("docs/PRODUCT_CONSTITUTION.md"),
  text("docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md"),
  text("docs/STAGE_6_V1_INTEGRATION_LAUNCH_READINESS.md"),
  text("docs/STAGE_6_SECURITY_REGRESSION.md"),
  text("app/page.tsx"),
  text("app/sign-in/page.tsx"),
  text("app/dashboard/page.tsx"),
  text("components/dashboard/dashboard-client.tsx"),
  text("components/workspace/academic-setup-client.tsx"),
  text("components/resources/resource-library-client.tsx"),
  text("app/hqls/page.tsx"),
  text("components/hqls/hqls-client.tsx"),
  text("app/hqls/result/page.tsx"),
  text("components/hqls/hqls-result-client.tsx"),
  text("app/assessment/page.tsx"),
  text("components/assessment/world-class-assessment-client.tsx"),
  text("app/assessment/result/page.tsx"),
  text("components/assessment/assessment-result-client.tsx"),
  text("app/diagnosis/page.tsx"),
  text("components/diagnosis/diagnosis-builder-client.tsx"),
  text("app/diagnosis/result/page.tsx"),
  text("components/diagnosis/diagnosis-result-client.tsx"),
  text("app/api/diagnosis/manage/route.ts"),
  text("app/api/diagnosis/pdf/route.ts"),
  text("app/interventions/page.tsx"),
  text("components/interventions/intervention-workspace-client.tsx"),
  text("app/interventions/result/page.tsx"),
  text("components/interventions/intervention-result-client.tsx"),
  text("app/api/interventions/manage/route.ts"),
  text("app/interventions/next-lesson/page.tsx"),
  text("components/interventions/next-lesson-client.tsx"),
  text("components/workflow/artifact-result-redirect.tsx"),
  text("supabase/migrations/024_stage6_archive_result_lifecycle.sql"),
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

assert(
  simplification.includes("Teacher & Leadership Simplification") &&
    simplification.includes("Students are not an interactive KSI user surface") &&
    simplification.includes("Academic Resource / Scheme → HQLS Lesson → Delivery & Evidence → Assessment → Diagnosis → Intervention → Next HQLS Lesson → Leadership Learning Signal"),
  "KSI 2.2 must explicitly supersede the old three-surface release copy while preserving the complete adult-operated learning loop.",
);

assert(
  securityRegression.includes("PASS — LIVE DATABASE SECURITY AUDIT") &&
    securityRegression.includes("no anonymous data exposure") &&
    securityRegression.includes("Guarded archive and destructive actions") &&
    securityRegression.includes("0 visible rows"),
  "Stage 6 must retain live isolation plus guarded lifecycle audit evidence.",
);

for (const required of [
  "requestedLessonId",
  'new URLSearchParams(window.location.search).get("lesson")',
  'id="hqls-selected-lesson"',
  'selectedLesson.status === "validated"',
  "Build Assessment",
]) {
  assert(hqlsClient.includes(required), `HQLS workflow continuity is missing: ${required}`);
}

for (const required of [
  "source_lesson_id",
  "applySourceLessonFromState",
  'requestedWorkflowId("lesson")',
  'requestedWorkflowId("assessment")',
  "Open Source HQLS Lesson",
  "Use in Diagnosis",
]) {
  assert(assessmentClient.includes(required), `Assessment workflow continuity is missing: ${required}`);
}

for (const required of [
  'router.push(`/hqls?lesson=${encodeURIComponent(lessonId)}`)',
  'next_lesson_id: lessonId',
  "Do not generate another lesson",
]) {
  assert(nextLessonClient.includes(required), `Intervention → HQLS continuity is missing: ${required}`);
}

for (const required of [
  'queryKey: "lesson" | "assessment"',
  'searchParams.get("edit") === "1"',
  "router.replace(`${resultPath}?${queryKey}=",
]) {
  assert(resultRedirect.includes(required), `Artifact result redirect is missing: ${required}`);
}

assert(
  hqlsPage.includes('resultPath="/hqls/result"') &&
    hqlsResultPage.includes("HqlsResultClient") &&
    hqlsResultClient.includes("HQLS Lesson Result") &&
    hqlsResultClient.includes("Build Assessment") &&
    hqlsResultClient.includes("Edit / Improve"),
  "HQLS creation and result surfaces must be separated.",
);

assert(
  assessmentPage.includes('resultPath="/assessment/result"') &&
    assessmentResultPage.includes("AssessmentResultClient") &&
    assessmentResultClient.includes("Assessment Result") &&
    assessmentResultClient.includes("Open Source HQLS Lesson") &&
    assessmentResultClient.includes("Use in Diagnosis"),
  "Assessment creation and result surfaces must be separated.",
);

for (const required of [
  "DiagnosisBuilderClient",
  'router.push(`/diagnosis/result?diagnosis=',
  "Assessment evidence loaded:",
  "Select learner",
]) {
  assert(diagnosisBuilder.includes(required), `Focused Diagnosis builder is missing: ${required}`);
}
assert(
  diagnosisPage.includes("DiagnosisBuilderClient") &&
    diagnosisResultPage.includes("DiagnosisResultClient") &&
    diagnosisResultClient.includes("Student Diagnosis Result") &&
    diagnosisResultClient.includes("Archive Diagnosis") &&
    diagnosisResultClient.includes("Permanent Delete") &&
    diagnosisResultClient.includes("Open Intervention"),
  "Diagnosis result/lifecycle separation is incomplete.",
);

assert(
  interventionPage.includes("InterventionWorkspaceClient") &&
    interventionWorkspace.includes('router.push(`/interventions/result?intervention=') &&
    interventionResultPage.includes("InterventionResultClient") &&
    interventionResultClient.includes("Action & Intervention Result") &&
    interventionResultClient.includes("Archive Intervention") &&
    interventionResultClient.includes("Permanent Delete") &&
    interventionResultClient.includes("Open Linked HQLS Lesson"),
  "Intervention result/lifecycle separation is incomplete.",
);

for (const required of [
  "Only a workspace Owner or Admin can archive or permanently delete diagnoses.",
  "Archive the linked intervention first",
  'diagnosis.status !== "archived"',
  "Permanent deletion is blocked while an intervention record still depends",
  'confirmation !== "DELETE"',
]) {
  assert(diagnosisManage.includes(required), `Diagnosis guarded lifecycle is missing: ${required}`);
}
for (const required of [
  "Only a workspace Owner or Admin can archive or permanently delete interventions.",
  'handoff.status !== "archived" && handoff.status !== "draft"',
  "provenance for a linked HQLS lesson",
  'confirmation !== "DELETE"',
]) {
  assert(interventionManage.includes(required), `Intervention guarded lifecycle is missing: ${required}`);
}

for (const required of [
  "check (status in ('draft', 'confirmed', 'archived'))",
  "Archived intervention handoffs are immutable",
  "Archive the linked intervention before archiving this diagnosis",
  "diagnoses_delete_admin_archived_dependency_free",
  "intervention_handoffs_delete_admin_guarded",
  "status = 'archived' and next_lesson_id is null",
]) {
  assert(lifecycleMigration.includes(required), `Guarded archive migration is missing: ${required}`);
}
assert(
  diagnosisPdf.includes('["final", "archived"].includes(diagnosis.status)'),
  "Approved diagnosis PDF must remain available after archival.",
);

for (const required of [
  "KAEC School Intelligence",
  "Teacher & Leadership learning intelligence",
  "Teacher workspace",
  "Leadership workspace",
  "Student-facing KSI has been retired",
]) {
  assert(dashboardClient.includes(required), `KSI 2.2 dashboard release copy is missing: ${required}`);
}
assert(
  dashboardClient.includes('href: "/hqls"') &&
    dashboardClient.includes('href: "/assessment"') &&
    dashboardClient.includes('href: "/diagnosis"') &&
    dashboardClient.includes('href: "/interventions"'),
  "Role-aware dashboard must preserve the complete closed learning loop.",
);
assert(
  dashboardPage.includes("School Intelligence Workspace") &&
    dashboardPage.includes("Teacher and Leadership Intelligence Workspace"),
  "Dashboard must retain the historical closed-loop marker while declaring the simplified active workspace.",
);
assert(
  setupClient.includes("Define the school context used across HQLS lessons, assessments and diagnoses.") &&
    resourceClient.includes("governed source context for HQLS lessons and assessments"),
  "Setup and Resource Library must describe the current connected product.",
);

const releaseCopySurfaces = [
  homePage,
  signInPage,
  dashboardPage,
  dashboardClient,
  setupClient,
  resourceClient,
  hqlsPage,
  hqlsResultPage,
  hqlsResultClient,
  assessmentPage,
  assessmentResultPage,
  assessmentResultClient,
  diagnosisPage,
  diagnosisBuilder,
  diagnosisResultPage,
  diagnosisResultClient,
  interventionPage,
  interventionWorkspace,
  interventionResultPage,
  interventionResultClient,
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
  "Stage 6 must keep quota-safe Vercel branch gating.",
);
assert(
  packageJson.includes('"verify:structure"') && packageJson.includes("verify-stage6.mjs"),
  "Permanent Stage 6 structural verification must remain enabled.",
);

console.log(
  "Stage 6 structure verification passed under KSI 2.2: the three-engine boundary, exact closed-loop handoffs, dedicated artifact result pages, guarded diagnosis/intervention archive lifecycle, simplified Teacher/Leadership navigation, live security evidence and quota-safe preview gating are present.",
);
