import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  amendment,
  migration,
  authForm,
  signIn,
  callback,
  dashboard,
  navigation,
  academicResources,
  academicPage,
  hqlsPage,
  prefill,
  repairApi,
  repairClient,
  schemePage,
  databaseTypes,
  studentHome,
  studentJoin,
  studentLearning,
  studentMastery,
  studentPlan,
  studentAsk,
  studentAskApi,
  studentAccess,
] = await Promise.all([
  text("docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md"),
  text("supabase/migrations/067_stage16_teacher_academic_resources.sql"),
  text("components/auth/auth-form.tsx"),
  text("app/sign-in/page.tsx"),
  text("app/auth/callback/page.tsx"),
  text("components/dashboard/dashboard-client.tsx"),
  text("components/navigation/ksi-app-nav.tsx"),
  text("components/resources/academic-resources-client.tsx"),
  text("app/teacher/resources/page.tsx"),
  text("app/hqls/page.tsx"),
  text("components/hqls/scheme-prefill-bridge.tsx"),
  text("app/api/curriculum/scheme-repair/route.ts"),
  text("components/curriculum/scheme-source-repair-client.tsx"),
  text("app/setup/curriculum/schemes/page.tsx"),
  text("lib/supabase/database.ts"),
  text("app/student/page.tsx"),
  text("app/student/join/page.tsx"),
  text("app/student/learning/page.tsx"),
  text("app/student/mastery/page.tsx"),
  text("app/student/plan/page.tsx"),
  text("app/student/ask/page.tsx"),
  text("app/api/student/ask/route.ts"),
  text("app/setup/student-access/page.tsx"),
]);

for (const required of [
  "Teacher & Leadership Simplification",
  "Students are not an interactive KSI user surface",
  "Academic Resource / Scheme → HQLS Lesson",
  "Academic Resources is a first-class Teacher capability",
  "no curriculum content may be auto-promoted",
]) {
  assert(amendment.includes(required), `Stage 16 constitutional authority is missing: ${required}`);
}

assert(
  authForm.includes('type EntryRole = "owner" | "teacher"'),
  "KSI entry must be limited to Owner and Teacher/Staff paths.",
);
assert(
  !authForm.includes('destination: "/student/join"'),
  "Student KSI must not remain an onboarding destination.",
);
assert(
  signIn.includes("KSI for teaching & school leadership") &&
    !signIn.includes("Student Access Code"),
  "Sign-in must present the simplified Teacher/Leadership product.",
);
assert(
  callback.includes('path.startsWith("/student/")') &&
    callback.includes('return "/dashboard"'),
  "Old Student auth return paths must be neutralised.",
);

for (const required of [
  "Teacher workspace",
  "Leadership workspace",
  'href: "/teacher/resources"',
  'href: "/hqls"',
  'href: "/assessment"',
  'href: "/diagnosis"',
  'href: "/interventions"',
  'href: "/leadership"',
  'href: "/setup/staff-access"',
  "Student-facing KSI has been retired",
]) {
  assert(dashboard.includes(required), `Simplified dashboard is missing: ${required}`);
}
assert(
  !dashboard.includes('href: "/setup/student-access"'),
  "Student Access must not remain a dashboard destination.",
);

for (const required of [
  'label: "Home"',
  'label: "Resources"',
  'label: "HQLS"',
  'label: "Assess"',
  'label: "Diagnose"',
  'label: "Learning Health"',
  'role === "student"',
]) {
  assert(navigation.includes(required), `Persistent KSI navigation is missing: ${required}`);
}

