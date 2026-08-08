import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  spec,
  engine,
  api,
  page,
  client,
  pdf,
  reviewMigration,
  conciseMigration,
  conciseFreshnessMigration,
  conciseSyncMigration,
  database,
  diagnosisData,
  dashboard,
  openai,
] = await Promise.all([
  text("docs/STAGE_4_STUDENT_DIAGNOSIS_INTELLIGENCE.md"),
  text("lib/diagnosis/engine.ts"),
  text("app/api/diagnosis/route.ts"),
  text("app/diagnosis/page.tsx"),
  text("components/diagnosis/diagnosis-client.tsx"),
  text("lib/pdf/diagnosis-pdf.ts"),
  text("supabase/migrations/014_stage4_diagnosis_review_freshness.sql"),
  text("supabase/migrations/015_stage4_concise_diagnosis.sql"),
  text("supabase/migrations/016_stage4_concise_diagnosis_review_freshness.sql"),
  text("supabase/migrations/017_stage4_concise_diagnosis_sync.sql"),
  text("lib/supabase/database.ts"),
  text("lib/data/diagnoses.ts"),
  text("app/dashboard/page.tsx"),
  text("lib/ai/openai.ts"),
]);

for (const required of [
  "Observed Evidence → Detected Pattern → Possible Interpretation → Recommended Action",
  "Quick Teacher Diagnosis",
  "Assessment-Based Diagnosis",
  "Combined Diagnosis",
  "Insufficient Evidence",
  "Generate → Teacher Review → Edit if needed → Mark Reviewed → Owner/Admin Approve → Preview Parent Report → Download",
]) {
  assert(spec.includes(required), `Stage 4 contract is missing: ${required}`);
}

for (const required of [
  'DIAGNOSIS_ENGINE_v1.0',
  'DIAGNOSIS_PROMPT_v1.0',
  'KAEC_DIAGNOSIS_QUALITY_v1.0',
  "validateDiagnosis",
  "buildDiagnosisRepairPrompt",
  "CLINICAL_LABEL",
  "UNSUPPORTED_CAUSAL_CERTAINTY",
  "INSUFFICIENT_EVIDENCE_NOT_STATED",
  "evidenceIds",
  "confidence",
  "uncertaintyNote",
  "conciseDiagnosis",
]) {
  assert(engine.includes(required), `Diagnosis engine is missing: ${required}`);
}

for (const required of [
  "recordStudentEvidence",
  "createDiagnosisDraft",
  "reviewDiagnosis",
  "finaliseDiagnosis",
  'schemaName: "ksi_student_diagnosis"',
  'schemaName: "ksi_student_diagnosis_repair"',
  '"gpt-5-mini"',
  "DIAGNOSIS_VALIDATION_FAILED",
]) {
  assert(api.includes(required), `Diagnosis API is missing: ${required}`);
}

assert(page.includes("DiagnosisClient"), "Diagnosis page must render the Stage 4 workspace.");
for (const required of [
  "Quick Teacher Diagnosis",
  "Assessment-Based Diagnosis",
  "Combined Diagnosis",
  "Add item-level evidence",
  "Mark Reviewed",
  "Approve Final Report",
  "Parent Report Preview",
  "Download Parent PDF",
]) {
  assert(client.includes(required), `Diagnosis client is missing: ${required}`);
}

for (const required of [
  "KAEC_REPORT_LOGO_JPEG_BASE64",
  "STUDENT GROWTH & DIAGNOSIS REPORT",
  "Academics / Skills - Strengths",
  "Character (Discipline) - Challenges",
  "Builder Growth Direction",
  "educational growth report, not a medical, psychiatric or psychological diagnosis",
]) {
  assert(pdf.includes(required), `Parent diagnosis PDF is missing: ${required}`);
}

for (const required of [
  "diagnoses_review_freshness",
  "Final diagnoses are immutable",
  "new.status := 'draft'",
  "new.reviewed_by := null",
]) {
  assert(reviewMigration.includes(required), `Diagnosis review-freshness migration is missing: ${required}`);
}

assert(
  conciseMigration.includes("concise_diagnosis text not null default ''") &&
    conciseMigration.includes("grant update") &&
    conciseMigration.includes("concise_diagnosis"),
  "Stage 4 must persist concise diagnosis as first-class reviewed data.",
);
assert(
  conciseFreshnessMigration.includes("new.concise_diagnosis is distinct from old.concise_diagnosis") &&
    conciseFreshnessMigration.includes("Final diagnoses are immutable"),
  "Concise diagnosis must participate in review invalidation and final immutability.",
);
assert(
  conciseSyncMigration.includes("sync_diagnosis_concise_summary") &&
    conciseSyncMigration.includes("new.concise_diagnosis"),
  "Stage 4 concise-diagnosis compatibility bridge is missing.",
);
assert(
  database.includes("concise_diagnosis: string") &&
    diagnosisData.includes("concise_diagnosis: input.conciseDiagnosis"),
  "Typed Stage 4 persistence must expose the first-class concise diagnosis field.",
);

assert(dashboard.includes('href="/diagnosis"'), "Dashboard must expose Diagnosis Intelligence.");
assert(openai.includes('"gpt-5-mini"'), "KSI must retain gpt-5-mini as the core OpenAI default.");
assert(!engine.toLowerCase().includes("diagnose adhd"), "Diagnosis engine must not instruct clinical diagnosis.");

console.log("Stage 4 structure verification passed: evidence hierarchy, three diagnosis modes, deterministic safety/uncertainty validation, first-class concise diagnosis, human review/approval, parent report and gpt-5-mini policy are present.");
