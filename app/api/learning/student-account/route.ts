import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import { learnerLoginDomain, resolveLearnerLogin } from "@/lib/learning/learner-login";

export const runtime = "nodejs";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const headers = { "Cache-Control": "private, no-store" };

function createPassword() {
  return `${randomBytes(18).toString("base64url")}aA9!`;
}

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const key = process.env.KSI_SUPABASE_ADMIN_KEY?.trim();
  if (!key) return failure("School-issued accounts are unavailable on this deployment.", 503);

  const { url, publishableKey } = getSupabasePublicEnv();
  const admin = createClient(url, key, { auth });
  const learner = createClient(url, publishableKey, { auth });

  if (input?.action === "activate") {
    const { username, temporaryPassword, newPassword } = input;
    if (typeof username !== "string" || username.length > 80 || typeof temporaryPassword !== "string"
      || Buffer.byteLength(temporaryPassword) > 72 || typeof newPassword !== "string"
      || newPassword === temporaryPassword || newPassword.length < 12 || Buffer.byteLength(newPassword) > 72) {
      return failure("Choose a different password with at least 12 characters and at most 72 bytes.", 400);
    }
    const email = resolveLearnerLogin(username);
    if (!email.endsWith(`@${learnerLoginDomain}`)) return failure("Enter your school username.", 400);
    const { data, error } = await learner.auth.signInWithPassword({ email, password: temporaryPassword });
    const studentId = data.user?.app_metadata.ksi_school_learner;
    if (error || !data.user || typeof studentId !== "string" || !uuid.test(studentId)) {
      return failure("The school credentials were not accepted.", 401);
    }
    try {
      const { data: account } = await learner.from("student_accounts")
        .select("password_change_pending").eq("user_id", data.user.id).eq("student_id", studentId).maybeSingle();
      if (!account?.password_change_pending) return failure("This login does not need activation.", 409);
      const updated = await learner.auth.updateUser({ password: newPassword });
      if (updated.error) return failure("Could not change your password. Check that it meets the password requirements.", 400);
      const enabled = await admin.rpc("set_learner_password_pending", {
        target_user: data.user.id, target_student: studentId, pending: false,
      });
      if (enabled.error || !enabled.data) return failure("Could not finish activation. Ask your school to reset the login.", 409);
      return Response.json({ activated: true }, { headers });
    } finally {
      await learner.auth.signOut();
    }
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return failure("Sign in as a school administrator.", 401);
  if (typeof input?.studentId !== "string" || !uuid.test(input.studentId)) {
    return failure("Select an active learner.", 400);
  }
  const staff = createClient(url, publishableKey, { auth, global: { headers: { Authorization: authorization } } });

  if (input.action === "reset") {
    const { data: account, error } = await staff.from("student_accounts")
      .select("user_id,workspace_id").eq("student_id", input.studentId).or("active.eq.true,password_change_pending.eq.true").maybeSingle();
    const { data: { user } } = await staff.auth.getUser(authorization.slice(7));
    if (!account || error || !user) return failure("Learner account unavailable.", 403);

    const [{ data: membership }, { data: student }, { data: school }] = await Promise.all([
      staff.from("workspace_members").select("role").eq("workspace_id", account.workspace_id)
        .eq("user_id", user.id).eq("status", "active").maybeSingle(),
      staff.from("students").select("id").eq("workspace_id", account.workspace_id)
        .eq("id", input.studentId).eq("active", true).maybeSingle(),
      staff.from("workspaces").select("id").eq("id", account.workspace_id)
        .eq("workspace_type", "school").eq("access_status", "active").maybeSingle(),
    ]);
    if (!membership || !["owner", "admin"].includes(membership.role) || !student || !school) {
      return failure("Only the learner's school owner or admin can reset this login.", 403);
    }

    const { data: identity } = await admin.auth.admin.getUserById(account.user_id);
    const email = identity?.user?.email ?? "";
    const suffix = `@${learnerLoginDomain}`;
    if (!email.endsWith(suffix) || identity.user?.app_metadata.ksi_school_learner !== input.studentId) {
      return failure("This learner uses an existing email or Google account.", 409);
    }

    const pending = await admin.rpc("set_learner_password_pending", {
      target_user: account.user_id, target_student: input.studentId, pending: true,
    });
    if (pending.error || !pending.data) return failure("Could not prepare the learner login for reset.", 409);
    const password = createPassword();
    const updated = await admin.auth.admin.updateUserById(account.user_id, { password });
    if (updated.error) return failure("Could not reset the learner password.", 409);
    return Response.json({ username: email.slice(0, -suffix.length), password }, { headers });
  }

  if (input.action !== "issue") return failure("Choose a learner account action.", 400);

  // The existing invitation RPC checks school scope, active status and administrator permissions.
  const invite = await staff.rpc("issue_student_access_code", { target_student_id: input.studentId, ttl_hours: 1 });
  const code = invite.data?.[0]?.access_code;
  if (invite.error || typeof code !== "string") {
    return failure("Could not issue a login. Check school access and whether the learner is already linked.", 403);
  }

  const username = `ksi-${randomBytes(9).toString("hex")}`;
  const email = `${username}@${learnerLoginDomain}`;
  const password = createPassword();
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { ksi_school_learner: input.studentId },
  });
  if (created.error || !created.data.user) return failure("Could not create the learner login. Try again.", 409);

  const signedIn = await learner.auth.signInWithPassword({ email, password });
  const linked = signedIn.error
    ? null
    : await learner.rpc("redeem_student_access_code", { raw_code: code });
  await learner.auth.signOut();

  if (!linked || linked.error || linked.data?.[0]?.student_id !== input.studentId) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return failure("Could not link the learner login. Try again.", 409);
  }

  const pending = await admin.rpc("set_learner_password_pending", {
    target_user: created.data.user.id, target_student: input.studentId, pending: true,
  });
  if (pending.error || !pending.data) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return failure("Could not prepare the temporary login. Try again.", 409);
  }
  return Response.json({ username, password }, { headers });
}
