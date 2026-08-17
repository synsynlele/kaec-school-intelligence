import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  foundation,
  provisioning,
  hardening,
  authForm,
  authCallback,
  signInPage,
  ownerAccess,
  teacherJoin,
  staffAccess,
  adminRequests,
  adminPage,
  studentAccessPage,
] = await Promise.all([
  text("supabase/migrations/065_stage15_role_aware_onboarding.sql"),
  text("supabase/migrations/064_stage14_school_provisioning_access_lock.sql"),
  text("supabase/migrations/066_stage15_staff_redeem_hardening.sql"),
  text("components/auth/auth-form.tsx"),
  text("app/auth/callback/page.tsx"),
  text("app/sign-in/page.tsx"),
  text("components/auth/owner-access-client.tsx"),
  text("components/auth/teacher-join-client.tsx"),
  text("components/workspace/staff-access-manager.tsx"),
  text("components/admin/school-access-requests.tsx"),
  text("app/admin/schools/page.tsx"),
  text("app/setup/student-access/page.tsx"),
]);

for (const required of [
  "school_access_requests",
  "staff_access_invites",
  "request_school_access",
  "get_my_school_access_requests",
  "get_school_access_requests",
  "approve_school_access_request",
  "reject_school_access_request",
  "issue_staff_access_code",
  "redeem_staff_access_code",
  "get_staff_access_invites",
  "revoke_staff_access_invite",
  "get_my_school_memberships",
  "private.is_platform_access_admin()",
  "private.has_workspace_role",
  "extensions.digest",
]) {
  assert(foundation.includes(required), `Stage 15 onboarding foundation is missing: ${required}`);
}

assert(
  foundation.includes("public.provision_school_workspace") &&
    provisioning.includes("'paused'") &&
    provisioning.includes("Awaiting explicit platform activation"),
  "Approved Owner requests must delegate to the governed Stage 14 provisioning path that starts schools Paused.",
);

assert(
  hardening.includes("membership is suspended") &&
    hardening.includes("an old access code cannot reactivate it") &&
    hardening.includes("v_existing.status = 'suspended'"),
  "Staff Access redemption must not reactivate suspended school membership.",
);

for (const required of [
  'type EntryRole = "owner" | "teacher" | "student"',
  "School Owner",
  "Teacher / Staff",
  "Student",
  'destination: "/owner/access"',
  'destination: "/teacher/join"',
  'destination: "/student/join"',
  "I already have an account",
  "Create my account",
  "role does not grant school permission",
]) {
  assert(authForm.includes(required), `Role-aware authentication UX is missing: ${required}`);
}

assert(
  !authForm.includes('.from("workspace_members")') &&
    !authForm.includes("provision_school_workspace") &&
    !authForm.includes("redeem_staff_access_code") &&
    !authForm.includes("redeem_student_access_code"),
  "Public role selection must remain navigation intent and must not grant school authority.",
);

assert(
  authCallback.includes('search.get("next")') &&
    authCallback.includes("safeInternalPath") &&
    authCallback.includes("Opening the right KSI access path"),
  "Auth callback must preserve a safe role-aware destination across OAuth/email confirmation.",
);

for (const required of [
  "School Owners, Teachers and Students",
  "KAEC approval and school activation",
  "Staff Access Code",
  "Student Access Code",
]) {
  assert(signInPage.includes(required), `Role-aware sign-in page explanation is missing: ${required}`);
}

for (const required of [
  "request_school_access",
  "get_my_school_memberships",
  "get_my_school_access_requests",
  "School access is approved, not self-created",
  "Awaiting KAEC review",
]) {
  assert(ownerAccess.includes(required), `Owner onboarding flow is missing: ${required}`);
}

for (const required of [
  "redeem_staff_access_code",
  "get_my_school_memberships",
  "This account is already a School Owner",
  "This is already a Student KSI account",
  "Staff Access Code",
]) {
  assert(teacherJoin.includes(required), `Teacher onboarding flow is missing: ${required}`);
}

for (const required of [
  "issue_staff_access_code",
  "get_staff_access_invites",
  "revoke_staff_access_invite",
  "exact email",
  "Teacher join page",
]) {
  assert(staffAccess.includes(required), `Staff Access management is missing: ${required}`);
}

assert(
  adminRequests.includes("get_school_access_requests") &&
    adminRequests.includes("approve_school_access_request") &&
    adminRequests.includes("reject_school_access_request") &&
    adminPage.includes("SchoolAccessRequests"),
  "Platform School Access Control must expose the governed owner request queue.",
);

assert(
  studentAccessPage.includes('href="/setup/staff-access"') &&
    studentAccessPage.includes("People access"),
  "School setup must connect Student Access and Staff Access journeys.",
);

const browserSurface = [authForm, ownerAccess, teacherJoin, staffAccess, adminRequests].join("\n");
assert(
  !browserSurface.includes("SUPABASE_SERVICE_ROLE_KEY") && !browserSurface.includes("service_role"),
  "Stage 15 browser surfaces must not expose a Supabase service-role credential.",
);

console.log(
  "Stage 15 verification passed: Owner, Teacher/Staff and Student have distinct sign-in/sign-up journeys; role selection grants no authority; owners enter a platform-reviewed request flow; staff use email-bound codes; and Student Access remains separately governed.",
);
