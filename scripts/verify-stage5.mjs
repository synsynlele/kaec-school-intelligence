import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  spec,
  migration,
  actorIndexMigration,
  retentionMigration,
  derivation,
  database,
  interventionClient,
  interventionPage,
  nextLessonClient,
  nextLessonPage,
  hqlsApi,
  diagnosisPage,
  dashboard,
  vercel,
] = await Promise.all([
  text("docs/STAGE_5_ACTION_INTERVENTION_HANDOFF.md"),
  text("supabase/migrations/021_stage5_intervention_handoff.sql"),
  text("supabase/migrations/022_stage5_handoff_actor_indexes.sql"),
  text("supabase/migrations/023_stage5_confirmed_handoff_retention.sql"),
  text("lib/intervention/plan.ts"),
  text("lib/supabase/database.ts"),
  text("components/interventions/intervention-client.tsx"),
  text("app/interventions/page.tsx"),
  text("components/interventions/next-lesson-client.tsx"),
  text("app/interventions/next-lesson/page.tsx"),
  text("app/api/hqls/route.ts"),
  text("app/diagnosis/page.tsx"),
  text("app/dashboard/page.tsx"),
  text("vercel.json"),
]);

for (const required of [
  "not a fourth intelligence engine",
  "Final Diagnosis → Intervention Handoff → Human Confirmation → Next HQLS Lesson",
  "Final Diagnosis → Confirmed Intervention → Next HQLS Lesson",
  "`/api/hqls` generation path",
  "do not name the target learner",
  "Confirmed intervention content is immutable",
  "[skip vercel]",
]) {
  assert(spec.includes(required), `Stage 5 contract is missing: ${required}`);
}

for (const required of [
  "create table public.intervention_handoffs",
  "diagnosis_id uuid not null unique",
  "status text not null default 'draft'",
  "check (status in ('draft', 'confirmed'))",
  "priority_growth_target",
  "evidence_basis",
  "school_intervention",
  "parent_intervention",
  "success_indicator",
  "review_date",
  "next_learning_adjustment",
  "next_lesson_id",
  "enable row level security",
  "revoke all on table public.intervention_handoffs from anon",
  "source_status <> 'final'",
  "Intervention diagnosis provenance is immutable",
  "Confirmed intervention handoffs are immutable",
  "Only confirmed intervention handoffs may link to a next HQLS lesson",
  "The next HQLS lesson must belong to the same workspace",
]) {
  assert(migration.includes(required), `Stage 5 migration is missing: ${required}`);
}

assert(
  migration.includes("private.is_workspace_member") &&
    migration.includes("private.has_workspace_role"),
  "Stage 5 RLS must preserve workspace membership and admin boundaries.",
);
assert(
  migration.includes("new.confirmed_by := (select auth.uid())") &&
    migration.includes("new.confirmed_at := now()"),
  "Stage 5 confirmation must record the human actor and timestamp.",
);
assert(
  actorIndexMigration.includes("intervention_handoffs_created_by_idx") &&
    actorIndexMigration.includes("intervention_handoffs_confirmed_by_idx"),
  "Stage 5 actor foreign keys must remain covered by indexes.",
);
assert(
  retentionMigration.includes("intervention_handoffs_delete_admin_draft_only") &&
    retentionMigration.includes("status = 'draft'"),
  "Confirmed Stage 5 handoffs must remain durable audit history; only draft cleanup may be deleted.",
);

for (const required of [
  "InterventionHandoffRow",
  "InterventionHandoffInsert",
  "InterventionHandoffUpdate",
  "intervention_handoffs: InterventionHandoffTable",
  "next_lesson_id",
  "confirmed_by",
]) {
  assert(database.includes(required), `Typed Stage 5 database overlay is missing: ${required}`);
}

for (const required of [
  "deriveInterventionDraft",
  "builder_growth_direction",
  "school_academic_actions",
  "parent_academic_actions",
  "school_character_actions",
  "parent_character_actions",
  "dateAfterDays(14",
  "Use the next HQLS lesson",
  "Full Illumination",
]) {
  assert(derivation.includes(required), `Stage 5 derivation is missing: ${required}`);
}

assert(
  !derivation.includes("generateOpenAI") && !derivation.includes("@/lib/ai/openai"),
  "Stage 5 derivation must remain deterministic and must not become a fourth AI engine.",
);
assert(
  !interventionClient.includes("generateOpenAI") &&
    !interventionClient.includes("@/lib/ai/openai") &&
    !interventionClient.includes('from "@supabase/supabase-js"') &&
    !interventionClient.includes("as unknown as SupabaseClient"),
  "Intervention handoff workspace must use the typed KSI client and must not invoke a new AI engine.",
);

for (const required of [
  'eq("status", "final")',
  "deriveInterventionDraft",
  'status: "draft"',
  'status: "confirmed"',
  "Confirm Intervention",
  "Priority Growth Target",
  "Evidence Basis",
  "School Intervention",
  "Parent Intervention",
  "Success Indicator",
  "Next Learning Adjustment",
  'href="/interventions/next-lesson"',
]) {
  assert(
    interventionClient.includes(required),
    `Stage 5 intervention workspace is missing: ${required}`,
  );
}

assert(
  interventionPage.includes("InterventionClient") &&
    interventionPage.includes('href="/interventions/next-lesson"'),
  "Stage 5 intervention page must expose the next-lesson handoff.",
);
assert(
  diagnosisPage.includes('href="/interventions"'),
  "Final diagnosis workflow must expose Stage 5 interventions.",
);
assert(
  dashboard.includes("School Intelligence Workspace") &&
    dashboard.includes('href="/interventions"') &&
    dashboard.includes('href="/hqls"'),
  "Dashboard must expose the complete closed learning loop without relying on development-stage labels.",
);

for (const required of [
  'fetch("/api/hqls"',
  'action: "generate"',
  "Confirmed intervention baseline",
  "Do not name, label or single out any learner",
  "inclusive class-level differentiation",
  'from("intervention_handoffs")',
  "next_lesson_id: lessonId",
  "This intervention already has a linked next HQLS lesson",
]) {
  assert(
    nextLessonClient.includes(required),
    `Stage 5 closed-loop starter is missing: ${required}`,
  );
}
assert(
  !nextLessonClient.includes("generateOpenAI") &&
    !nextLessonClient.includes("@/lib/ai/openai") &&
    !nextLessonClient.includes('from "@supabase/supabase-js"') &&
    !nextLessonClient.includes("as unknown as SupabaseClient"),
  "Stage 5 must use the typed KSI client and reuse the existing HQLS API instead of introducing a new AI generation path.",
);
assert(
  nextLessonPage.includes("NextLessonClient") &&
    nextLessonPage.includes("Closed Learning Loop"),
  "Stage 5 next-lesson route must remain available without requiring a development-stage label in the product UI.",
);
assert(
  hqlsApi.includes('if (body.action === "generate")') &&
    hqlsApi.includes("handleGenerate"),
  "The authoritative existing HQLS generation route must remain available for Stage 5 reuse.",
);
assert(
  vercel.includes("ignoreCommand") && vercel.includes("[skip vercel"),
  "Stage 5 must retain Vercel deployment batching discipline.",
);

console.log(
  "Stage 5 structure verification passed: final-diagnosis gate, deterministic intervention derivation, typed human-confirmed tenant-safe immutable handoff, durable confirmed retention, indexed provenance actors, product navigation, no fourth AI engine, and confirmed intervention -> existing HQLS closed-loop generation are present.",
);
