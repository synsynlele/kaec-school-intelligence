# KAEC School Intelligence — Project State

Updated: 17 August 2026

## Current checkpoint

**KSI 2.0 — Coordinated Learning Intelligence implementation COMPLETE / final release-candidate preview pending**

KSI Version 1 remains the accepted production baseline on `main`. The KSI 2.0 constitutional amendments extend the same governed learning record into synchronized Teacher, Student and Leadership intelligence without turning KSI into a school ERP.

Authoritative development lineage:

- branch: `ksi-2-consolidation`;
- draft PR: `#13 — KSI 2.0 — Consolidated Learning Intelligence release candidate`;
- base: `main`;
- prior KSI 2.0 source PRs are superseded by the consolidation lineage.

No production merge or release is authorised at this checkpoint.

## Unified KSI 2.0 learning model

The accepted Version 1 loop remains intact:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Intervention → Next HQLS Lesson**

KSI 2.0 completes the coordinated learning-intelligence loop as:

**HQLS Lesson → Student Learning Resource → Assessment / Student Work → Student Evidence → Diagnosis → Intervention → Mastery / Personalized Plan → Next Learning → Next HQLS Lesson → Leadership Learning Signal**

Student, Teacher and Leadership KSI operate over the same workspace-scoped learning record. There is no separate Student database and no Leadership intelligence silo.

## KSI 2.0 completion status

### 1. School Access Control — COMPLETE

Implemented and runtime-proved:

- `active | paused | blocked | disabled` school states;
- dedicated `platform_access_admins` authority;
- guarded `set_school_access_status(...)`;
- school-access audit foundation;
- `/admin/schools` platform console;
- inactive school state blocks ordinary Student/Leadership access without deleting learning data.

### 2. Shared roles and identity — COMPLETE

Implemented and runtime-proved:

- `owner | admin | leader | teacher | student` roles;
- one-time Student Access Code issue/redeem flow;
- student account binding to an existing learner record;
- Teacher ↔ Class ↔ Subject teaching assignments;
- student-safe own-record boundaries.

Acceptance corrected the Student Access redemption conflict-target defect through `057_stage8_student_access_redeem_conflict_fix.sql`.

### 3. Student KSI — COMPLETE for immediate KSI 2.0 scope

Implemented:

- `/student` learning-intelligence home;
- diagnosis/intervention priority;
- strengths and growth areas;
- `What should I work on today?`;
- reviewed real-life learning evidence;
- `/student/learning` validated HQLS learning library;
- published curriculum self-study library;
- lesson reflection / real-life task submission;
- `/student/mastery` objective mastery graph;
- Next Best Learning Action;
- `/student/plan` persistent, versioned personalized learning plan;
- `/student/ask` bounded Ask KSI learning tutor.

Ask KSI is a supporting tutor, not a fourth authoritative engine. It may explain, practise and guide learning but cannot create or alter official diagnosis, intervention or mastery states and does not receive private teacher notes.

### 4. Leadership KSI — COMPLETE for immediate KSI 2.0 scope

Implemented:

- school learning health;
- class/subject intelligence;
- intervention coverage and learners needing attention;
- lesson-delivery / submission / teacher-review signals;
- objective mastery intelligence and priority objectives;
- curriculum readiness and coverage;
- published-resource coverage;
- verified curriculum-objective alignment coverage;
- aggregate learning-risk signals for missing intervention response, mastery risk, stale evidence, overdue intervention review, low-confidence mastery and inactive personalized plans.

Learning-risk signals direct system response and do not rank learner or teacher worth.

### 5. Synchronization backbone — COMPLETE

Implemented and runtime-proved:

- validated HQLS lesson delivery through the real teaching map;
- class roster snapshot into `student_lesson_work`;
- Student receives the taught resource;
- Student submits reflection / real-life work;
- Teacher reviews work;
- reviewed work becomes governed `student_evidence`;
- mastery refreshes from the same evidence;
- Student personalized planning reads the same intervention/mastery/curriculum state;
- Leadership sees delivery/review/mastery/risk changes from the same shared record.

### 6. Mastery and next-learning — COMPLETE

Implemented:

- `learning_objective_nodes`;
- `mastery_events`;
- `learner_mastery`;
- evidence-confidence states;
- intervention/mastery/baseline-aware Next Best Learning Action;
- persistent personalized plan;
- Leadership mastery aggregation.

Acceptance corrected qualitative-evidence join multiplication through `058_stage11_mastery_distinct_evidence_fix.sql`.

Migration `063_stage13_learning_plan_fingerprint_stability.sql` now preserves `learner_mastery.updated_at` on substantive no-op writes so personalized-plan versions remain stable across separate requests unless governed learning state actually changes.

### 7. Curriculum Intelligence — ENGINE COMPLETE / CONTENT AWAITS HUMAN GOVERNANCE

Implemented:

- curriculum sources/frameworks/nodes;
- prerequisite/alignment/adoption entities;
- Lagos scheme document/batch/entry ingestion;
- platform-admin review console;
- explicit approval separate from explicit promotion;
- canonical-objective curriculum learning-resource factory;
- AI draft generation;
- human review;
- separate explicit publication;
- Student published-resource library;
- Leadership curriculum/resource/alignment coverage.

