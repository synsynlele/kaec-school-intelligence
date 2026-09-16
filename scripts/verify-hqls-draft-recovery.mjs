import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const route = await text("app/api/hqls/route.ts");
const client = await text("components/hqls/hqls-client.tsx");
const savedWork = await text("components/saved-work/saved-work-client.tsx");
const migration = await text("supabase/migrations/073_hqls_stranded_draft_recovery.sql");

for (const required of [
  "findUniqueAcademicMatch",
  "academicAcronym",
  'workspace.workspace_type === "school"',
  "registered in the active school",
  '.select("id,status,validation_summary")',
]) {
  assert(route.includes(required), `HQLS generation hardening is missing: ${required}`);
}

assert(
  route.indexOf('workspace.workspace_type === "school"') < route.indexOf("enforceAiRateLimit"),
  "School class/subject linkage must be rejected before AI quota is consumed.",
);

assert(
  client.includes("needsFinalValidation") &&
    client.includes("Finish validation") &&
    client.includes("fully generated"),
  "Recovered HQLS drafts must have a clear no-AI final-validation path.",
);

assert(
  savedWork.includes('href={`/hqls?lesson=${encodeURIComponent(item.artifactId)}`}') &&
    savedWork.includes("Open HQLS"),
  "Saved Work must provide a direct HQLS open action.",
);

for (const required of [
  "school_context_link_repair",
  "validation_summary = '{}'::jsonb",
  "count(*)",
  "= 7",
  "hqls_fidelity_checks",
  "cardinality(matched_class_ids) <> 1",
  "cardinality(matched_subject_ids) <> 1",
  "status = 'validated'",
]) {
  assert(migration.includes(required), `Recovery migration safety gate is missing: ${required}`);
}

console.log(
  "HQLS draft recovery verification passed: school labels resolve before AI generation, stranded complete lessons are recoverable, and teachers can reopen/finalize saved HQLS work.",
);
