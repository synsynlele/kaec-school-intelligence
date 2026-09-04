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
  staffProfileInvariant,
  simplification,
  authForm,
  authCallback,
  authResolver,
  runtimeAccess,
  schoolShell,
  dashboard,
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
  text("supabase/migrations/070_staff_profile_redemption_invariant.sql"),
  text("docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md"),
  text("components/auth/auth-form.tsx"),
  text("app/auth/callback/page.tsx"),
  text("components/auth/auth-resolver-client.tsx"),
  text("lib/supabase/runtime-access.ts"),
  text("components/navigation/ksi-school-shell.tsx"),
  text("components/dashboard/school-dashboard-client.tsx"),
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
  "insert into public.profiles as p",
  "on conflict (id) do update",
  "default_workspace_id = excluded.default_workspace_id",
  "The access code was not consumed.",
  "p.default_workspace_id is null",
]) {
  assert(
    staffProfileInvariant.includes(required),
    `Staff profile redemption invariant is missing: ${required}`,
  );
}
assert(
  staffProfileInvariant.indexOf("insert into public.profiles as p") <
    staffProfileInvariant.lastIndexOf("update public.staff_access_invites"),
  "Staff Access Codes must be consumed only after the account profile invariant is established.",
);

for (const required of [
  "Teacher & Leadership Simplification",
  "Students are not an interactive KSI user surface",
  "Historical student accounts and data must not be destructively deleted",
]) {
  assert(simplification.includes(required), `KSI 2.2 simplification authority is missing: ${required}`);
}

for (const required of [
  'type EntryRole = "owner" | "teacher"',
  "School Owner",
  "Teacher / Staff",
  'destination: "/auth/resolve?entry=owner"',
  'destination: "/auth/resolve?entry=teacher"',
  'const AUTH_ENTRY_KEY = "ksi:auth:entryRole"',
  "Choosing an entry path never grants authority",
]) {
  assert(authForm.includes(required), `Unified role-aware authentication UX is missing: ${required}`);
}
assert(!authForm.includes('destination: "/student/join"'), "Student KSI must not remain an active sign-in destination after KSI 2.2.");
assert(!authForm.includes('type EntryRole = "owner" | "teacher" | "student"'), "Student must not remain an active entry role after KSI 2.2.");
assert(
  !authForm.includes('.from("workspace_members")') &&
    !authForm.includes("provision_school_workspace") &&
    !authForm.includes("redeem_staff_access_code") &&
    !authForm.includes("redeem_student_access_code"),
  "Public role selection must remain routing intent and must not grant school authority.",
);

assert(
  authCallback.includes('search.get("next")') &&
    authCallback.includes("safeInternalPath") &&
    authCallback.includes('path.startsWith("/student/")') &&
    authCallback.includes("Opening the right KSI access path"),
  "Auth callback must preserve safe resolver destinations and neutralise retired Student KSI destinations.",
);

for (const required of [
  "resolveKsiRuntimeAccess",
  'window.location.replace("/dashboard")',
  'window.location.replace("/teacher/join")',
  'window.location.replace("/owner/access")',
  "if (access.activeSchool)",
  "Your account is still signed in.",
]) {
  assert(authResolver.includes(required), `Canonical post-auth resolver is missing: ${required}`);
}

for (const required of [
  "get_my_school_memberships",
  "chooseActiveSchool",
  "default_workspace_id",
  "activeSchool",
  "inactiveSchool",
  "invalidateKsiRuntimeAccess",
  "announceKsiWorkspaceChange",
]) {
  assert(runtimeAccess.includes(required), `Canonical runtime access resolver is missing: ${required}`);
}
assert(
  runtimeAccess.includes("auth.getUser()") && runtimeAccess.includes('.from("profiles")'),
  "Runtime access must authenticate the user and resolve the user's own profile before governing school access.",
);

for (const required of [
  'type GateState = "checking" | "ready" | "needs-school" | "error"',
  "resolveKsiRuntimeAccess",
  "Access check interrupted",
  "Your school membership has not been removed.",
  "Retry access check",
]) {
  assert(schoolShell.includes(required), `Protected school gate hardening is missing: ${required}`);
}
assert(
  !schoolShell.includes('catch(() => {\n      if (!cancelled) setState("needs-school")'),
  "A protected-route technical error must never be converted into missing school membership.",
);

for (const required of [
  "resolveKsiRuntimeAccess",
  'router.replace("/auth/resolve")',
  "Dashboard check interrupted",
  "will not interpret a dashboard-loading error as missing school membership",
]) {
  assert(dashboard.includes(required), `Dashboard access hardening is missing: ${required}`);
}
assert(
  !dashboard.includes('Link href="/teacher/join"') && !dashboard.includes("Join a school"),
  "Dashboard technical failures must not send an existing user into staff-code onboarding.",
);

for (const required of [
  "KSI for teaching & school leadership",
  "School Owner",
  "Teacher / Staff",
  "Staff Access Code",
]) {
  assert(signInPage.includes(required), `Simplified sign-in page explanation is missing: ${required}`);
}
assert(!signInPage.includes("Student Access Code"), "Student Access must not remain on the active sign-in surface.");

for (const required of [
  "request_school_access",
  "get_my_school_access_requests",
  "resolveKsiRuntimeAccess",
  'type LoadState = "checking" | "ready" | "error"',
  "School access is approved, not self-created",
  "Awaiting KAEC review",
  "KSI will not create another school request from an uncertain state",
]) {
  assert(ownerAccess.includes(required), `Owner onboarding flow is missing: ${required}`);
}

for (const required of [
  "redeem_staff_access_code",
  "resolveKsiRuntimeAccess",
  "verifyRedeemedMembership",
  "setRedeemed(linked)",
  "Access code already accepted",
  "Do not enter another access code",
  "Retry access check",
  'window.location.replace("/dashboard")',
  "Another access code cannot bypass that governance state",
]) {
  assert(teacherJoin.includes(required), `Teacher access-loop regression protection is missing: ${required}`);
}
assert(
  teacherJoin.includes('membershipState === "error"') &&
    teacherJoin.includes("redeemed ? verifyRedeemedMembership(redeemed) : loadAccess()"),
  "A redeemed one-time Staff Access Code must remain terminal while membership confirmation is retried.",
);

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
  studentAccessPage.includes('redirect("/setup")'),
  "Retired Student Access setup must return owners to the active school setup experience.",
);

const browserSurface = [
  authForm,
  authResolver,
  runtimeAccess,
  schoolShell,
  dashboard,
  ownerAccess,
  teacherJoin,
  staffAccess,
  adminRequests,
].join("\n");
assert(
  !browserSurface.includes("SUPABASE_SERVICE_ROLE_KEY") && !browserSurface.includes("service_role"),
  "Browser access surfaces must not expose a Supabase service-role credential.",
);

console.log(
  "Stage 15 compatibility verification passed under KSI 2.2: every authenticated entry resolves governed membership first, staff-code redemption is terminal, owner onboarding is error-safe, technical failures never masquerade as missing school access, Student KSI entry is retired, and no role selection can grant school authority.",
);
