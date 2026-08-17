import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  amendment,
  planMigration,
  resourceMigration,
  leadershipMigration,
  reviewMigration,
  askApi,
  resourceApi,
  askClient,
  planClient,
  curriculumStudent,
  resourceFactory,
  leadershipPanel,
  studentPage,
  studentLearningPage,
  leadershipPage,
] = await Promise.all([
  text("docs/KSI_2_1_COMPLETION_AMENDMENT.md"),
  text("supabase/migrations/059_stage13_student_plan_and_ask_ksi.sql"),
  text("supabase/migrations/060_stage13_curriculum_learning_resource_engine.sql"),
  text("supabase/migrations/061_stage13_leadership_curriculum_risk_intelligence.sql"),
  text("supabase/migrations/062_stage13_curriculum_resource_review_detail.sql"),
  text("app/api/student/ask/route.ts"),
  text("app/api/curriculum/resource/route.ts"),
  text("components/student/ask-ksi-client.tsx"),
  text("components/student/student-learning-plan-client.tsx"),
  text("components/student/student-curriculum-library-panel.tsx"),
  text("components/curriculum/curriculum-resource-factory-client.tsx"),
  text("components/leadership/curriculum-risk-intelligence-panel.tsx"),
  text("app/student/page.tsx"),
  text("app/student/learning/page.tsx"),
  text("app/leadership/page.tsx"),
]);

for (const required of [
  "Ask KSI",
  "not a fourth authoritative intelligence engine",
  "Persistent personalized learning plan",
  "Canonical promoted objective → AI draft → Human review → Explicit publication → Student library",
  "nothing is automatically promoted",
  "Leadership curriculum and risk intelligence",
]) {
  assert(amendment.includes(required), `KSI 2.1 completion amendment is missing: ${required}`);
}

for (const required of [
  "student_learning_plans",
  "student_learning_plan_steps",
  "student_tutor_turns",
  "private.refresh_student_learning_plan",
  "get_my_personalized_learning_plan",
  "update_my_learning_plan_step",
  "get_my_ask_ksi_context",
  "begin_my_ask_ksi_turn",
  "complete_my_ask_ksi_turn",
  "get_my_ask_ksi_history",
  "recent_minute >= 4",
  "recent_hour >= 30",
]) {
  assert(planMigration.includes(required), `Student plan / Ask KSI governance is missing: ${required}`);
}

assert(
  planMigration.includes("perform private.refresh_student_mastery") &&
    planMigration.includes("latest confirmed intervention") &&
    planMigration.includes("lm.state <> 'mastered'") &&
    planMigration.includes("workspace_curriculum_adoptions"),
  "Personalized planning must remain derived from intervention, mastery and approved curriculum rather than a parallel student record.",
);

assert(
  planMigration.includes("'tutor_may_change_authoritative_state', false") &&
    planMigration.includes("'teacher_private_notes_included', false"),
  "Ask KSI database context must explicitly deny authoritative-state mutation and private teacher-note exposure.",
);

for (const required of [
  "curriculum_learning_resources",
  "get_curriculum_resource_generation_context",
  "save_curriculum_learning_resource_draft",
  "review_curriculum_learning_resource",
  "get_my_curriculum_learning_resources",
  "private.is_platform_access_admin()",
  "status = 'reviewed'",
  "status = 'published'",
]) {
  assert(resourceMigration.includes(required), `Curriculum resource engine is missing: ${required}`);
}

assert(
  resourceMigration.includes("se.review_status = 'approved'") &&
    resourceMigration.includes("se.promoted_at is not null"),
  "Curriculum resource generation context must be grounded only in canonical/promoted scheme provenance.",
);

assert(
  reviewMigration.includes("get_curriculum_learning_resource_detail") &&
    reviewMigration.includes("update_curriculum_learning_resource_draft") &&
    reviewMigration.includes("Published or retired resources are immutable"),
  "Human curriculum-resource review must support inspection/editing while preserving published immutability.",
);

for (const required of [
  "get_leadership_curriculum_risk_intelligence",
  "diagnosis_without_intervention",
  "mastery_intervention_required",
  "stale_learning_evidence",
  "personal_plan_not_started",
  "class_curriculum_coverage",
  "subject_curriculum_coverage",
  "do not rank student or teacher worth",
]) {
  assert(leadershipMigration.includes(required), `Leadership curriculum/risk intelligence is missing: ${required}`);
}

assert(
  askApi.includes("generateOpenAIJson") &&
    askApi.includes("begin_my_ask_ksi_turn") &&
    askApi.includes("get_my_ask_ksi_context") &&
    askApi.includes("get_my_curriculum_learning_resources") &&
    askApi.includes("complete_my_ask_ksi_turn") &&
    askApi.includes("fail_my_ask_ksi_turn"),
  "Ask KSI must use the shared server-side OpenAI helper and governed student-safe RPC context.",
);

for (const required of [
  "you are not an authority that can change the student's official KSI record",
  "you may not invent, revise, upgrade or downgrade them",
  "Never expose or speculate about private teacher notes",
  "If they are absent, do not claim that a topic is officially in the student's curriculum",
]) {
  assert(askApi.includes(required), `Ask KSI safety boundary is missing: ${required}`);
}

assert(
  resourceApi.includes("get_curriculum_resource_generation_context") &&
    resourceApi.includes("save_curriculum_learning_resource_draft") &&
    resourceApi.includes("publicationStatus: \"draft\"") &&
    resourceApi.includes("human platform reviewer explicitly publishes"),
  "Curriculum resource generation must terminate in a draft, never automatic publication.",
);

assert(askClient.includes("/api/student/ask") && askClient.includes("get_my_ask_ksi_history"), "Ask KSI student UI is not connected.");
assert(planClient.includes("get_my_personalized_learning_plan") && planClient.includes("update_my_learning_plan_step"), "Student personalized plan UI is not connected.");
assert(curriculumStudent.includes("get_my_curriculum_learning_resources") && curriculumStudent.includes("human-reviewed and published"), "Student curriculum library must show only governed published resources.");
assert(resourceFactory.includes("/api/curriculum/resource") && resourceFactory.includes("Mark human-reviewed") && resourceFactory.includes("Publish to students"), "Curriculum Resource Factory must preserve separate generation/review/publication controls.");
assert(leadershipPanel.includes("get_leadership_curriculum_risk_intelligence") && leadershipPanel.includes("Learning-risk signals"), "Leadership completion panel is not connected.");

for (const route of ['href="/student/plan"', 'href="/student/ask"']) {
  assert(studentPage.includes(route), `Student KSI navigation is missing ${route}`);
}
assert(studentLearningPage.includes("StudentCurriculumLibraryPanel"), "Published curriculum resources are not mounted in Student KSI learning.");
assert(leadershipPage.includes("CurriculumRiskIntelligencePanel"), "Leadership curriculum/risk intelligence is not mounted.");

const browserSurface = [askClient, planClient, curriculumStudent, resourceFactory, leadershipPanel, studentPage, studentLearningPage, leadershipPage].join("\n");
assert(!browserSurface.includes("SUPABASE_SERVICE_ROLE_KEY") && !browserSurface.includes("service_role"), "KSI 2.0 completion surfaces must not expose a Supabase service-role credential.");

console.log(
  "KSI 2.0 completion verification passed: bounded Ask KSI, persistent personalized plans, human-published curriculum resources and aggregate Leadership curriculum/risk intelligence remain synchronized with the governed shared learning record.",
);
