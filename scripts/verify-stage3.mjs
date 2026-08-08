import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const spec = await text("docs/STAGE_3_ASSESSMENT_INTELLIGENCE.md");
for (const required of [
  "Assessment Intelligence",
  "Objective",
  "Subjective",
  "Critical Thinking",
  "Project",
  "Reality Simulation",
  "Imperfect Choice",
  "Hidden Problem",
  "Creation",
  "Crisis",
  "Independent Validation",
  "Lesson → Assessment",
  "gpt-5-mini",
]) {
  assert(spec.includes(required), `Stage 3 specification is missing ${required}.`);
}
assert(
  spec.includes("Diagnosis Intelligence remains Stage 4"),
  "Stage 3 specification has drifted into Diagnosis scope.",
);

const legacyEngine = await text("lib/assessment/engine.ts");
for (const required of [
  "validateAssessment",
  "objective_options_inadequate",
  "objective_answer_invalid",
  "marking_guide_missing",
  "critical_thinking_recall_risk",
  "project_deliverable_missing",
  "reality_simulation",
  "imperfect_choice",
  "hidden_problem",
  "creation",
  "crisis",
]) {
  assert(
    legacyEngine.includes(required),
    `Stage 3 base assessment engine is missing ${required}.`,
  );
}

const worldClass = await text("lib/assessment/world-class.ts");
for (const required of [
  "ASSESSMENT_ENGINE_v1.1",
  "ASSESSMENT_PROMPT_v1.1",
  "KAEC_ASSESSMENT_QUALITY_v1.0",
  "assignment",
  "quiz",
  "test",
  "exam",
  "project",
  "easy",
  "medium",
  "hard",
  "AssessmentTopicSpec",
  "requested_topic_missing",
  "item_topic_not_canonical",
  "topic_weight_misaligned",
  "overall_difficulty_misaligned",
  "duplicate_item_prompt",
  "objective_duplicate_options",
  "objective_answer_not_unique",
  "validity",
  "reliability",
  "fairness",
  "accessibility",
]) {
  assert(
    worldClass.includes(required),
    `Stage 3 world-class assessment model is missing ${required}.`,
  );
}
assert(
  !worldClass.includes("item.includes(requested)") &&
    !worldClass.includes("requested.includes(item)"),
  "Stage 3 topic weighting must use exact canonical topic labels, not substring matching.",
);
assert(
  worldClass.includes("item === requested"),
  "Stage 3 topic weighting is missing exact normalized topic matching.",
);

const route = await text("app/api/assessment-v11/route.ts");
for (const required of [
  "generateOpenAIJson",
  "createAssessment",
  "appendArtifactVersion",
  "artifact_resource_links",
  'artifact_type: "assessment"',
  'action: "generate"',
  'action: "save_edits"',
  '"gpt-5-mini"',
  "ASSESSMENT_ENGINE_VERSION_V11",
  "ASSESSMENT_PROMPT_VERSION_V11",
  "assessmentKind",
  "overallDifficulty",
  "requestedTopics",
  "qualitySummary",
  "ASSESSMENT_VALIDATION_FAILED",
]) {
  assert(route.includes(required), `Stage 3 v1.1 route is missing ${required}.`);
}
assert(
  !route.includes("SUPABASE_SERVICE_ROLE_KEY") && !route.includes("Gemini"),
  "Stage 3 v1.1 route contains forbidden privileged or obsolete provider wiring.",
);

const client = await text(
  "components/assessment/world-class-assessment-client.tsx",
);
for (const required of [
  "/api/assessment-v11",
  "Source HQLS lesson",
  "Assessment type",
  "Overall difficulty",
  "Topics, objectives and weighting",
  "+ Add topic",
  "Question-format distribution",
  "Critical Thinking",
  "Project",
  "Save edits",
  "Download PDF",
  "sm:grid-cols-2",
]) {
  assert(client.includes(required), `Stage 3 v1.1 UI is missing ${required}.`);
}

const page = await text("app/assessment/page.tsx");
assert(
  page.includes("KaecBrand") &&
    page.includes("WorldClassAssessmentClient") &&
    page.includes('href="/saved-work"'),
  "Stage 3 assessment page is missing official branding, the v1.1 workspace or Saved Work navigation.",
);

