import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [migration, resources, review, repairApi, ingestion] = await Promise.all([
  text("supabase/migrations/074_scheme_class_context_generalization.sql"),
  text("components/resources/academic-resources-client.tsx"),
  text("components/curriculum/scheme-review-client.tsx"),
  text("app/api/curriculum/scheme-repair/route.ts"),
  text("components/workspace/scheme-ingestion-client.tsx"),
]);

for (const required of [
  "DROP CONSTRAINT IF EXISTS scheme_entries_class_level_check",
  "normalize_scheme_class_label",
  "char_length(btrim(class_level)) BETWEEN 1 AND 80",
  "FROM public.classes c",
  "FROM public.subjects s",
  "The selected class is not configured in this school.",
  "unnest(doc.class_scope)",
  "stage_scheme_entries",
  "get_scheme_review_page",
  "get_academic_resource_catalog",
  "replace_scheme_class_extraction",
]) {
  assert(
    migration.includes(required),
    `Scheme class-context migration is missing: ${required}`,
  );
}

assert(
  !migration.includes("target_class_level NOT IN ('JSS1'") &&
    !migration.includes("class_level in ('JSS1'"),
  "The active scheme class-context migration must not reintroduce a secondary-only class allowlist.",
);

for (const required of [
  '.from("classes")',
  '.from("subjects")',
  "setupClasses",
  "setupSubjects",
  "isLegacyClassFilterError",
  "sameClassLabel",
]) {
  assert(
    resources.includes(required),
    `Academic Resources must be driven by school setup: ${required}`,
  );
}

assert(
  !resources.includes('const DEFAULT_CLASS = "JSS1"'),
  "Academic Resources must not default every school to JSS1.",
);

assert(
  review.includes("classOptions") &&
    review.includes("document.class_scope") &&
    !review.includes("['JSS1','JSS2','JSS3','SS1','SS2','SS3'].map"),
  "Scheme review class filters and editing must be source-driven.",
);

assert(
  repairApi.includes("extractionSchema(classLevel)") &&
    repairApi.includes("document.class_scope?.includes(classLevel)") &&
    !repairApi.includes('const CLASSES = ["JSS1"'),
  "Scheme source repair must derive its class contract from the registered source.",
);

assert(
  ingestion.includes('label="Education levels"') &&
    ingestion.includes('label="Source classes"') &&
    !ingestion.includes('label="Junior"') &&
    !ingestion.includes('label="Senior"'),
  "Scheme ingestion metrics must not assume junior/senior-only schools.",
);

console.log(
  "Scheme class-context verification passed: school setup drives operational classes, source scope drives ingestion/review, and no active UI/API path assumes JSS/SS only.",
);
