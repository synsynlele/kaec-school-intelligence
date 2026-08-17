import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  amendment,
  simplification,
  planMigration,
  resourceMigration,
  leadershipMigration,
  reviewMigration,
  planStabilityMigration,
  askApi,
  resourceApi,
  askClient,
  planClient,
  curriculumStudent,
  resourceFactory,
  leadershipPanel,
  studentPage,
  studentLearningPage,
  studentPlanPage,
  studentAskPage,
  leadershipPage,
] = await Promise.all([
  text("docs/KSI_2_1_COMPLETION_AMENDMENT.md"),
  text("docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md"),
  text("supabase/migrations/059_stage13_student_plan_and_ask_ksi.sql"),
  text("supabase/migrations/060_stage13_curriculum_learning_resource_engine.sql"),
  text("supabase/migrations/061_stage13_leadership_curriculum_risk_intelligence.sql"),
  text("supabase/migrations/062_stage13_curriculum_resource_review_detail.sql"),
  text("supabase/migrations/063_stage13_learning_plan_fingerprint_stability.sql"),
  text("app/api/student/ask/route.ts"),
  text("app/api/curriculum/resource/route.ts"),
  text("components/student/ask-ksi-client.tsx"),
  text("components/student/student-learning-plan-client.tsx"),
  text("components/student/student-curriculum-library-panel.tsx"),
  text("components/curriculum/curriculum-resource-factory-client.tsx"),
  text("components/leadership/curriculum-risk-intelligence-panel.tsx"),
  text("app/student/page.tsx"),
  text("app/student/learning/page.tsx"),
  text("app/student/plan/page.tsx"),
  text("app/student/ask/page.tsx"),
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
  assert(amendment.includes(required), `KSI 2.1 historical completion guarantee is missing: ${required}`);
}
for (const required of [
  "Student-facing KSI surface",
  "Historical student accounts and data must not be destructively deleted",
  "creates no new authoritative AI engine",
]) {
  assert(simplification.includes(required), `KSI 2.2 supersession rule is missing: ${required}`);
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
  assert(planMigration.includes(required), `Preserved Student plan / Ask KSI data governance is missing: ${required}`);
}

assert(
  planMigration.includes("perform private.refresh_student_mastery") &&
    planMigration.includes("latest confirmed intervention") &&
    planMigration.includes("lm.state <> 'mastered'") &&
    planMigration.includes("workspace_curriculum_adoptions"),
  "Historical personalized planning data must remain derived from intervention, mastery and approved curriculum.",
);

assert(
  planStabilityMigration.includes("preserve_learner_mastery_timestamp_on_noop") &&
    planStabilityMigration.includes("is not distinct from") &&
    planStabilityMigration.includes("new.updated_at := old.updated_at"),
  "Mastery/plan history must remain stable even though the Student product surface is retired.",
);

for (const required of [
  "curriculum_learning_resources",
  "get_curriculum_resource_generation_context",
  "save_curriculum_learning_resource_draft",
  "review_curriculum_learning_resource",
  "private.is_platform_access_admin()",
  "status = 'reviewed'",
  "status = 'published'",
]) {
  assert(resourceMigration.includes(required), `Governed curriculum resource foundation is missing: ${required}`);
}
assert(
  resourceMigration.includes("se.review_status = 'approved'") && resourceMigration.includes("se.promoted_at is not null"),
  "Curriculum resource generation context must remain grounded only in reviewed/promoted provenance.",
);
assert(
  reviewMigration.includes("get_curriculum_learning_resource_detail") &&
    reviewMigration.includes("update_curriculum_learning_resource_draft") &&
    reviewMigration.includes("Published or retired resources are immutable"),
  "Human curriculum-resource review must preserve published immutability.",
);

for (const required of [
  "get_leadership_curriculum_risk_intelligence",
  "diagnosis_without_intervention",
  "mastery_intervention_required",
  "stale_learning_evidence",
  "class_curriculum_coverage",
  "subject_curriculum_coverage",
  "do not rank student or teacher worth",
]) {
  assert(leadershipMigration.includes(required), `Leadership curriculum/risk intelligence is missing: ${required}`);
}

assert(
  askApi.includes("status: 410") && askApi.includes("Student-facing KSI has been retired"),
  "The former Ask KSI network endpoint must fail closed after Student KSI retirement.",
);
assert(
  !askApi.includes("generateOpenAIJson") && !askApi.includes("begin_my_ask_ksi_turn"),
  "The retired Student Ask API must no longer invoke AI or create tutor turns.",
);

assert(
  resourceApi.includes("get_curriculum_resource_generation_context") &&
    resourceApi.includes("save_curriculum_learning_resource_draft") &&
    resourceApi.includes("publicationStatus: \"draft\"") &&
    resourceApi.includes("human platform reviewer explicitly publishes"),
  "Any retained curriculum resource generation must still terminate in a draft, never automatic publication.",
);

assert(askClient.includes("/api/student/ask") && askClient.includes("get_my_ask_ksi_history"), "Historical Ask KSI component source was unexpectedly corrupted.");
assert(planClient.includes("get_my_personalized_learning_plan") && planClient.includes("update_my_learning_plan_step"), "Historical plan component source was unexpectedly corrupted.");
assert(curriculumStudent.includes("get_my_curriculum_learning_resources"), "Historical curriculum-library component source was unexpectedly corrupted.");
assert(resourceFactory.includes("/api/curriculum/resource"), "Governed curriculum resource factory source is missing.");
assert(leadershipPanel.includes("get_leadership_curriculum_risk_intelligence") && leadershipPanel.includes("Learning-risk signals"), "Leadership completion panel is not connected.");

for (const retiredPage of [studentPage, studentLearningPage, studentPlanPage, studentAskPage]) {
  assert(retiredPage.includes("student-surface-retired"), "A former Student KSI route is still active instead of redirecting to the retired-surface entry.");
}
assert(leadershipPage.includes("CurriculumRiskIntelligencePanel"), "Leadership curriculum/risk intelligence is not mounted.");

const browserSurface = [askClient, planClient, curriculumStudent, resourceFactory, leadershipPanel, leadershipPage].join("\n");
assert(!browserSurface.includes("SUPABASE_SERVICE_ROLE_KEY") && !browserSurface.includes("service_role"), "KSI completion surfaces must not expose a Supabase service-role credential.");

console.log(
  "KSI 2.1 compatibility verification passed under KSI 2.2: historical learner data remains governed, Student-facing routes and tutor API are retired, and Leadership intelligence retains its synchronized evidence foundation.",
);
