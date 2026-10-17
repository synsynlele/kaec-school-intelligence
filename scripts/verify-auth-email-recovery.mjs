import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const auth = await readFile("components/auth/auth-form.tsx", "utf8");
const runbook = await readFile("docs/KSI_AUTH_EMAIL_DELIVERY.md", "utf8");

for (const expected of [
  'getBrowserSupabaseClient().auth.resend({',
  'type: "signup"',
  'emailRedirectTo: redirectUrl',
  "setPendingConfirmation({ email: email.trim(), role });",
  'resendConfirmation()',
  "setResendingConfirmation(false)",
  'Resend confirmation email',
  "that does not establish a new account or email delivery",
  "I already have an account — Sign in",
  'email address not authorized',
  'rate limit',
  'kaecng@gmail.com',
]) {
  assert(auth.includes(expected), "KSI auth recovery is missing: " + expected);
}

assert(
  !auth.includes("Account created. Check your email to confirm it."),
  "Signup must not claim account creation or confirmed email delivery from an unverified Supabase response.",
);
assert(
  auth.includes('if (data.session)') && auth.includes('window.location.replace(destination)'),
  "Existing verified-session sign-up flow must keep working.",
);
assert(
  auth.includes("Choose School Owner or Teacher / Staff first.") &&
  !auth.includes("provision_school_workspace") &&
  !auth.includes("redeem_staff_access_code"),
  "Email recovery must not grant school permissions or bypass sign-in.",
);
for (const expected of ["custom SMTP", "Auth Logs", "auth.users", "KSI's production", "Google Play reviewer"]) {
  assert(runbook.includes(expected), "Delivery runbook is missing: " + expected);
}

console.log("KSI signup email recovery checks passed.");
