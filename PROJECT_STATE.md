# KAEC School Intelligence — Project State

Updated: 17 August 2026

## Current checkpoint

**KSI 2.0 — Consolidated Learning Intelligence release candidate / database-runtime acceptance passed**

KSI Version 1 remains the accepted production baseline on `main`. The KSI 2.0 constitutional amendment expands the product into synchronized Teacher, Student and Leadership learning-intelligence surfaces while preserving the specialist learning boundary: KSI is not a school ERP.

Authoritative development lineage:

- branch: `ksi-2-consolidation`;
- draft PR: `#13 — KSI 2.0 — Consolidated Learning Intelligence release candidate`;
- base: `main`;
- PRs #11 and #12 are closed as superseded, not merged.

No production merge or release is authorised at this checkpoint.

## Unified KSI 2.0 learning model

The accepted Version 1 loop remains intact:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Intervention → Next HQLS Lesson**

KSI 2.0 extends the same governed record into:

**HQLS Lesson → Student Learning Resource → Assessment / Student Work → Student Evidence → Diagnosis → Intervention → Mastery / Next Learning → Next HQLS Lesson → Leadership Learning Signal**

Student, Teacher and Leadership KSI operate over the same workspace-scoped learning record. There is no separate Student database or Leadership intelligence silo.

## Implemented KSI 2.0 foundation

### School Access Control

Implemented and runtime-proved:

- `active | paused | blocked | disabled` school states;
- dedicated `platform_access_admins` authority;
- guarded `set_school_access_status(...)`;
- school-access audit foundation;
- `/admin/schools` platform console;
- inactive school state blocks normal Student/Leadership access without deleting learning data.

### Shared roles and identity

Implemented:

- `owner | admin | leader | teacher | student` roles;
- one-time Student Access Code issue/redeem flow;
- student account binding to an existing learner record;
- Teacher ↔ Class ↔ Subject teaching assignments;
- student-safe own-record boundaries.

Runtime acceptance discovered and corrected the PL/pgSQL conflict-target defect in Student Access redemption through migration `057_stage8_student_access_redeem_conflict_fix.sql`.

### Student KSI

Implemented substantially:

- `/student` learning-intelligence home;
- diagnosis/intervention priority;
- strengths and growth areas;
- `What should I work on today?`;
- reviewed real-life learning evidence;
- `/student/learning` learning library;
- lesson reflection / real-life task submission;
- `/student/mastery` objective mastery graph;
- Next Best Learning Action.

Not yet complete:

- Ask KSI personal tutor;
- complete curriculum-generated JSS1–SS3 learning-resource corpus;
- persistent multi-step adaptive learning plan.

### Leadership KSI

Implemented substantially:

- school learning health;
- class/subject intelligence;
- intervention coverage and learners needing attention;
- lesson-delivery / submission / teacher-review signals;
- objective mastery intelligence and priority objectives.

True curriculum-coverage intelligence remains limited until canonical curriculum nodes are human-reviewed and promoted.

### Synchronization backbone

Implemented and runtime-proved:

- validated HQLS lesson delivery through the real teaching map;
- roster snapshot into `student_lesson_work`;
- Student receives the taught resource;
- Student submits reflection / real-life work;
- Teacher reviews the work;
- reviewed work becomes governed `student_evidence`;
- Student mastery refreshes from that evidence;
- Leadership sees delivery/review/mastery changes from the same record.

### Mastery and next-learning

Implemented:

- `learning_objective_nodes`;
- `mastery_events`;
- `learner_mastery`;
- evidence-confidence states;
- intervention/mastery/baseline-aware Next Best Learning Action;
- Leadership mastery aggregation.

Runtime acceptance identified join multiplication that could count one qualitative evidence row more than once. Migration `058_stage11_mastery_distinct_evidence_fix.sql` now counts distinct evidence records. Final acceptance proved that one reviewed qualitative item remains `evidence_building` / low-confidence rather than prematurely becoming `developing`.

### Curriculum Intelligence and scheme ingestion

