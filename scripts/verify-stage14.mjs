import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [migration, simplification, dashboard, studentJoin, schoolAdmin] = await Promise.all([
  text("supabase/migrations/064_stage14_school_provisioning_access_lock.sql"),
  text("docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md"),
  text("components/dashboard/dashboard-client.tsx"),
  text("components/student/student-join-client.tsx"),
  text("components/admin/school-access-client.tsx"),
]);

for (const required of [
  "drop policy if exists workspaces_insert_school_self",
  "workspaces_insert_platform_admin_only",
  "private.is_platform_access_admin()",
  "provision_school_workspace",
  "'paused'",
  "Awaiting explicit platform activation",
]) {
  assert(migration.includes(required), `Stage 14 school access lock is missing: ${required}`);
}

assert(
  !dashboard.includes("Add school workspace") &&
    !dashboard.includes("Create school workspace") &&
    !dashboard.includes('.from("workspaces").insert'),
  "Dashboard must not let ordinary users self-create school workspaces.",
);

for (const required of [
  "KAEC platform administration",
  "Governance controls",
  'href="/admin/schools"',
  "Student-facing KSI has been retired",
]) {
  assert(dashboard.includes(required), `KSI 2.2 role-aware dashboard is missing: ${required}`);
}
assert(
  dashboard.includes("state.isPlatformAdmin") && dashboard.includes("School Access"),
  "Platform School Access Control must remain behind the platform-admin gate.",
);
assert(
  simplification.includes("Students are not an interactive KSI user surface") &&
    simplification.includes("Historical student accounts and data must not be destructively deleted"),
  "Stage 14 historical learner-access protections must be retained while Student KSI is retired.",
);

for (const required of [
  "This is a staff account, not a student account",
  "use the student&apos;s account",
  "messageFrom",
  "redeem_student_access_code",
]) {
  assert(studentJoin.includes(required), `Historical Student Access redemption safety is missing: ${required}`);
}

for (const required of [
  "Provision a subscribed school",
  "provision_school_workspace",
  "Paused state",
  "Activate it only when KAEC approves access",
]) {
  assert(schoolAdmin.includes(required), `Platform school provisioning console is missing: ${required}`);
}

assert(
  !dashboard.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !studentJoin.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !schoolAdmin.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Stage 14 browser surfaces must not expose a Supabase service-role credential.",
);

console.log(
  "Stage 14 verification passed under KSI 2.2: self-service school creation remains closed, platform-admin provisioning starts paused, historical Student Access protections remain intact, and the active dashboard is Teacher/Leadership role-aware.",
);