# KAEC School Intelligence — Project State

Updated: 17 August 2026

## Production baseline

KSI 2.0 remains released on production `main` at:

- commit: `974eab88965d3b6549fa478c5341863e9155d9bd`;
- production domains: `www.ksi.name.ng` and `ksi.name.ng`;
- production deployment: `dpl_H8GNHMgLXFiEnFSKirsmV6KJqS3V`.

The production application code baseline remains unchanged while Stage 16 is reviewed.

## Current development checkpoint

**Stage 16 — KSI 2.2 Teacher & Leadership Simplification — database recovery complete / source repair pending explicit authorisation**

Authoritative development lineage:

- branch: `stage16-ksi-simplification`;
- draft PR: `#15 — Stage 16 — Simplify KSI around Teacher & Leadership`;
- current Stage 16 head includes migrations 067 and 068;
- Stage 16 CI is green;
- existing acceptance preview remains READY and no additional Vercel deployment was required for database recovery.

Migration `067_stage16_teacher_academic_resources.sql` is applied to the live KSI Supabase project.
Migration `068_stage16_curriculum_governance_recovery.sql` is also applied to the live KSI Supabase project.

No Stage 16 merge to `main`, production application deployment, or scheme-source re-extraction is authorised automatically by this checkpoint.

## KSI 2.2 product direction

The founder-authorised amendment is recorded in:

- `docs/KSI_2_2_SIMPLIFICATION_AMENDMENT.md`.

KSI is deliberately focused around two active product experiences and one governed administration layer:

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

Teacher KSI is intentionally small and task-oriented.

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

The HQLS page accepts the scheme handoff and pre-fills subject, class, topic and objective context without replacing the existing HQLS engine.

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

Former Student KSI routes redirect to a retired-surface notice. Historical learner tables/RPCs remain in place to preserve data integrity and Teacher/Leadership dependencies.

## Scheme-data diagnosis

The live Supabase scheme registry contains 26 registered supplied scheme PDFs and 2,957 staged scheme rows.

The original ingestion was predominantly topic-only extraction. The source PDFs contain richer fields in many cases, so Stage 16 provides a governed source-repair workflow rather than pretending missing data exists.

The mixed/misbundled JSS Islamic Religious Studies source remains quarantined with zero staged rows and must not be automatically repaired or promoted.

## Governance recovery — completed

Authenticated acceptance after migration 067 exposed an important state contradiction: all 2,957 supplied scheme rows had been bulk-approved/promoted during an earlier review-console operation, contrary to the agreed Pending-review / zero-auto-promotion boundary.

A dependency audit confirmed that the promotion-created `state_scheme` curriculum graph had no references from learning resources, objective links, student learning plans or curriculum prerequisites.

Migration `068_stage16_curriculum_governance_recovery.sql` was therefore founder-authorised and applied on 17 August 2026.

Live post-migration verification is exact:

- total scheme rows: **2,957**;
- Pending: **2,957**;
- Approved: **0**;
- Rejected: **0**;
- Promoted: **0**;
- Reviewed: **0**;
- scheme-entry graph links: **0**;
- promotion-created `state_scheme` curriculum nodes: **0**;
- valid non-quarantined source documents staged: **25**;
- quarantined IRS source: **1**, still registered/quarantined and untouched.

Permanent database controls now include:

- a human review note is mandatory before approving or rejecting a scheme row;
- bulk review is capped at 50 visible rows per operation;
- bulk curriculum promotion is disabled;
- single-row promotion remains separate and requires approved state plus recorded reviewer, review timestamp and human review note;
- promoted rows are protected from legacy update/upsert mutation paths.

Direct authenticated guard tests passed after migration:

- review without a human note: BLOCKED;
- bulk promotion: BLOCKED.

Migration history records:

- `stage16_teacher_academic_resources`;
- `stage16_curriculum_governance_recovery`.

## Stage 16 scheme repair readiness

The governance recovery has removed the reviewed/promoted replacement blocker from every valid staged class slice.

Live readiness audit shows **0 repair blockers** across all non-quarantined classes represented by the 25 valid source documents.

The next source-repair workflow remains:

1. upload the exact matching registered source PDF;
2. run one source-faithful extraction pass per class, covering all terms present in that class;
3. replace only that class's current Pending extraction transactionally;
4. keep every repaired row Pending;
5. compare extraction completeness and source fidelity;
6. only then begin human curriculum review;
7. promotion, if ever desired, remains a separate one-row governed action.

No source PDF re-extraction has been started yet after migration 068.

## Engineering / operational gate

- Stage 16 PR #15 remains a draft.
- Current Stage 16 CI is green.
- No new Vercel deployment was spent for migrations 067 or 068.
- Existing broader Supabase advisor notices remain a separate hardening backlog; Stage 16 recovery did not broaden scope into unrelated RLS/index/security-definer refactors.

## Remaining Stage 16 gates

1. Obtain explicit authorisation before production scheme-source re-extraction.
2. Repair the 25 non-quarantined source PDFs through the source-faithful class-level workflow.
3. Validate extraction completeness against source material before any human curriculum review.
4. Keep the quarantined IRS source blocked until a correct source is supplied.
5. Final browser acceptance of Teacher and Leadership navigation.
6. Only after explicit founder release authorisation: merge PR #15 to `main` and release production.

## Permanent governance reminders

- Do not auto-promote curriculum.
- Do not represent supplied scheme copies as independently verified official curriculum unless separately verified.
- Do not weaken RLS or approval rules to make acceptance pass.
- Do not expose Supabase service-role credentials to browser code.
- Do not delete learner records merely because Student KSI is retired.
- Do not merge to `main` or deploy production without explicit release authorisation.
- Strict commercial subscription/entitlement gating remains a separate business-control layer.