const hqlsPage = await text("app/hqls/page.tsx");
assert(
  hqlsPage.includes('href="/saved-work"') &&
    hqlsPage.includes("Manage Saved Work"),
  "HQLS does not expose the shared Saved Work lifecycle manager.",
);

const lifecycleSpec = await text("docs/STAGE_3_SAVED_WORK_LIFECYCLE.md");
for (const required of [
  "Active → Archive → Restore or Permanent Delete",
  "typed confirmation `DELETE`",
  "Student Evidence or Diagnosis",
  "creator or workspace owner/admin",
  "/saved-work",
]) {
  assert(
    lifecycleSpec.includes(required),
    `Stage 3 saved-work lifecycle specification is missing ${required}.`,
  );
}

const lifecycleMigration = await text(
  "supabase/migrations/013_saved_work_lifecycle.sql",
);
for (const required of [
  "list_archived_saved_work",
  "manage_saved_artifact",
  "status <> 'archived'",
  "source_lesson_id",
  "student_evidence",
  "diagnoses",
  "artifact_versions",
  "artifact_resource_links",
  "ai_runs",
  "SECURITY DEFINER",
]) {
  assert(
    lifecycleMigration.includes(required),
    `Stage 3 saved-work migration is missing ${required}.`,
  );
}
assert(
  lifecycleMigration.includes("Archive this item before permanently deleting it."),
  "Permanent deletion must remain a two-step archive-then-delete action.",
);

const savedWorkRoute = await text("app/api/saved-work/route.ts");
for (const required of [
  "list_archived_saved_work",
  "manage_saved_artifact",
  'body.confirmation !== "DELETE"',
  "Bearer ",
]) {
  assert(
    savedWorkRoute.includes(required),
    `Saved Work API is missing ${required}.`,
  );
}
assert(
  !savedWorkRoute.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Saved Work API must not use service-role credentials.",
);

const savedWorkClient = await text(
  "components/saved-work/saved-work-client.tsx",
);
for (const required of [
  "Archive",
  "Restore",
  "Permanent Delete",
  'confirmation !== "DELETE"',
  "dependencyCount",
  "sm:flex-row",
]) {
  assert(
    savedWorkClient.includes(required),
    `Saved Work client is missing ${required}.`,
  );
}

const savedWorkPage = await text("app/saved-work/page.tsx");
assert(
  savedWorkPage.includes("KaecBrand") &&
    savedWorkPage.includes("SavedWorkClient") &&
    savedWorkPage.includes('href="/hqls"') &&
    savedWorkPage.includes('href="/assessment"'),
  "Shared Saved Work page is missing branding or module navigation.",
);

const pdf = await text("lib/pdf/assessment-pdf.ts");
for (const required of [
  "KAEC_REPORT_LOGO_JPEG_BASE64",
  "STUDENT ASSESSMENT",
  "TEACHER ANSWER & MARKING GUIDE",
  "Assessment Intelligence",
]) {
  assert(pdf.includes(required), `Stage 3 PDF is missing ${required}.`);
}

const pdfRoute = await text("app/api/assessment/pdf/route.ts");
assert(
  pdfRoute.includes("Only a saved validated assessment") &&
    pdfRoute.includes('"Content-Type": "application/pdf"'),
  "Stage 3 PDF route does not enforce validated authenticated export.",
);

const openai = await text("lib/ai/openai.ts");
assert(
  openai.includes('"gpt-5-mini"') &&
    openai.includes("process.env.KSI_OPENAI_MODEL"),
  "KSI cost-optimised OpenAI default/override contract is missing.",
);

const dashboard = await text("app/dashboard/page.tsx");
assert(
  dashboard.includes('href="/assessment"') &&
    /Assessment(s| Intelligence)?/.test(dashboard),
  "Dashboard does not preserve access to Stage 3 Assessment Intelligence.",
);

console.log(
  "Stage 3 structural verification passed: Assessment Intelligence v1.1 protects multi-topic weighted blueprints, canonical topic labels, assessment type, overall difficulty, quality validation, OpenAI generation, responsive editing, Lesson-to-Assessment traceability, branded PDF export and guarded Archive/Restore/Permanent Delete lifecycle management.",
);
