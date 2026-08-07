import { access, readFile } from "node:fs/promises";

const mustExist = [
  "AGENTS.md",
  "PROJECT_STATE.md",
  "docs/PRODUCT_CONSTITUTION.md",
  "docs/STAGE_1_PLATFORM_FOUNDATION.md",
  "docs/STAGE_2_HQLS_LESSON_INTELLIGENCE.md",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(path) {
  return readFile(path, "utf8");
}

for (const file of mustExist) {
  await access(file);
}

const state = await text("PROJECT_STATE.md");
assert(
  state.includes("KAEC School Intelligence"),
  "Project state is missing the KSI identity.",
);
assert(
  !state.toLowerCase().includes("pipupath"),
  "Project state must not depend on PipuPath.",
);

const migration = await text(
  "supabase/migrations/001_stage1_platform_foundation.sql",
);
for (const required of [
  "create table public.workspaces",
  "create table public.workspace_members",
  "create table public.profiles",
  "create table public.classes",
  "create table public.subjects",
  "create table public.resources",
  "create table public.lessons",
  "create table public.lesson_stages",
  "create table public.assessments",
  "create table public.assessment_items",
  "create table public.students",
  "create table public.student_evidence",
  "create table public.diagnoses",
  "create table public.artifact_versions",
  "create table public.artifact_resource_links",
  "create table public.ai_runs",
  "create table public.hqls_fidelity_checks",
  "create table public.generation_feedback",
  "enable row level security",
]) {
  assert(migration.includes(required), `Foundation migration is missing ${required}.`);
}

for (const table of [
  "workspaces",
  "workspace_members",
  "profiles",
  "classes",
  "subjects",
  "resources",
  "lessons",
  "lesson_stages",
  "assessments",
  "assessment_items",
  "students",
  "student_evidence",
  "diagnoses",
  "artifact_versions",
  "artifact_resource_links",
  "ai_runs",
  "hqls_fidelity_checks",
  "generation_feedback",
]) {
  assert(
    migration.includes(`alter table public.${table} enable row level security;`),
    `RLS is not enabled for ${table}.`,
  );
}

const appTree = [
  "app/page.tsx",
  "app/sign-in/page.tsx",
  "app/dashboard/page.tsx",
  "app/setup/page.tsx",
  "app/resources/page.tsx",
  "app/api/health/route.ts",
];
for (const path of appTree) await access(path);

const browserSupabase = await text("lib/supabase/browser.ts");
assert(
  !browserSupabase.includes("service_role") &&
    !browserSupabase.includes("SUPABASE_SERVICE_ROLE"),
  "Browser Supabase client must never reference a service-role credential.",
);

const env = await text("lib/env.ts");
assert(
  !env.includes("PIPUPATH"),
  "KSI environment configuration must not fall back to PipuPath.",
);

const setup = await text("components/setup/setup-client.tsx");
assert(
  setup.includes("create_workspace_with_owner"),
  "School setup must create the workspace through the secure owner bootstrap RPC.",
);

const resourceStorage = await text("lib/resources/storage.ts");
for (const required of [
  'KSI_RESOURCE_BUCKET = "ksi-resources"',
  "uploadWorkspaceResource",
  "downloadWorkspaceResource",
  "deleteWorkspaceResource",
]) {
  assert(
    resourceStorage.includes(required),
    `Resource storage service is missing ${required}.`,
  );
}

const storageMigration = await text(
  "supabase/migrations/005_stage1_private_resource_storage.sql",
);
for (const required of [
  "ksi-resources",
  "bucket_id = 'ksi-resources'",
  "storage.objects",
]) {
  assert(
    storageMigration.includes(required),
    `Private resource storage migration is missing ${required}.`,
  );
}

const migrationsToCheck = [
  "supabase/migrations/002_stage1_security_performance_hardening.sql",
  "supabase/migrations/003_stage1_tenant_integrity.sql",
  "supabase/migrations/004_stage1_school_workspace_bootstrap.sql",
  "supabase/migrations/005_stage1_private_resource_storage.sql",
  "supabase/migrations/006_stage1_resource_storage_integrity.sql",
  "supabase/migrations/007_stage1_artifact_version_rpc.sql",
  "supabase/migrations/008_stage1_hqls_lesson_structure.sql",
  "supabase/migrations/009_stage1_diagnosis_review_integrity.sql",
  "supabase/migrations/010_stage1_role_provenance_hardening.sql",
  "supabase/migrations/011_stage1_diagnosis_rpc_hardening.sql",
];
for (const migrationPath of migrationsToCheck) {
  await access(migrationPath);
}

const health = await text("app/api/health/route.ts");
assert(
  health.includes("zaoxfjbiizargeclnzmo.supabase.co"),
  "Health contract no longer pins the dedicated KSI Supabase project.",
);

const stage2Spec = await text("docs/STAGE_2_HQLS_LESSON_INTELLIGENCE.md");
assert(
  stage2Spec.includes("Generate seven-stage HQLS lesson") &&
    stage2Spec.includes("Independent Validation"),
  "Stage 2 HQLS acceptance contract is missing or incomplete.",
);
assert(
  stage2Spec.includes("OpenAI Responses API") &&
    stage2Spec.includes("Authenticated live OpenAI generation E2E"),
  "Stage 2 specification does not declare OpenAI as the active provider path.",
);
assert(
  !stage2Spec.includes("Gemini"),
  "Stage 2 specification still contains obsolete Gemini provider references.",
);

const officialLogo = await text("lib/branding/official-kaec-logo.ts");
assert(
  officialLogo.includes("KAEC_OFFICIAL_LOGO_DATA_URI") &&
    officialLogo.includes("data:image/png;base64,"),
  "The founder-approved official KAEC-NG logo asset is missing.",
);

for (const brandedSurface of [
  "app/page.tsx",
  "app/sign-in/page.tsx",
  "app/dashboard/page.tsx",
  "app/hqls/page.tsx",
]) {
  const surface = await text(brandedSurface);
  assert(
    surface.includes("KaecBrand"),
    `Official KAEC-NG branding is missing from ${brandedSurface}.`,
  );
}

const stage2Engine = await text("lib/hqls/engine.ts");
for (const required of [
  "HQLS_ENGINE_v1.0",
  "HQLS_PROMPT_v1.1",
  "validateHqlsLesson",
  "full_illumination_ignores_revealed_gaps",
  "trial_second_has_no_genuine_reattempt",
  "integration_reflection_missing",
  "reflectionPrompt",
  "readOptionalString",
  "teaching_content_outside_full_illumination",
]) {
  assert(
    stage2Engine.includes(required),
    `Stage 2 HQLS engine is missing ${required}.`,
  );
}

const stage2Route = await text("app/api/hqls/route.ts");
assert(
  stage2Route.includes("createLesson"),
  "Stage 2 route does not use canonical lesson persistence.",
);
assert(
  stage2Route.includes("record_hqls_system_fidelity_check") &&
    stage2Route.includes("artifact_resource_links"),
  "Stage 2 route is missing secure HQLS fidelity or source-provenance persistence.",
);
assert(
  !stage2Route.includes('.from("hqls_fidelity_checks").insert'),
  "Stage 2 route must not forge system fidelity through the direct authenticated table-insert path.",
);
assert(
  stage2Route.includes('action === "save_edits"') &&
    stage2Route.includes('action === "regenerate_stage"'),
  "Stage 2 route is missing edit or stage-regeneration flow.",
);
assert(
  stage2Route.includes('provider: "openai"') &&
    stage2Route.includes("generateOpenAIJson"),
  "Stage 2 route is not wired to OpenAI generation/provenance.",
);
assert(
  !stage2Route.includes("Gemini") && !stage2Route.includes('provider: "google"'),
  "Stage 2 route still contains obsolete Gemini/Google provider wiring.",
);

const openai = await text("lib/ai/openai.ts");
assert(
  openai.includes("process.env.OPENAI_API_KEY"),
  "OpenAI server credential lookup is missing.",
);
assert(
  openai.includes("https://api.openai.com/v1/responses"),
  "OpenAI adapter is not using the Responses API.",
);
assert(
  openai.includes('type: "json_schema"') && openai.includes("strict: true"),
  "OpenAI adapter is not using strict Structured Outputs.",
);
assert(
  openai.includes("store: false"),
  "OpenAI generation requests must explicitly disable provider response storage for KSI Stage 2.",
);
assert(
  openai.includes('"gpt-5-mini"'),
  "KSI default OpenAI model must remain on the approved cost-optimised gpt-5-mini tier unless deliberately re-evaluated.",
);
assert(
  !openai.includes("NEXT_PUBLIC_OPENAI"),
  "OpenAI credential must never be public/browser-scoped.",
);

const hqlsClient = await text("components/hqls/hqls-client.tsx");
assert(
  hqlsClient.includes("/api/hqls"),
  "HQLS teacher UI is not connected to the secure server route.",
);
assert(
  hqlsClient.includes("Reflection — how thinking changed") &&
    hqlsClient.includes("payload.validation"),
  "HQLS teacher UI must expose explicit reflection and fidelity failure details.",
);
for (const action of [
  "Improve",
  "Simplify",
  "Increase Challenge",
  "Make More Practical",
  "Reduce Resource Dependence",
  "Regenerate",
]) {
  assert(hqlsClient.includes(action), `HQLS stage action is missing: ${action}`);
}

const pdfRoute = await text("app/api/hqls/pdf/route.ts");
assert(
  pdfRoute.includes("createHqlsLessonPdf") &&
    pdfRoute.includes("Only a saved HQLS-validated lesson") &&
    pdfRoute.includes('"Content-Type": "application/pdf"'),
  "Stage 2 secure validated-lesson PDF export route is missing or incomplete.",
);

const pdfGenerator = await text("lib/pdf/hqls-lesson-pdf.ts");
for (const requirement of [
  "KAEC_REPORT_LOGO_JPEG_BASE64",
  "HQLS LESSON PLAN",
  "Guide Guardrails",
  "Full Illumination - teaching after struggle",
  "Reflection - how thinking changed",
  "HQLS VALIDATED",
]) {
  assert(
    pdfGenerator.includes(requirement),
    `Teacher-ready HQLS PDF is missing ${requirement}.`,
  );
}

console.log("KSI structural verification passed.");