Implemented database/review foundation:

- curriculum sources/frameworks/nodes;
- prerequisite/alignment/adoption entities;
- Lagos scheme document/batch/entry ingestion;
- platform-admin review console;
- explicit approval separate from explicit promotion.

Protected live baseline remains:

- scheme entries: `2,957`;
- pending: `2,957`;
- approved: `0`;
- rejected: `0`;
- promoted: `0`;
- canonical curriculum nodes: `0`;
- scheme-entry node links: `0`;
- mixed IRS source remains quarantined.

Nothing is automatically promoted.

## Migration reconciliation

The consolidated repository owns migrations `026–058` after Version 1.

PR #11 originally occupied `026–055`, while PR #12 independently used `026` for review-console hardening. Consolidation stores that exact hardening as:

`056_stage12_review_console_hardening.sql`

Acceptance added:

- `057_stage8_student_access_redeem_conflict_fix.sql`;
- `058_stage11_mastery_distinct_evidence_fix.sql`.

The three relevant live migration-history names are:

- `stage12_review_console_hardening`;
- `stage8_student_access_redeem_conflict_fix`;
- `stage11_mastery_distinct_evidence_fix`.

## KSI 2.0 runtime acceptance

Detailed evidence: `docs/KSI_2_RUNTIME_ACCEPTANCE_2026-08-17.md`.

A single quota-controlled Vercel Preview was successfully created from `ksi-2-acceptance-preview`. The frontend content was unchanged by the subsequent schema-only runtime fixes, so no second Vercel build was consumed.

The final authenticated rollback transaction passed **21/21** database/runtime checks across:

**Platform Admin → Owner/Admin → Leader → Teacher → Student → Student Evidence → Mastery → Leadership**

Key final proof:

- Student baseline mastery objectives: `10`;
- after one reviewed HQLS lesson inside the transaction: `11`;
- new qualitative evidence count: exactly `1`;
- all 11 remained conservatively `evidence_building` after one qualitative item;
- Leadership saw the same 11-objective graph;
- one delivery produced one assigned, one submitted and one reviewed student-work record;
- Leadership delivery intelligence reflected 100% submission/review for that acceptance delivery;
- pausing the school preserved the linked data while blocking Student KSI.

The transaction ended with `ROLLBACK`.

Post-acceptance live audit returned to the original data state:

- school status: `active`;
- temporary acceptance memberships: `0`;
- student accounts: `0`;
- lesson deliveries: `0`;
- student lesson-work rows: `0`;
- school access audit rows from acceptance: `0`;
- learner-mastery rows: `10`;
- mastery events: `20`;
- scheme pending: `2,957`;
- promoted schemes: `0`;
- curriculum nodes: `0`.

The function-fix migrations remain intentionally applied.

## Browser visual acceptance limitation

GitHub/Vercel reported the deliberate Preview deployment as successful. The Vercel connector available in the current ChatGPT session is authenticated to a different Vercel scope from the KSI project and therefore cannot open the protected preview deployment for visual browser smoke testing.

Accordingly:

- **database/runtime multi-role acceptance: PASSED**;
- **preview deployment: SUCCESS**;
- **protected-preview browser visual smoke: not independently executed from this tool session**.

Do not misstate the browser gate as passed until it is actually observed through an authorised KSI Vercel session or founder manual check.

## Next product work after acceptance

Continue Student and Leadership in parallel over the same data model:

- Student: Ask KSI, curriculum-generated learning-resource engine, persistent personalized learning plan;
- Leadership: real curriculum coverage by class/subject/term/week/topic and stronger learning-risk signals;
- Shared: human review/promotion of scheme entries and curriculum-objective alignment;
- Parent layer remains later;
- commercial multi-school onboarding follows the same platform-controlled access model.

## Release control

PR #13 remains draft and unmerged. No production release follows automatically from runtime acceptance. A merge/release still requires explicit founder authorisation after the exact consolidated head passes CI and any desired protected-preview visual check is completed.
