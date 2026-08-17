import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [migration, dashboard, studentJoin, schoolAdmin] = await Promise.all([
  text("supabase/migrations/064_stage14_school_provisioning_access_lock.sql"),
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
  "Signing up does not create or activate a school",
  "platform administrator provisions it",
  "School Access Control",
  "Curriculum Resource Factory",
]) {
  assert(dashboard.includes(required), `Role-aware dashboard is missing: ${required}`);
}

for (const required of [
  "This is a staff account, not a student account",
  "use the student&apos;s account",
  "messageFrom",
  "redeem_student_access_code",
]) {
  assert(studentJoin.includes(required), `Student Access redemption UX is missing: ${required}`);
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
  "Stage 14 verification passed: self-service school creation is closed, platform-admin provisioning starts paused, Student Access explains staff-account rejection, and the dashboard is role/access-state aware.",
);
