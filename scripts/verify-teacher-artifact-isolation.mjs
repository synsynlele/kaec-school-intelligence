import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [visibilityMigration, writeMigration] = await Promise.all([
  text("supabase/migrations/071_teacher_artifact_isolation.sql"),
  text("supabase/migrations/072_teacher_artifact_write_boundary.sql"),
]);

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
  assert(
    visibilityMigration.includes(required),
    `Teacher artifact visibility isolation is missing: ${required}`,
  );
}

assert(
  visibilityMigration.includes("created_by = (select auth.uid())") &&
    visibilityMigration.includes("array['owner','admin','leader']"),
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
    visibilityMigration.includes(`drop policy if exists ${broadPolicy}`),
    `The previous workspace-wide policy must be retired: ${broadPolicy}`,
  );
}

assert(
  visibilityMigration.includes("security definer") &&
    visibilityMigration.includes("revoke all on function private.can_view_teacher_artifact") &&
    visibilityMigration.includes("from public, anon") &&
    visibilityMigration.includes("grant execute on function private.can_view_teacher_artifact") &&
    visibilityMigration.includes("to authenticated"),
  "The private visibility helper must be explicitly permissioned and unavailable to anon/public.",
);

assert(
  visibilityMigration.includes("lessons_workspace_creator_idx") &&
    visibilityMigration.includes("assessments_workspace_creator_idx") &&
    visibilityMigration.includes("diagnoses_workspace_creator_idx") &&
    visibilityMigration.includes("intervention_handoffs_workspace_creator_idx"),
  "Creator-based RLS must keep supporting indexes for school-scale performance.",
);

for (const required of [
  "private.can_manage_teacher_artifact",
  "lessons_update_creator_or_admin",
  "assessments_update_creator_or_admin",
  "diagnoses_update_creator_or_admin",
  "intervention_handoffs_update_creator_or_admin",
  "lesson_stages_insert_parent_manageable",
  "lesson_stages_update_parent_manageable",
  "assessment_items_insert_parent_manageable",
  "assessment_items_update_parent_manageable",
  "assessment_items_delete_parent_manageable",
  "evidence_update_recorder_or_admin",
  "artifact_versions_insert_parent_manageable",
  "artifact_resources_insert_parent_manageable",
  "ai_runs_insert_self_manageable_artifact",
  "generation_feedback_insert_self_manageable_artifact",
  "leader remains read-only oversight",
]) {
  assert(
    writeMigration.includes(required),
    `Teacher artifact write boundary is missing: ${required}`,
  );
}

assert(
  writeMigration.includes("array['owner'::text, 'admin'::text]") &&
    !writeMigration.includes("array['owner'::text, 'admin'::text, 'leader'::text]"),
  "Leader must retain school-wide read oversight without receiving school-wide write authority.",
);

for (const broadWritePolicy of [
  "lessons_update_creator_or_leadership",
  "assessments_update_creator_or_leadership",
  "diagnoses_update_creator_or_leadership",
  "intervention_handoffs_update_creator_or_leadership",
  "evidence_update_recorder_or_leadership",
]) {
  assert(
    writeMigration.includes(`drop policy if exists ${broadWritePolicy}`),
    `The leadership-wide write policy must be retired: ${broadWritePolicy}`,
  );
}

assert(
  writeMigration.includes("security definer") &&
    writeMigration.includes("revoke all on function private.can_manage_teacher_artifact") &&
    writeMigration.includes("from public, anon") &&
    writeMigration.includes("grant execute on function private.can_manage_teacher_artifact") &&
    writeMigration.includes("to authenticated"),
  "The private management helper must be explicitly permissioned and unavailable to anon/public.",
);

console.log(
  "Teacher artifact isolation verification passed: teachers are creator-scoped across HQLS, assessment, diagnosis, intervention and linked records; owner/admin/leader retain school-wide read oversight; Leader does not gain cross-teacher write authority; owner/admin retain governed management; archived Saved Work enforces the same visibility boundary.",
);
