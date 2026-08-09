import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [openai, authForm, authCallback, assessmentPage, globals] = await Promise.all([
  text("lib/ai/openai.ts"),
  text("components/auth/auth-form.tsx"),
  text("app/auth/callback/page.tsx"),
  text("app/assessment/page.tsx"),
  text("app/globals.css"),
]);

assert(
  openai.includes('return input.schemaName?.includes("repair") ? "medium" : "low";') &&
    openai.includes("reasoning: { effort: reasoningEffort }") &&
    openai.includes("AbortSignal.timeout(timeoutMs)") &&
    openai.includes("KSI_AI_TIMING"),
  "V1 stability must keep low-reasoning first-pass AI generation, stronger repair reasoning, bounded provider waits and timing telemetry.",
);

assert(
  authForm.includes('redirectTo: `${window.location.origin}/auth/callback`') &&
    authForm.includes('`${window.location.origin}/auth/callback`'),
  "External authentication must return through the explicit KSI auth-completion route.",
);

for (const required of [
  "onAuthStateChange",
  "getSession()",
  'router.replace("/dashboard")',
  "Completing secure sign-in",
]) {
  assert(
    authCallback.includes(required),
    `Auth callback completion guard is missing: ${required}`,
  );
}

assert(
  assessmentPage.includes("ksi-assessment-shell") &&
    assessmentPage.includes("overflow-x-hidden"),
  "Assessment must retain an explicit mobile viewport boundary.",
);

for (const required of [
  ".ksi-assessment-shell select",
  "min-width: 0",
  "max-width: 100%",
  "overflow-wrap: anywhere",
]) {
  assert(
    globals.includes(required),
    `Assessment mobile shrink protection is missing: ${required}`,
  );
}

console.log(
  "V1 stability verification passed: AI latency controls, auth callback completion and Assessment mobile containment are present.",
);
