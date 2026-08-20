import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  migration,
  shell,
  layout,
  nav,
  dashboardPage,
  dashboard,
  hqlsResultPage,
  workspaceCss,
  hqlsEngine,
  hqlsDownload,
  assessmentResult,
  diagnosisResult,
  interventionResultPage,
  interventionDownload,
  interventionPdfApi,
  audit,
] = await Promise.all([
  text("supabase/migrations/069_school_context_only_access.sql"),
  text("components/navigation/ksi-school-shell.tsx"),
  text("app/layout.tsx"),
  text("components/navigation/ksi-app-nav.tsx"),
  text("app/dashboard/page.tsx"),
  text("components/dashboard/school-dashboard-client.tsx"),
  text("app/hqls/result/page.tsx"),
  text("app/workspace-shell.css"),
  text("lib/hqls/engine.ts"),
  text("components/hqls/hqls-download-button.tsx"),
  text("components/assessment/assessment-result-client.tsx"),
  text("components/diagnosis/diagnosis-result-client.tsx"),
  text("app/interventions/result/page.tsx"),
  text("components/interventions/intervention-download-button.tsx"),
  text("app/api/interventions/pdf/route.ts"),
  text("docs/PRE_RELEASE_SECURITY_UX_AUDIT_2026-08-20.md"),
]);

for (const required of [
  "create or replace function private.handle_new_user()",
  "create or replace function private.has_active_workspace_membership",
  "create or replace function private.is_workspace_member",
  "create or replace function private.has_workspace_role",
  "w.workspace_type = 'school'",
  "where workspace_type = 'individual'",
  "access_status = 'disabled'",
  "A profile still defaults to an individual workspace.",
]) {
  assert(migration.includes(required), `Migration 069 is missing school-only access rule: ${required}`);
}
assert(
  !migration.includes("values(new.id,resolved_name,new.email);\n insert into public.workspaces") &&
    !migration.includes("values(new.id, resolved_name, new.email);\n  insert into public.workspaces"),
  "New-user bootstrap must not create a personal workspace.",
);
assert(!/delete\s+from\s+public\.workspaces/i.test(migration), "Legacy personal workspaces must be preserved, not deleted.");

for (const required of [
  "KsiSchoolShell",
  'workspace.workspace_type === "school"',
  'workspace.access_status === "active"',
  'default_workspace_id: preferred.id',
  "School access required",
  "Personal workspaces do not carry School Owner, Admin, Leader or Teacher authority",
]) {
  assert(shell.includes(required), `School context gate is missing: ${required}`);
}
assert(layout.includes("<KsiSchoolShell>{children}</KsiSchoolShell>"), "Protected KSI content must be mounted inside the school context gate.");

assert(dashboardPage.includes("SchoolDashboardClient"), "Dashboard must mount the school-only dashboard.");
for (const required of [
  '.eq("workspace_type", "school")',
  '.eq("access_status", "active")',
  'activeSchool.role === "owner" || activeSchool.role === "admin"',
  "Teacher workspace",
  "Leadership workspace",
  "Teaching workflow",
  "School learning intelligence",
  "Personal workspaces do not confer school administration rights",
]) {
  assert(dashboard.includes(required), `Structured school dashboard is missing: ${required}`);
}
assert(!dashboard.includes('workspace_type === "individual"'), "Dashboard must never activate individual workspace authority.");

for (const required of [
  "ksi-desktop-nav",
  "KSI desktop navigation",
  "KSI mobile navigation",
  "Teacher workspace",
  "Teaching workflow",
  "Leadership workspace",
  "Learning intelligence",
  "School administration",
  'workspace?.workspace_type === "school"',
]) {
  assert(nav.includes(required), `Responsive structured navigation is missing: ${required}`);
}
assert(workspaceCss.includes("body.ksi-school-nav-active"), "Desktop workspace shell must reserve space for the sidebar.");

assert(hqlsResultPage.includes("ksi-hqls-result-document"), "HQLS result must use the lesson-document layout.");
assert(workspaceCss.includes("article:nth-child(5)"), "Full Illumination must receive full-width document treatment.");
for (const required of [
  "normal conventional teaching",
  "direct-teaching exception",
  "detailed lesson note",
]) {
  assert(hqlsEngine.includes(required), `Full Illumination normal-lesson rule is missing: ${required}`);
}

assert(hqlsDownload.includes("Download Lesson PDF"), "HQLS result download action is missing.");
assert(assessmentResult.includes("Download PDF"), "Assessment result download action is missing.");
assert(diagnosisResult.includes("Download Parent PDF"), "Final Diagnosis download action is missing.");
assert(interventionResultPage.includes("InterventionDownloadButton"), "Intervention result must mount its download action.");
assert(interventionDownload.includes("Download Intervention PDF"), "Intervention PDF button is missing.");
assert(interventionPdfApi.includes('handoff.status !== "confirmed" && handoff.status !== "archived"'), "Draft interventions must not export as final plans.");

for (const required of [
  "Personal workspace / permission finding",
  "Application school-context gate",
  "Navigation and visual structure",
  "Download/export audit",
  "Active route audit",
  "Release gates",
]) {
  assert(audit.includes(required), `Pre-release audit documentation is missing: ${required}`);
}

console.log("KSI pre-release school-security and UX verification passed.");
