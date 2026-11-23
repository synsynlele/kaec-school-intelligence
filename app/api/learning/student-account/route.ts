import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import { learnerLoginDomain } from "@/lib/learning/learner-login";

export const runtime = "nodejs";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const headers = { "Cache-Control": "private, no-store" };

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return failure("Sign in as a school administrator.", 401);

  const input = await request.json().catch(() => null);
  if (typeof input?.studentId !== "string" || !uuid.test(input.studentId)) {
    return failure("Select an active learner.", 400);
  }

  const key = process.env.KSI_SUPABASE_ADMIN_KEY?.trim();
  if (!key) return failure("School-issued accounts are unavailable on this deployment.", 503);

  const { url, publishableKey } = getSupabasePublicEnv();
  const staff = createClient(url, publishableKey, { auth, global: { headers: { Authorization: authorization } } });
  const admin = createClient(url, key, { auth });
  const learner = createClient(url, publishableKey, { auth });

  // The existing invitation RPC checks school scope, active status and administrator permissions.
  const invite = await staff.rpc("issue_student_access_code", { target_student_id: input.studentId, ttl_hours: 1 });
  const code = invite.data?.[0]?.access_code;
  if (invite.error || typeof code !== "string") {
    return failure("Could not issue a login. Check school access and whether the learner is already linked.", 403);
  }

  const username = `ksi-${randomBytes(9).toString("hex")}`;
  const email = `${username}@${learnerLoginDomain}`;
  const password = `${randomBytes(18).toString("base64url")}aA9!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
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

  return Response.json({ username, password }, { headers });
}