Protected live content baseline remains intentionally unchanged:

- scheme entries: `2,957`;
- pending: `2,957`;
- approved: `0`;
- rejected: `0`;
- promoted: `0`;
- canonical curriculum nodes: `0`;
- curriculum learning resources: `0`;
- mixed IRS source remains quarantined.

This is a governance state, not an unfinished code path. No pending scheme entry can become a student curriculum resource until a human completes review and explicit promotion. AI-generated learning resources then require human review and separate publication.

Nothing is automatically promoted or published.

## Completion migrations

The consolidation repository now carries KSI 2.0 migrations through `063`.

Acceptance/runtime corrections:

- `057_stage8_student_access_redeem_conflict_fix.sql`;
- `058_stage11_mastery_distinct_evidence_fix.sql`.

Completion layer:

- `059_stage13_student_plan_and_ask_ksi.sql`;
- `060_stage13_curriculum_learning_resource_engine.sql`;
- `061_stage13_leadership_curriculum_risk_intelligence.sql`;
- `062_stage13_curriculum_resource_review_detail.sql`;
- `063_stage13_learning_plan_fingerprint_stability.sql`.

All five Stage 13 migrations are applied to the dedicated KSI Supabase project.

## Runtime acceptance evidence

Detailed records:

- `docs/KSI_2_RUNTIME_ACCEPTANCE_2026-08-17.md` — coordinated role/synchronization acceptance;
- `docs/KSI_2_COMPLETION_ACCEPTANCE_2026-08-17.md` — final Student/Leadership/curriculum completion acceptance.

### Coordinated role/synchronization acceptance

Final authenticated rollback transaction passed **21/21** across:

**Platform Admin → Owner/Admin → Leader → Teacher → Student → Student Evidence → Mastery → Leadership**

Key proof:

- baseline Student mastery: `10` objectives;
- one reviewed HQLS qualitative work item produced exactly one new qualitative evidence item;
- mastery moved to `11` objectives without exaggerating confidence;
- Leadership saw the same 11-objective graph;
- one delivery produced one assigned, one submitted and one reviewed work record;
- pausing school access preserved linked data while blocking Student KSI.

### Completion acceptance

Final Stage 13 rollback harness passed **10/10**:

1. platform curriculum factory stays empty before human promotion;
2. Leader is denied platform curriculum-resource authority;
3. Leader receives aggregate curriculum readiness/risk intelligence;
4. personalized plan is intervention-first, mastery-backed and stable;
5. no-op mastery writes preserve the timestamp used by plan fingerprinting;
6. plan progress persists without directly changing mastery;
7. Ask KSI context is own-student and explicitly non-authoritative;
8. Ask KSI turn lifecycle/history works;
9. Ask KSI four-turn/minute rate boundary works;
10. Student curriculum library remains empty until human promotion/publication.

All acceptance data was created inside transactions ending with `ROLLBACK`.

## Post-acceptance live audit

Production data remains clean:

- KAEC Nigerian Schools: `active`;
- temporary acceptance memberships: `0`;
- student accounts: `0`;
- personalized plans: `0`;
- plan steps: `0`;
- tutor turns: `0`;
- curriculum learning resources: `0`;
- learner mastery rows: `10`;
- mastery events: `20`;
- scheme pending: `2,957`;
- promoted schemes: `0`;
- curriculum nodes: `0`.

## Stage 13 security audit

New tables:

- `student_learning_plans`;
- `student_learning_plan_steps`;
- `student_tutor_turns`;
- `curriculum_learning_resources`.

Verified on all four:

- RLS enabled;
- anonymous direct SELECT denied;
- authenticated direct SELECT denied;
- authenticated direct INSERT denied;
- authenticated direct UPDATE denied.

Stage 13 public RPCs deny anonymous execution and allow authenticated execution only through their internal student/role/platform checks. Platform curriculum-resource functions additionally enforce `private.is_platform_access_admin()`.

No client-side service-role credential is introduced.

## Engineering verification

Exact completion implementation has passed:

- dependency installation;
- lint;
- strict TypeScript;
- constitutional/structural verification;
- permanent KSI 2.0 completion verifier;
- production build;
- dependency audit.

A final exact-head CI run is required after this project-state closeout commit before the final preview branch is cut.

## Remaining release gate

Implementation is complete. The remaining work is release proof, not product construction:

1. create one final Vercel Preview from the exact green completion head;
2. perform protected-browser visual smoke through an authorised KSI Vercel/browser session;
3. perform one real Ask KSI AI turn using a genuine separate Student account.

The Vercel connector available in this ChatGPT session is authenticated to a different protected Vercel scope, so protected-preview browser interaction cannot be independently executed here.

## Later roadmap

Not part of the immediate KSI 2.0 completion:

- Parent KSI surface;
- broader commercial multi-school onboarding operations beyond the already-built platform school-access model;
- ongoing human review/promotion of the 2,957 staged curriculum entries and generation/publication of the actual student curriculum resource corpus.

Those are rollout/content operations or later product layers, not blockers to the coordinated KSI 2.0 application architecture.

## Release control

PR #13 remains **draft and unmerged**. No production release follows automatically from implementation or runtime acceptance. Merge to `main` and production release still require explicit founder authorisation after the final preview/browser gate.