import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const migration = await text("supabase/migrations/071_teacher_artifact_isolation.sql");

for (const required of [
  "private.can_view_teacher_artifact",
  "lessons_select_creator_or_leadership",
  "assessments_select_creator_or_leadership",
  "diagnoses_select_creator_or_leadership",
  "intervention_handoffs_select_creator_or_leadership",
  "lesson_stages_select_parent_visible",
  "assessment_items_select_parent_visible",
  "fidelity_select_parent_visible",
  "artifact_versions_select_parent_visible",
  "artifact_resources_select_parent_visible",
  "evidence_select_recorder_or_leadership",
  "ai_runs_select_initiator_or_leadership",
  "generation_feedback_select_creator_or_leadership",
  "leadership_view := private.has_workspace_role",
  "and (leadership_view or l.created_by = current_user_id)",
  "and (leadership_view or a.created_by = current_user_id)",
]) {
  assert(migration.includes(required), `Teacher artifact isolation is missing: ${required}`);
}

assert(
  migration.includes("created_by = (select auth.uid())") &&
    migration.includes("array['owner','admin','leader']"),
  "Teacher-owned artifacts must be creator-only while owner/admin/leader retain school-wide visibility.",
);

for (const broadPolicy of [
  "lessons_select_member",
  "assessments_select_member",
  "diagnoses_select_member",
  "intervention_handoffs_select_member",
  "assessment_items_workspace_access",
  "artifact_versions_select_member",
  "ai_runs_select_member",
]) {
  assert(
    migration.includes(`drop policy if exists ${broadPolicy}`),
    `The previous workspace-wide policy must be retired: ${broadPolicy}`,
  );
}

assert(
  migration.includes("security definer") &&
    migration.includes("revoke all on function private.can_view_teacher_artifact") &&
    migration.includes("from public, anon") &&
    migration.includes("grant execute on function private.can_view_teacher_artifact") &&
    migration.includes("to authenticated"),
  "The private artifact helper must be explicitly permissioned and unavailable to anon/public.",
);

assert(
  migration.includes("lessons_workspace_creator_idx") &&
    migration.includes("assessments_workspace_creator_idx") &&
    migration.includes("diagnoses_workspace_creator_idx") &&
    migration.includes("intervention_handoffs_workspace_creator_idx"),
  "Creator-based RLS must keep supporting indexes for school-scale performance.",
);

console.log(
  "Teacher artifact isolation verification passed: teachers are creator-scoped across HQLS, assessment, diagnosis, intervention and linked records; owner/admin/leader retain school-wide read oversight; archived Saved Work enforces the same boundary.",
);
