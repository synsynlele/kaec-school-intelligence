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
  pdfRoute,
  reviewMigration,
  conciseMigration,
  conciseFreshnessMigration,
  conciseSyncMigration,
  reportContextMigration,
  database,
  diagnosisData,
  dashboard,
  openai,
  vercel,
] = await Promise.all([
  text("docs/STAGE_4_STUDENT_DIAGNOSIS_INTELLIGENCE.md"),
  text("lib/diagnosis/engine.ts"),
  text("app/api/diagnosis/route.ts"),
  text("app/diagnosis/page.tsx"),
  text("components/diagnosis/kaec-diagnosis-client.tsx"),
  text("lib/pdf/diagnosis-pdf.ts"),
  text("app/api/diagnosis/pdf/route.ts"),
  text("supabase/migrations/014_stage4_diagnosis_review_freshness.sql"),
  text("supabase/migrations/015_stage4_concise_diagnosis.sql"),
  text("supabase/migrations/016_stage4_concise_diagnosis_review_freshness.sql"),
  text("supabase/migrations/017_stage4_concise_diagnosis_sync.sql"),
  text("supabase/migrations/018_stage4_parent_report_context.sql"),
  text("lib/supabase/database.ts"),
  text("lib/data/diagnoses.ts"),
  text("app/dashboard/page.tsx"),
  text("lib/ai/openai.ts"),
  text("vercel.json"),
]);

for (const required of [
  "Observed Evidence → Detected Pattern → Possible Interpretation → Recommended Action",
  "Quick Teacher Diagnosis",
  "Assessment-Based Diagnosis",
  "Combined Diagnosis",
  "Insufficient Evidence",
  "KAEC first-hand teacher input sheet",
  "Academic / Skills Strength Indicators",
  "Character Challenge Indicators",
  "Academic Session and Term",
  "landscape diagnosis-sheet matrix",
  "Generate → Teacher Review → Edit if needed → Mark Reviewed → Owner/Admin Approve → Preview Parent Report → Download",
  "[skip vercel]",
]) {
  assert(spec.includes(required), `Stage 4 contract is missing: ${required}`);
}

for (const required of [
  "DIAGNOSIS_ENGINE_v1.0",
  "DIAGNOSIS_PROMPT_v1.0",
  "KAEC_DIAGNOSIS_QUALITY_v1.0",
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

assert(
  page.includes("KaecDiagnosisClient"),
  "Diagnosis page must render the strengthened KAEC diagnosis workspace.",
);

for (const required of [
  "KAEC first-hand diagnosis sheet",
  "Academic / Skills Observations",
  "Character / Discipline Observations",
  "Academic / Skills Strength Indicators",
  "Academic / Skills Challenge Indicators",
  "Character Strength Indicators",
  "Character Challenge Indicators",
  "Academic Session",
  "Select term",
  "set_diagnosis_report_context",
  "Assessment-Based Diagnosis",
  "Combined Diagnosis",
  "Add item-level evidence",
  "Internal evidence review",
  "Parent-facing KAEC sheet",
  "ACADEMICS / SKILLS",
  "CHARACTER (Discipline)",
  "ACTION PLAN (Academics / Skills)",
  "ACTION PLAN (Character)",
  "Mark Reviewed",
  "Approve Final Report",
  "Parent Report Preview",
  "Download Parent PDF",
]) {
  assert(client.includes(required), `KAEC diagnosis client is missing: ${required}`);
}

for (const required of [
  "KAEC_REPORT_LOGO_JPEG_BASE64",
  "STUDENT DIAGNOSIS",
  "DIAGNOSIS:",
  "ACADEMICS / SKILLS",
  "CHARACTER (Discipline)",
  "ACTION PLAN (Academics / Skills)",
  "ACTION PLAN (Character)",
  "SCHOOL APPROVAL",
  "GROWTH & REVIEW NOTES",
  "Builder Growth Direction",
  "educational growth report, not a medical, psychiatric or psychological diagnosis",
]) {
  assert(pdf.includes(required), `Parent diagnosis PDF is missing: ${required}`);
}

assert(
  pdf.includes("PAGE_WIDTH = 841.89") && pdf.includes("PAGE_HEIGHT = 595.28"),
  "KAEC parent diagnosis PDF must use the landscape diagnosis-sheet layout.",
);
assert(
  pdfRoute.includes("diagnosis.academic_session") &&
    pdfRoute.includes("diagnosis.term") &&
    pdfRoute.includes("row.concise_diagnosis"),
  "Parent PDF route must use first-class Session, Term and Concise Diagnosis fields.",
);

for (const required of [
  "diagnoses_review_freshness",
  "Final diagnoses are immutable",
  "new.status := 'draft'",
  "new.reviewed_by := null",
]) {
  assert(
    reviewMigration.includes(required),
    `Diagnosis review-freshness migration is missing: ${required}`,
  );
}

assert(
  conciseMigration.includes("concise_diagnosis text not null default ''") &&
    conciseMigration.includes("grant update") &&
    conciseMigration.includes("concise_diagnosis"),
  "Stage 4 must persist concise diagnosis as first-class reviewed data.",
);
assert(
  conciseFreshnessMigration.includes(
    "new.concise_diagnosis is distinct from old.concise_diagnosis",
  ) && conciseFreshnessMigration.includes("Final diagnoses are immutable"),
  "Concise diagnosis must participate in review invalidation and final immutability.",
);
assert(
  conciseSyncMigration.includes("sync_diagnosis_concise_summary") &&
    conciseSyncMigration.includes("new.concise_diagnosis"),
  "Stage 4 concise-diagnosis compatibility bridge is missing.",
);

for (const required of [
  "academic_session text not null default ''",
  "term text not null default ''",
  "set_diagnosis_report_context",
  "new.academic_session is distinct from old.academic_session",
  "new.term is distinct from old.term",
  "Final diagnoses are immutable",
  "Active workspace membership required",
]) {
  assert(
    reportContextMigration.includes(required),
    `Stage 4 report-context migration is missing: ${required}`,
  );
}

assert(
  database.includes("concise_diagnosis: string") &&
    database.includes("academic_session: string") &&
    database.includes("term: string") &&
    database.includes("set_diagnosis_report_context") &&
    diagnosisData.includes("concise_diagnosis: input.conciseDiagnosis"),
  "Typed Stage 4 persistence must expose concise diagnosis and parent-report context.",
);

assert(
  vercel.includes('"deploymentEnabled"') &&
    vercel.includes('"*": false') &&
    vercel.includes('"main": true') &&
    vercel.includes('"*-preview": true') &&
    !vercel.includes("ignoreCommand"),
  "Vercel must use quota-safe branch gating while preserving deliberate preview and main deployments.",
);
assert(
  dashboard.includes('href="/diagnosis"'),
  "Dashboard must expose Diagnosis Intelligence.",
);
assert(
  openai.includes('"gpt-5-mini"'),
  "KSI must retain gpt-5-mini as the core OpenAI default.",
);
assert(
  engine.includes(
    "Do not diagnose ADHD, autism, dyslexia, depression, disorders, personality, intelligence or any clinical/psychological condition.",
  ),
  "Diagnosis engine must explicitly prohibit clinical and psychological diagnosis.",
);

console.log(
  "Stage 4 structure verification passed: KAEC first-hand teacher intake, evidence hierarchy, three diagnosis modes, deterministic safety/uncertainty validation, first-class Session/Term/concise diagnosis, reviewed KAEC parent-sheet matrix, human review/approval, quota-safe Vercel branch gating and gpt-5-mini policy are present.",
);
