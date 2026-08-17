# KAEC School Intelligence — Project State

Updated: 17 August 2026

## Production baseline

KSI 2.0 is released on production `main` at:

- commit: `974eab88965d3b6549fa478c5341863e9155d9bd`;
- production domains: `www.ksi.name.ng` and `ksi.name.ng`;
- production deployment: `dpl_H8GNHMgLXFiEnFSKirsmV6KJqS3V`.

The production baseline remains unchanged while Stage 16 is reviewed.

## Current development checkpoint

**Stage 16 — KSI 2.2 Teacher & Leadership Simplification — release candidate / live migration acceptance pending**

Authoritative development lineage:

- branch: `stage16-ksi-simplification`;
- draft PR: `#15 — Stage 16 — Simplify KSI around Teacher & Leadership`;
- exact green head: `e0acab9b49e3e8e2b3751b57d5219e376c952cf5`;
- exact-tree acceptance preview trigger: `034323fd613b3a2d57997235feabb9bdc321daca`;
- preview deployment: `dpl_HmS4sTWATsuooGjYvw29ADayzsvV`;
- preview state: READY;
- preview tree differs from the green Stage 16 head by zero files.

Migration `067_stage16_teacher_academic_resources.sql` is committed in the release candidate but is **not applied to production Supabase yet**.

No Stage 16 merge to `main`, production deployment, migration application or scheme-data repair is authorised automatically by this checkpoint.

## KSI 2.2 product direction

The founder-authorised amendment is recorded in:

- `docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md`.

KSI is now deliberately focused around two active product experiences and one governed administration layer:

1. **Teacher KSI** — plan, teach, assess, diagnose and intervene.
2. **Leadership KSI** — understand learning health, curriculum coverage, intervention and improvement signals.
3. **Owner / Administration** — school access, people, teaching assignments and setup required to operate Teacher and Leadership KSI.

The Student-facing KSI application surface is retired. This does **not** delete students or learner data. Student records, lesson evidence, assessments, diagnoses, interventions and mastery remain governed domain data because Teacher and Leadership intelligence depend on them.

The active adult-operated learning loop is:

**Academic Resource / Scheme → HQLS Lesson → Delivery & Evidence → Assessment → Diagnosis → Intervention → Next HQLS Lesson → Leadership Learning Signal**

The constitutional intelligence engines remain exactly:

1. HQLS Lesson Intelligence;
2. Assessment Intelligence;
3. Student Diagnosis Intelligence.

Stage 16 creates no fourth authoritative intelligence engine.

## Teacher experience — implemented in Stage 16

Teacher KSI is now intentionally small and task-oriented.

Primary destinations:

- Home;
- Academic Resources;
- HQLS Lessons;
- Assessments;
- Diagnosis & Intervention;
- Saved Work.

Persistent Teacher navigation is mounted across the application so teachers do not have to return to a feature directory after every task.

### Academic Resources

New Teacher route:

- `/teacher/resources`.

It provides:

- Scheme of Work navigation through **Class → Subject → Term → Week → Topic**;
- learning objectives when present;
- learning activities when present;
- embedded core skills when present;
- learning resources when present;
- explicit source/provenance context;
- extraction-completeness visibility instead of pretending missing fields exist;
- direct **Create HQLS lesson** handoff from a weekly scheme row;
- school-uploaded curriculum, notes and reference material through the same Teacher workspace.

The HQLS page now accepts the scheme handoff and pre-fills subject, class, topic and objective context without replacing the existing HQLS engine.

## Leadership / Owner experience — implemented in Stage 16

Leadership home is focused on decisions rather than modules:

- Learning Health;
- Curriculum & Coverage;
- Intervention Follow-through;
- Academic Resources / teaching context.

Owners/Admins additionally receive:

- Classes, Subjects & Student records;
- Teaching Assignments;
- Staff Access.

Platform governance remains separately gated by `state.isPlatformAdmin`.

## Student-facing retirement — implemented in Stage 16

Active sign-in choices are now only:

- School Owner;
- Teacher / Staff.

Teacher / Staff is the entry path for Teacher, Leader and Admin accounts; the school-issued Staff Access Code determines the actual governed role.

Former Student KSI routes redirect to a retired-surface notice:

- `/student`;
- `/student/join`;
- `/student/learning`;
- `/student/mastery`;
- `/student/plan`;
- `/student/ask`.

The former Student Ask API returns HTTP 410 and performs no AI generation or tutor-turn writes.

`/setup/student-access` is retired from active school administration and redirects to `/setup`.

Historical learner tables/RPCs remain in place to preserve data integrity and Teacher/Leadership dependencies.

## Scheme-data diagnosis

The live Supabase scheme registry contains 26 registered supplied scheme PDFs and 2,957 staged scheme rows.

Read-only live audit found:

- total scheme rows: `2,957`;
- rows with topic: `2,957`;
- rows with learning objectives: `220`;
- rows with learning activities: `0`;
- rows with embedded core skills: `0`;
- rows with learning resources: `0`;
- rows with source reference: `2,641`;
- rows with source page: `1,055`.

