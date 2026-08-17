import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  amendment,
  accessMigration,
  studentMigration,
  leadershipMigration,
  syncMigration,
  masteryMigration,
  curriculumMigration,
  accessRedeemFix,
  schoolAccessClient,
  studentHome,
  studentLearning,
  studentMastery,
  leadershipHome,
  dashboard,
  packageJson,
] = await Promise.all([
  text("docs/KSI_2_CONSTITUTIONAL_AMENDMENT.md"),
  text("supabase/migrations/026_stage7_ksi2_access_identity_foundation.sql"),
  text("supabase/migrations/033_stage8_student_learning_intelligence_rpc.sql"),
  text("supabase/migrations/032_stage9_leadership_learning_intelligence_rpc.sql"),
  text("supabase/migrations/039_stage10_learning_link_backbone.sql"),
  text("supabase/migrations/047_stage11_mastery_graph_next_learning.sql"),
  text("supabase/migrations/050_stage12_curriculum_intelligence_foundation.sql"),
  text("supabase/migrations/057_stage8_student_access_redeem_conflict_fix.sql"),
  text("components/admin/school-access-client.tsx"),
  text("components/student/student-home-client.tsx"),
  text("components/student/student-learning-library.tsx"),
  text("components/student/student-mastery-client.tsx"),
  text("components/leadership/leadership-home-client.tsx"),
  text("app/dashboard/page.tsx"),
  text("package.json"),
]);

for (const required of [
  "Teacher Intelligence",
  "Student Intelligence",
  "Leadership Intelligence",
  "active",
  "paused",
  "blocked",
  "disabled",
  "owner",
  "admin",
  "leader",
  "teacher",
  "student",
]) {
  assert(amendment.includes(required), `KSI 2.0 constitutional amendment is missing: ${required}`);
}

for (const required of [
  "access_status in ('active','paused','blocked','disabled')",
  "platform_access_admins",
  "school_access_audit",
  "student_accounts",
  "private.is_platform_access_admin()",
  "set_school_access_status",
  "check (role in ('owner','admin','leader','teacher','student'))",
]) {
  assert(accessMigration.includes(required), `KSI 2.0 access foundation is missing: ${required}`);
}

assert(
  accessRedeemFix.includes("create or replace function public.redeem_student_access_code") &&
    accessRedeemFix.includes("on conflict on constraint workspace_members_pkey") &&
    !accessRedeemFix.includes("on conflict (workspace_id, user_id)"),
  "Student Access Code redemption must use the named workspace-members key and avoid the PL/pgSQL workspace_id conflict-target ambiguity.",
);

assert(
  studentMigration.includes("get_my_learning_intelligence") &&
    studentHome.includes("What should I work on today?") &&
    studentHome.includes("get_my_learning_intelligence"),
  "Student KSI must remain connected to the governed shared learning record.",
);

assert(
  leadershipMigration.includes("get_leadership_learning_intelligence") &&
    leadershipHome.includes("get_leadership_learning_intelligence") &&
    leadershipHome.includes("Learning Health"),
  "Leadership KSI must remain connected to governed school learning intelligence.",
);

for (const required of [
  "teaching_assignments",
  "lesson_deliveries",
  "student_lesson_work",
  "submit_my_lesson_work",
  "get_my_learning_resources",
]) {
  assert(syncMigration.includes(required), `KSI synchronization backbone is missing: ${required}`);
}
assert(
  studentLearning.includes("get_my_learning_resources") &&
    studentLearning.includes("submit_my_lesson_work"),
  "Student learning resources must remain connected to lesson delivery and learner work.",
);

assert(
  masteryMigration.includes("get_my_mastery_graph") &&
    studentMastery.includes("get_my_mastery_graph") &&
    studentMastery.includes("Next Best Learning Action"),
  "KSI mastery and next-learning guidance must remain wired together.",
);

for (const required of ["curriculum_frameworks", "curriculum_nodes", "objective_curriculum_links"]) {
  assert(curriculumMigration.includes(required), `Curriculum intelligence foundation is missing: ${required}`);
}

assert(
  schoolAccessClient.includes("set_school_access_status") &&
    schoolAccessClient.includes("SCHOOL_ACCESS_STATUSES"),
  "The platform school-access console must remain backed by the governed access RPC.",
);

for (const route of [
  'href="/hqls/deliver"',
  'href="/hqls/review"',
  'href="/leadership"',
  'href="/setup/curriculum"',
  'href="/admin/schools"',
  'href="/setup/student-access"',
]) {
  assert(dashboard.includes(route), `KSI 2.0 dashboard route is missing: ${route}`);
}

const clientSurface = [schoolAccessClient, studentHome, studentLearning, studentMastery, leadershipHome].join("\n");
assert(
  !clientSurface.includes("SUPABASE_SERVICE_ROLE_KEY") && !clientSurface.includes("service_role"),
  "KSI 2.0 client surfaces must never contain the Supabase service-role credential.",
);

assert(packageJson.includes("verify-ksi2.mjs"), "Permanent KSI 2.0 structural verification must remain enabled.");

console.log(
  "KSI 2.0 structure verification passed: access control, shared roles, Student KSI, Leadership KSI, synchronization, mastery/next-learning, curriculum foundations and Student Access redemption remain connected to one governed data model.",
);