assert(
  academicPage.includes("AcademicResourcesClient"),
  "Teacher Academic Resources route is not mounted.",
);
for (const required of [
  "Scheme of Work",
  "School Resources",
  "Learning objectives",
  "Learning activities",
  "Embedded core skills",
  "Learning resources",
  "Create HQLS lesson",
  "rich extraction",
  "pending source repair",
]) {
  assert(academicResources.includes(required), `Teacher Academic Resources is missing: ${required}`);
}
assert(
  academicResources.includes("get_academic_resource_catalog"),
  "Teacher Academic Resources must use the governed read RPC.",
);
assert(
  hqlsPage.includes("SchemePrefillBridge") &&
    hqlsPage.includes('href="/teacher/resources"'),
  "HQLS must link back to Academic Resources and mount scheme prefill.",
);
assert(
  prefill.includes('params.get("from") !== "scheme"') &&
    prefill.includes("objective"),
  "Scheme-to-HQLS handoff must carry teaching context.",
);

for (const required of [
  "get_academic_resource_catalog",
  "private.has_workspace_role",
  "owner','admin','leader','teacher",
  "review_status <> 'rejected'",
  "replace_scheme_class_extraction",
  "private.is_platform_access_admin()",
  "review_status <> 'pending' OR promoted_at IS NOT NULL",
  "This source is quarantined",
  "class contains reviewed or promoted rows",
]) {
  assert(migration.includes(required), `Stage 16 database governance is missing: ${required}`);
}
assert(
  !migration.includes("replace_scheme_term_extraction"),
  "Stage 16 must use one transactional replacement per class rather than nine class/term repair passes.",
);
assert(
  !migration.includes("promote_scheme_entry("),
  "Source repair must never call curriculum promotion.",
);

for (const required of [
  "source-faithful Scheme of Work extraction utility",
  "Never invent a missing cell",
  "covering ALL terms for that class",
  "Pending human review",
  "get_scheme_review_console",
  "replace_scheme_class_extraction",
  "stage12_review_required",
  "Requested class:",
]) {
  assert(repairApi.includes(required), `Scheme repair API is missing: ${required}`);
}
assert(
  !repairApi.includes('form.get("term")') &&
    !repairApi.includes("replace_scheme_term_extraction"),
  "Scheme repair API must execute one AI extraction per class, not one per term.",
);
assert(
  !repairApi.includes("promote_scheme_entry") &&
    !repairApi.includes("review_scheme_entry"),
  "Scheme repair API must not review or promote extracted rows.",
);

for (const required of [
  "Repair entire source",
  "Pending review",
  "QUARANTINED",
  "once per class",
  "document.class_scope",
  "extraction passes",
]) {
  assert(repairClient.includes(required), `Scheme repair console is missing: ${required}`);
}
assert(
  !repairClient.includes("const TERMS") &&
    !repairClient.includes('body.set("term"'),
  "Scheme repair console must not multiply work into class/term slices.",
);
assert(
  schemePage.includes("SchemeSourceRepairClient") &&
    schemePage.includes("SchemeIngestionClient"),
  "Scheme governance page must combine source repair with the existing review console.",
);
assert(
  databaseTypes.includes("replace_scheme_class_extraction") &&
    !databaseTypes.includes("replace_scheme_term_extraction"),
  "Typed Supabase contract must match the class-level repair RPC.",
);

for (const retired of [
  studentHome,
  studentJoin,
  studentLearning,
  studentMastery,
  studentPlan,
  studentAsk,
]) {
  assert(
    retired.includes("student-surface-retired"),
    "Every former Student KSI route must be retired at the page boundary.",
  );
}
assert(
  studentAskApi.includes("status: 410") &&
    !studentAskApi.includes("generateOpenAIJson"),
  "Retired Student Ask API must return 410 and perform no AI work.",
);
assert(
  studentAccess.includes('redirect("/setup")'),
  "Student account-code setup must be retired from school administration.",
);

const browserSurface = [
  authForm,
  dashboard,
  navigation,
  academicResources,
  repairClient,
  prefill,
].join("\n");
assert(
  !browserSurface.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !browserSurface.includes("service_role"),
  "Stage 16 browser code must not expose service-role credentials.",
);

console.log(
  "Stage 16 verification passed: KSI is simplified to Teacher + Leadership/Owner, Academic Resources is first-class, Student-facing routes are retired, and scheme source repair uses fast class-level extraction while remaining pending-review, quarantined and non-promoting.",
);