Therefore the schemes are not empty. The original ingestion was predominantly **topic-only extraction**, which is why the product looked empty when richer fields were displayed.

Original supplied PDFs inspected from the user's File Library contain the richer source columns, confirming that the missing fields are an extraction defect rather than absent source material.

The mixed/misbundled JSS Islamic Religious Studies source remains quarantined and has zero staged rows. It must not be automatically repaired or promoted.

## Stage 16 scheme repair design

Migration `067_stage16_teacher_academic_resources.sql` adds two governed RPCs:

### `get_academic_resource_catalog(...)`

- authenticated only;
- active school only;
- roles: owner/admin/leader/teacher;
- Student role excluded;
- quarantined documents excluded from Teacher catalog;
- rejected rows excluded;
- read-only teaching reference access;
- no curriculum-review or promotion authority granted to teachers.

### `replace_scheme_class_extraction(...)`

Designed for KAEC platform curriculum administrators only.

Source-repair boundary:

- one AI extraction pass per class, covering all three terms present in the source;
- a normal JSS1-3 or SS1-3 PDF therefore needs three AI extraction calls instead of nine class/term calls;
- exact registered source filename required by the repair API;
- source PDF maximum 20 MB;
- AI is instructed to transcribe faithfully and never invent blank cells, rows or terms;
- extraction is not approval;
- all repaired rows return to `pending` review;
- no review RPC is called by repair;
- no promotion RPC is called by repair;
- quarantined sources are blocked;
- any reviewed or promoted row in a class blocks replacement of that class before deletion;
- class replacement is transactional;
- normalized keys include class, term, week, component and topic to protect multi-component weekly rows.

The original supplied PDFs are not stored in Supabase Storage. The repair console therefore requires the curriculum administrator to upload the exact matching registered PDF when repairing a source.

## Engineering gate

Exact Stage 16 head `e0acab9b49e3e8e2b3751b57d5219e376c952cf5` passed GitHub Actions run `32028893816` / job `95384166300`:

- dependency install: PASS;
- lint: PASS with **9 warnings, 0 errors**;
- strict TypeScript: PASS;
- Stage 2–6 structure verification: PASS;
- KSI 2.0 foundation verification: PASS;
- KSI 2.1 compatibility verification: PASS;
- Stage 12 curriculum governance verification: PASS;
- Stage 14 access-security verification: PASS;
- Stage 15 owner/staff onboarding verification: PASS;
- Stage 16 simplification verification: PASS;
- V1 stability verification: PASS;
- production build: PASS;
- generated application routes: `55`;
- dependency audit: `0 vulnerabilities`.

Seven lint warnings are inherited from the accepted production baseline. Stage 16 currently adds two non-blocking warnings: one Next navigation warning on sign-out and one unused verifier import. These are source-hygiene items, not runtime or security failures.

## Acceptance preview

Controlled preview:

- deployment: `dpl_HmS4sTWATsuooGjYvw29ADayzsvV`;
- state: READY;
- branch: `stage16-ksi-simplification-preview`;
- trigger commit: `034323fd613b3a2d57997235feabb9bdc321daca`;
- trigger commit has zero file differences from the exact green Stage 16 head.

Build completed successfully and includes:

- `/teacher/resources`;
- `/api/curriculum/scheme-repair`;
- simplified `/sign-in`;
- retired Student routes;
- existing Teacher/Leadership/core V1 routes.

Live preview fetch of `/sign-in` returned HTTP 200 and visibly confirmed only the School Owner and Teacher / Staff entry choices.

The new Academic Resources runtime cannot be fully accepted until migration 067 exists in the connected Supabase project.

## Remaining Stage 16 gates

1. Obtain explicit approval to apply migration `067_stage16_teacher_academic_resources.sql` to the live KSI Supabase project.
2. Apply migration 067 with the governed migration tool.
3. Run authenticated runtime acceptance of Academic Resources and repair safeguards without re-extracting production scheme data.
4. Obtain separate explicit approval before any production scheme-row re-extraction.
5. Repair non-quarantined source PDFs through the source-faithful repair workflow.
6. Validate extraction completeness against source material before any human curriculum review/promotion.
7. Final browser acceptance of Teacher and Leadership navigation.
8. Only after explicit founder release authorisation: merge PR #15 to `main` and release production.

## Permanent governance reminders

- Do not auto-promote curriculum.
- Do not represent supplied scheme copies as independently verified official curriculum unless separately verified.
- Do not weaken RLS or approval rules to make acceptance pass.
- Do not expose Supabase service-role credentials to browser code.
- Do not delete learner records merely because Student KSI is retired.
- Do not merge to `main` or deploy production without explicit release authorisation.
- Strict commercial subscription/entitlement gating is still a separate future business-control layer; school access is governed, but private individual workspaces are not yet fully subscription-locked.
