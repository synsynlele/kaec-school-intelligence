# KAEC School Intelligence — Project State

Updated: 17 August 2026

## Current checkpoint

**KSI 2.0 — Consolidated Learning Intelligence release candidate / engineering verification in progress**

KSI Version 1 remains the accepted production baseline on `main`. The founder-authorised KSI 2.0 constitutional amendment expands the product into synchronized Teacher, Student and Leadership learning-intelligence surfaces while preserving the specialist learning boundary: KSI is not a school ERP.

The active consolidation lineage is:

- branch: `ksi-2-consolidation`
- draft PR: `#13 — KSI 2.0 — Consolidated Learning Intelligence release candidate`
- base: current `main`
- prior draft lines `#11` and `#12` are source lineages being superseded by PR #13

No production merge or Vercel release is authorised at this checkpoint.

## Accepted foundation preserved

The accepted Version 1 loop remains intact:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Intervention → Next HQLS Lesson**

KSI 2.0 extends the same governed record into:

**HQLS Lesson → Student Learning Resource → Assessment → Student Evidence → Diagnosis → Intervention → Student Priority / Next Learning → Next HQLS Lesson → Leadership Learning Signal**

There is no second Student database and no separate Leadership intelligence store. The three product surfaces are designed to read and act on the same workspace-scoped learning record.

## KSI 2.0 implementation present in the consolidation branch

### 1. School Access Control

Implemented:

- school access states: `active | paused | blocked | disabled`;
- dedicated `platform_access_admins` authority;
- guarded `set_school_access_status(...)` RPC;
- append-only school access audit foundation;
- school access console at `/admin/schools`;
- normal protected school access is database-gated by active school state.

### 2. Shared roles and student identity

Implemented foundation:

- workspace roles: `owner | admin | leader | teacher | student`;
- student account binding to an existing KSI learner record;
- one-time Student Access Code issue/redeem flow;
- student-safe own-record boundaries;
- school owner/admin provisioning surface.

### 3. Student KSI

Implemented substantially:

- `/student` learning-intelligence home;
- student-safe diagnosis and intervention view;
- strengths and growth areas;
- `What should I work on today?` guidance;
- reviewed real-life learning evidence;
- `/student/learning` living learning library;
- student reflection / real-life assignment submission;
- `/student/mastery` objective-level mastery graph;
- Next Best Learning Action.

Not yet complete:

- Ask KSI personal tutor;
- complete curriculum-generated JSS1–SS3 learning-resource corpus;
- persistent multi-step adaptive learning plan.

### 4. Leadership KSI

Implemented substantially:

- `/leadership` school learning health;
- class learning health;
- subject intelligence;
- intervention coverage and learners needing attention;
- lesson-delivery / submission / teacher-review execution signals;
- objective-level mastery intelligence and priority objectives.

Curriculum coverage cannot yet be considered live because the canonical curriculum graph still contains zero promoted scheme nodes.

### 5. Synchronization backbone

Implemented:

- governed Teacher ↔ Class ↔ Subject teaching map;
- validated HQLS lesson delivery to a real class;
- roster snapshot into `student_lesson_work`;
- student submission;
- teacher review and feedback;
- reviewed qualitative work becomes governed `student_evidence`;
- Student and Leadership surfaces consume the resulting shared learning state.

This synchronization implementation has not yet completed founder browser acceptance with distinct real Leader, Teacher and Student accounts.

### 6. Mastery and next-learning

Implemented foundation:

- `learning_objective_nodes`;
- `mastery_events`;
- `learner_mastery`;
- evidence-confidence handling;
- student objective states;
- intervention/mastery/baseline-aware Next Best Learning Action;
- leadership mastery aggregation.

### 7. Curriculum Intelligence and Lagos scheme ingestion

Implemented database foundation:

- curriculum source registry;
- versioned curriculum frameworks;
- canonical curriculum nodes and prerequisites;
- KSI-objective ↔ curriculum alignment entities;
- workspace curriculum adoption;
- governed Lagos scheme document/batch/entry ingestion;
- platform-admin review and explicit promotion workflow.

Current protected production baseline:

- `2,957` scheme entries total;
- `2,957` pending review;
- `0` approved;
- `0` rejected;
- `0` promoted;
- `0` canonical curriculum nodes;
- `0` scheme-entry node links;
- mixed IRS source remains quarantined with zero staged rows.

Approval and promotion remain separate human actions. Nothing is automatically promoted.

## Consolidation correction

PR #11 originally carried repository migrations `026–055`. PR #12 independently used repository migration number `026` for the Stage 12 review-console hardening.

The consolidation branch resolves that collision by storing the exact review-console hardening SQL as:

`056_stage12_review_console_hardening.sql`

The same SQL is already applied to the dedicated KSI Supabase project under the live migration-history name `stage12_review_console_hardening`. Consolidation does not re-run it or mutate production curriculum data.

## Live Supabase state at consolidation audit

Read-only audit confirmed:

- one school workspace: KAEC Nigerian Schools — `active`;
- active membership roles currently present in live data: owner only;
- student accounts: `0`;
- lesson deliveries: `0`;
- student lesson-work rows: `0`;
- learning-objective nodes: `10`;
- learner-mastery rows: `10`;
- mastery events: `20`;
- RLS enabled on the checked KSI 2.0 access, student, synchronization, mastery and curriculum tables.

Therefore the architecture exists, but the multi-role live acceptance loop remains an open gate.

## Engineering verification

The first PR #13 consolidation head passed GitHub CI:

- dependency installation: PASS;
- lint: PASS;
- strict TypeScript: PASS;
- constitutional/structural verification: PASS;
- production build: PASS;
- high-severity dependency audit: PASS.

PR #13 also carries the NanoID `3.3.18` patched resolution and a permanent KSI 2.0 structural verifier. A final exact-head CI run is required after this project-state update.

## Remaining acceptance gate before merge/release

Do not declare KSI 2.0 accepted until one controlled browser/runtime proof demonstrates the synchronized role path:

**Platform Admin → School Owner/Admin → Leader → Teacher → Student**

Required proof includes:

1. pause and reactivate a test school state without data loss;
2. issue/redeem a Student Access Code;
3. verify student cannot access another learner;
4. verify leader sees permitted learning intelligence only;
5. teacher delivers an approved HQLS lesson through the real teaching map;
6. Student KSI receives the learning resource;
7. student submits reflection/real-life work;
8. teacher reviews the work;
9. reviewed evidence enters the shared learning record;
10. Student mastery/next-learning and Leadership intelligence update from the same evidence.

This runtime proof requires a deliberate acceptance deployment and distinct test-role identities. It has not been performed from the consolidated branch yet.

## Next product work after consolidation acceptance

Build Student and Leadership forward in parallel on the same data model:

- Student: Ask KSI, curriculum-generated learning-resource engine, persistent personalized learning plan;
- Leadership: real curriculum coverage by class/subject/term/week/topic and stronger learning-risk signals;
- Shared: human review/promotion of scheme entries and verified curriculum-objective alignment;
- Parent layer remains later;
- commercial multi-school onboarding follows the same platform-controlled school access model.

## Release control

PR #13 remains draft and unmerged until explicit founder release approval. Ordinary consolidation work must not consume Vercel preview quota. Use one deliberate acceptance deployment only when the exact code head is green and founder authorises the runtime acceptance step.
