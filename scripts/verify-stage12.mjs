import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  constitution,
  migration,
  reviewPage,
  reviewClient,
  dashboardPage,
  reviewShortcut,
  databaseTypes,
  vercel,
  packageJson,
] = await Promise.all([
  text("docs/PRODUCT_CONSTITUTION.md"),
  text("supabase/migrations/026_stage12_review_console_hardening.sql"),
  text("app/curriculum/review/page.tsx"),
  text("components/curriculum/scheme-review-client.tsx"),
  text("app/dashboard/page.tsx"),
  text("components/dashboard/curriculum-review-shortcut.tsx"),
  text("lib/supabase/database.ts"),
  text("vercel.json"),
  text("package.json"),
]);

assert(
  constitution.includes("Preserve source provenance when uploaded curriculum/resources materially guide an output") &&
    constitution.includes("Human responsibility remains intact; AI supports judgement rather than replacing it."),
  "Stage 12 review must remain anchored to source provenance and human responsibility.",
);

for (const required of [
  "private.is_platform_access_admin()",
  "Promoted scheme entries are immutable.",
  "review_scheme_entries_bulk",
  "promote_scheme_entries_bulk",
  "refresh_scheme_review_state",
  "'strand'",
  "Only approved scheme entries can be promoted.",
  "review_status = 'pending'",
]) {
  assert(migration.includes(required), `Stage 12 database guard is missing: ${required}`);
}

const reviewStart = reviewClient.indexOf("async function reviewEntries(");
const editStart = reviewClient.indexOf("function startEdit(");
assert(reviewStart >= 0 && editStart > reviewStart, "Review action boundary could not be inspected.");
const reviewActionBody = reviewClient.slice(reviewStart, editStart);
assert(
  reviewActionBody.includes("review_scheme_entry") &&
    reviewActionBody.includes("review_scheme_entries_bulk") &&
    !reviewActionBody.includes("promote_scheme_entry") &&
    !reviewActionBody.includes("promote_scheme_entries_bulk"),
  "Approval/rejection must not invoke promotion.",
);

for (const required of [
  "Zero automatic promotion",
  'promotionText !== "PROMOTE"',
  "Type <span className=\"font-bold text-zinc-950\">PROMOTE</span> to confirm",
  "Promoted rows are immutable",
  "Select this page",
  "Approve selected",
  "Reject selected",
  "Promote selected…",
  "get_scheme_review_page",
  "update_scheme_entry",
]) {
  assert(reviewClient.includes(required), `Stage 12 review UX guard is missing: ${required}`);
}

assert(
  reviewPage.includes("SchemeReviewClient") &&
    reviewPage.includes("Platform Curriculum Governance"),
  "The governed Stage 12 review route must remain exposed through its dedicated page.",
);
assert(
  dashboardPage.includes("CurriculumReviewShortcut") &&
    reviewShortcut.includes("get_scheme_review_access") &&
    reviewShortcut.includes('href="/curriculum/review"'),
  "Curriculum Review must remain hidden behind the platform-admin access check.",
);

for (const required of [
  "get_scheme_review_access",
  "get_scheme_review_console",
  "get_scheme_review_page",
  "update_scheme_entry",
  "review_scheme_entries_bulk",
  "promote_scheme_entries_bulk",
]) {
  assert(databaseTypes.includes(required), `Stage 12 typed RPC contract is missing: ${required}`);
}

assert(
  vercel.includes('"*": false') &&
    vercel.includes('"main": true') &&
    vercel.includes('"*-preview": true'),
  "Stage 12 must preserve quota-safe Vercel branch deployment gating.",
);
assert(
  packageJson.includes("verify-stage12.mjs"),
  "Permanent Stage 12 structural verification must remain enabled.",
);

console.log(
  "Stage 12 structure verification passed: review is platform-admin-only, approval and promotion remain separate, promoted rows are immutable, composite strands are preserved, page-level bulk review is guarded, and Vercel quota gating remains intact.",
);
