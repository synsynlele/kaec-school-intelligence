import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  amendment,
  simplification,
  accessMigration,
  studentMigration,
  leadershipMigration,
  syncMigration,
  masteryMigration,
  curriculumMigration,
  accessRedeemFix,
  masteryEvidenceFix,
  schoolAccessClient,
  studentHome,
  studentLearning,
  studentMastery,
  studentPage,
  leadershipHome,
  dashboardPage,
  dashboardClient,
  packageJson,
] = await Promise.all([
  text("docs/KSI_2_CONSTITUTIONAL_AMENDMENT.md"),
  text("docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md"),
  text("supabase/migrations/026_stage7_ksi2_access_identity_foundation.sql"),
  text("supabase/migrations/033_stage8_student_learning_intelligence_rpc.sql"),
  text("supabase/migrations/032_stage9_leadership_learning_intelligence_rpc.sql"),
  text("supabase/migrations/039_stage10_learning_link_backbone.sql"),
  text("supabase/migrations/047_stage11_mastery_graph_next_learning.sql"),
  text("supabase/migrations/050_stage12_curriculum_intelligence_foundation.sql"),
  text("supabase/migrations/057_stage8_student_access_redeem_conflict_fix.sql"),
  text("supabase/migrations/058_stage11_mastery_distinct_evidence_fix.sql"),
  text("components/admin/school-access-client.tsx"),
  text("components/student/student-home-client.tsx"),
  text("components/student/student-learning-library.tsx"),
  text("components/student/student-mastery-client.tsx"),
  text("app/student/page.tsx"),
  text("components/leadership/leadership-home-client.tsx"),
  text("app/dashboard/page.tsx"),
  text("components/dashboard/dashboard-client.tsx"),
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
  assert(amendment.includes(required), `KSI 2.0 historical constitutional foundation is missing: ${required}`);
}

for (const required of [
  "Teacher KSI",
  "Leadership KSI",
  "Students are not an interactive KSI user surface",
  "Historical student accounts and data must not be destructively deleted",
  "Academic Resource / Scheme → HQLS Lesson",
]) {
  assert(simplification.includes(required), `KSI 2.2 simplification amendment is missing: ${required}`);
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
  assert(accessMigration.includes(required), `KSI 2.0 access/data foundation is missing: ${required}`);
}

const ambiguousWorkspaceMemberConflict = /on\s+conflict\s*\(\s*workspace_id\s*,\s*user_id\s*\)\s*do\s+update/i;
assert(
  accessRedeemFix.includes("create or replace function public.redeem_student_access_code") &&
    accessRedeemFix.includes("on conflict on constraint workspace_members_pkey") &&
    !ambiguousWorkspaceMemberConflict.test(accessRedeemFix),
  "Historical Student Access redemption must remain safe because student account records are preserved.",
);

assert(
  masteryEvidenceFix.includes("create or replace function private.refresh_student_mastery") &&
    masteryEvidenceFix.match(/count\(distinct se\.id\)/g)?.length >= 4 &&
    !masteryEvidenceFix.includes("count(se.id) filter"),
  "Mastery confidence must continue to count distinct learner evidence records.",
);

assert(
  studentMigration.includes("get_my_learning_intelligence") &&
    studentHome.includes("get_my_learning_intelligence"),
  "The preserved learner-data foundation must remain internally coherent even though Student KSI is no longer an active product surface.",
);
assert(
  studentPage.includes('redirect("/sign-in?notice=student-surface-retired")'),
  "Student KSI home must be retired at the route boundary under KSI 2.2.",
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
  studentLearning.includes("get_my_learning_resources") && studentLearning.includes("submit_my_lesson_work"),
  "Preserved historical learner-work components must remain compatible with the shared evidence model.",
);

assert(
  masteryMigration.includes("get_my_mastery_graph") && studentMastery.includes("get_my_mastery_graph"),
  "Mastery data must remain wired to the shared learning record for teacher and leadership intelligence.",
);

for (const required of ["curriculum_frameworks", "curriculum_nodes", "objective_curriculum_links"]) {
  assert(curriculumMigration.includes(required), `Curriculum intelligence foundation is missing: ${required}`);
}

assert(
  schoolAccessClient.includes("set_school_access_status") && schoolAccessClient.includes("SCHOOL_ACCESS_STATUSES"),
  "The platform school-access console must remain backed by the governed access RPC.",
);

const dashboardSurface = `${dashboardPage}\n${dashboardClient}`;
for (const route of [
  "/teacher/resources",
  "/hqls",
  "/assessment",
  "/diagnosis",
  "/interventions",
  "/leadership",
  "/setup/curriculum",
  "/setup/staff-access",
]) {
  assert(dashboardSurface.includes(route), `KSI 2.2 active dashboard route is missing: ${route}`);
}
assert(!dashboardSurface.includes('href="/setup/student-access"'), "Student Access must not remain in the active KSI dashboard navigation.");
assert(
  dashboardClient.includes("state.isPlatformAdmin") && dashboardClient.includes('href="/admin/schools"'),
  "Platform-admin controls must remain explicitly gated from ordinary users.",
);
assert(
  dashboardClient.includes("Student-facing KSI has been retired"),
  "Historical student memberships must fail closed into a retirement message rather than gaining Teacher/Leadership navigation.",
);

const clientSurface = [schoolAccessClient, studentHome, studentLearning, studentMastery, leadershipHome, dashboardClient].join("\n");
assert(
  !clientSurface.includes("SUPABASE_SERVICE_ROLE_KEY") && !clientSurface.includes("service_role"),
  "KSI client surfaces must never contain the Supabase service-role credential.",
);

assert(packageJson.includes("verify-ksi2.mjs"), "Permanent KSI 2 structural verification must remain enabled.");

console.log(
  "KSI 2 foundation verification passed under KSI 2.2: governed learner data remains intact, Student KSI routes are retired, and Teacher/Leadership navigation is connected to the same synchronized learning model.",
);
