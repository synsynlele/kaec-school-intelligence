import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database";

import { parentLoginDomain, resolveParentLogin, schoolLoginEmail, schoolLoginUsername } from "@/lib/learning/school-login";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const usernamePattern = /^[a-z0-9][a-z0-9.-]{1,23}$/;
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const noStore = { "Cache-Control": "private, no-store" };

function failure(error: string, status = 400) {
  return Response.json({ error }, { status, headers: noStore });
}

export async function POST(request: Request) {
  const key = process.env.KSI_SUPABASE_ADMIN_KEY?.trim();
  if (!key) return failure("School-issued accounts are unavailable on this deployment.", 503);

  const input = await request.json().catch(() => null);
  const { url, publishableKey } = getSupabasePublicEnv();
  const admin = createClient<Database>(url, key, { auth: authOptions });

  if (input?.action === "activate") {
    const { username, temporaryPassword, newPassword } = input;
    if (typeof username !== "string" || username.length > 100 || !resolveParentLogin(username).endsWith(`@${parentLoginDomain}`)
      || typeof temporaryPassword !== "string" || temporaryPassword.length > 72
      || typeof newPassword !== "string" || newPassword === temporaryPassword
      || newPassword.length < 12 || Buffer.byteLength(newPassword, "utf8") > 72) {
      return failure("Use your school-issued credentials and a different password of 12–72 bytes.");
    }
    const parent = createClient<Database>(url, publishableKey, { auth: authOptions });
    const signedIn = await parent.auth.signInWithPassword({ email: resolveParentLogin(username), password: temporaryPassword });
    if (signedIn.error || !signedIn.data.user) return failure("School-issued credentials were not accepted.", 401);

    const status = await parent.rpc("get_my_learning_parent_status");
    if (status.error || status.data !== "temporary") return failure("This temporary login is unavailable.", 403);
    const changed = await parent.auth.updateUser({ password: newPassword });
    if (changed.error) return failure(changed.error.message);
    const activated = await admin.rpc("activate_learning_parent", { account_id: signedIn.data.user.id });
    if (activated.error || !activated.data) {
      return failure("Activation could not finish. Ask the school to revoke and reissue the account.", 409);
    }
    await parent.auth.signOut();
    return Response.json({ activated: true }, { headers: noStore });
  }

  if (input?.action !== "issue" && input?.action !== "reset") return failure("Choose an account action.");
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return failure("Sign in as an administrator.", 401);
  const { schoolId, parentName, learnerIds, handle, accountId } = input;
  if (typeof schoolId !== "string" || !uuid.test(schoolId)) {
    return failure("Select a school.");
  }
  const staff = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: authorization } }, auth: authOptions,
  });
  const permission = await staff.rpc("get_learning_family_setup", { school_id: schoolId });
  if (permission.error) return failure("School administrator access is required.", 403);
  const setup = permission.data as {
    learners?: { id: string }[];
    parents?: { id: string; status: string; username: string }[];
  } | null;
  const temporaryPassword = `${randomBytes(18).toString("base64url")}aA9!`;

  if (input.action === "reset") {
    if (typeof accountId !== "string" || !uuid.test(accountId)) return failure("Select a parent account.");
    const account = setup?.parents?.find((parent) => parent.id === accountId && parent.status !== "Revoked");
    if (!account) return failure("Parent account unavailable.", 404);
    const identity = await admin.auth.admin.getUserById(accountId);
    if (identity.error || identity.data.user?.email !== account.username ||
      identity.data.user.app_metadata.ksi_parent_school !== schoolId) {
      return failure("Could not verify this school-issued parent login.", 409);
    }
    const changed = await admin.auth.admin.updateUserById(accountId, { password: temporaryPassword });
    if (changed.error) return failure("Could not reset the parent password. Try again.", 409);
    const reset = await admin.rpc("restart_learning_parent_activation", { school_id: schoolId, account_id: accountId });
    if (reset.error || !reset.data) return failure("Could not finish the reset. Try again or contact KSI support.", 409);
    return Response.json({
      username: schoolLoginUsername(account.username, parentLoginDomain), temporaryPassword,
    }, { headers: noStore });
  }

  if (typeof parentName !== "string" || !parentName.trim() || parentName.trim().length > 120
    || typeof handle !== "string" || (!usernamePattern.test(handle) && !schoolLoginEmail(handle, parentLoginDomain))
    || !Array.isArray(learnerIds) || learnerIds.length < 1 || learnerIds.length > 30
    || !learnerIds.every((id) => typeof id === "string" && uuid.test(id))) {
    return failure("Enter a name, username and at least one verified learner.");
  }
  const allowed = new Set(setup?.learners?.map(({ id }) => id));
  if (!learnerIds.every((id: string) => allowed.has(id))) return failure("Choose learners registered in this school.");

  const customEmail = schoolLoginEmail(handle, parentLoginDomain);
  const email = customEmail ?? `${schoolId.replaceAll("-", "").slice(0, 12)}.${handle}@${parentLoginDomain}`;
  const username = customEmail ? handle.trim().toLowerCase() : email;
  const created = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { ksi_parent_school: schoolId },
  });
  if (created.error && [401, 403].includes(created.error.status ?? 0)) {
    return failure("School login setup is unavailable. KSI could not authenticate with its account service.", 503);
  }
  if (created.error || !created.data.user) {
    if (created.error?.code === "email_exists" || created.error?.code === "user_already_exists") {
      return failure("That parent username is already taken. Choose a different username.", 409);
    }
    return failure("Could not issue this parent login. Try again or contact KSI support.", 502);
  }

  const registered = await staff.rpc("register_learning_parent", {
    school_id: schoolId, parent_id: created.data.user.id, parent_name: parentName, learner_ids: learnerIds,
  });
  if (registered.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return failure("Could not complete this account. Please retry.", 409);
  }

  return Response.json({ username, temporaryPassword }, { headers: noStore });
}
