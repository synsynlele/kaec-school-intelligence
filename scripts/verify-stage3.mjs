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

const engine = await text("lib/assessment/engine.ts");
for (const required of [
  "ASSESSMENT_ENGINE_v1.0",
  "ASSESSMENT_PROMPT_v1.0",
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
  assert(engine.includes(required), `Stage 3 assessment engine is missing ${required}.`);
}

const route = await text("app/api/assessment/route.ts");
for (const required of [
  "generateOpenAIJson",
  "createAssessment",
  "appendArtifactVersion",
  "artifact_resource_links",
  'artifact_type: "assessment"',
  'action: "generate"',
  'action: "save_edits"',
  '"gpt-5-mini"',
  "ASSESSMENT_VALIDATION_FAILED",
]) {
  assert(route.includes(required), `Stage 3 assessment route is missing ${required}.`);
}
assert(
  !route.includes("SUPABASE_SERVICE_ROLE_KEY") && !route.includes("Gemini"),
  "Stage 3 route contains forbidden privileged or obsolete provider wiring.",
);

const client = await text("components/assessment/assessment-client.tsx");
for (const required of [
  "/api/assessment",
  "Source HQLS lesson",
  "Mixed item distribution",
  "Critical Thinking",
  "Project",
  "Save edits",
  "Download PDF",
  "sm:grid-cols-2",
]) {
  assert(client.includes(required), `Stage 3 assessment UI is missing ${required}.`);
}

const page = await text("app/assessment/page.tsx");
assert(
  page.includes("KaecBrand") && page.includes("AssessmentClient"),
  "Stage 3 assessment page is missing official branding or the assessment workspace.",
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
  openai.includes('"gpt-5-mini"') && openai.includes("process.env.KSI_OPENAI_MODEL"),
  "KSI cost-optimised OpenAI default/override contract is missing.",
);

const dashboard = await text("app/dashboard/page.tsx");
assert(
  dashboard.includes('href="/assessment"') && dashboard.includes("Stage 3 active"),
  "Dashboard does not expose Stage 3 Assessment Intelligence.",
);

console.log("Stage 3 structural verification passed: assessment constitution, OpenAI generation, independent validation, responsive workspace, Lesson-to-Assessment traceability and branded student/teacher PDF export are present.");
