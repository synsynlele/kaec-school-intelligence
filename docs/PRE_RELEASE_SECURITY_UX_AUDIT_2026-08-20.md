# KSI Pre-Release Security & UX Audit — 20 August 2026

## Release purpose

This pass closes founder-reported issues before the next production release:

1. Personal/individual workspaces were still created automatically and their `owner` membership could be interpreted by the UI as School Owner/Admin authority.
2. The desktop product felt too vertically stacked and did not read like a coherent school operating workspace.
3. Generated outputs needed consistent, obvious download actions.
4. Full Illumination needed to behave as a normal, unrestricted lesson-teaching section.
5. Active Teacher and Leadership pages needed a final role, navigation, layout and lifecycle audit before release.

## 1. Personal workspace / permission finding

### Root cause

The original account bootstrap function `private.handle_new_user()` created an `individual` workspace for every new account, made that account `owner`, and set that workspace as the profile default.

The school product later reused the generic roles `owner`, `admin`, `leader` and `teacher`. Some UI checks therefore treated `owner` as School Owner even when the active workspace was an `individual` workspace.

### What this did and did not mean

The individual workspace did **not** make a teacher Owner/Admin of the school workspace. School membership remained isolated by `workspace_id`. The defect was that the personal workspace behaved like a miniature administrative KSI environment and could be mistaken for school authority or used as an unintended non-school product context.

### Live audit before correction

- 5 individual workspaces, all with an active `owner` membership.
- 4 school workspaces.
- Active school membership set included school owners, one teacher and one student.
- Individual workspaces contained 4 legacy HQLS lessons, 0 assessments and 0 diagnoses.
- Legacy personal data therefore has to be preserved rather than deleted.

### Correction — Migration 069 (requires explicit migration approval)

`069_school_context_only_access.sql`:

- stops automatic personal workspace creation for new users;
- keeps profile creation on account bootstrap;
- changes `private.has_active_workspace_membership`, `private.is_workspace_member` and `private.has_workspace_role` so operational KSI authority requires `workspace_type = 'school'` and active school access;
- disables existing individual workspaces without deleting them or their artifacts;
- moves profile defaults from individual workspaces to an active school membership where one exists, otherwise to no default workspace;
- asserts that no profile remains defaulted to an individual workspace.

Result: KSI becomes a school-scoped product at both the UX and RLS authority boundaries. Personal workspaces remain preserved legacy containers only.

## 2. Application school-context gate

A new `KsiSchoolShell` sits around protected Teacher/Leadership product pages.

It:

- authenticates the user;
- resolves active memberships;
- permits protected KSI work only in an active `school` workspace;
- automatically moves an old personal default to an active school membership when one exists;
- otherwise presents the governed Staff Access / School Owner access choices;
- prevents protected workflow clients from rendering while workspace authority is unresolved;
- leaves platform-admin and entry/onboarding surfaces outside the school-context gate where necessary.

This is defense-in-depth in addition to Migration 069.

## 3. Dashboard correction

The previous dashboard mixed workspace type and role semantics. The release uses a new school-only dashboard.

Key changes:

- individual workspaces are not shown in the workspace selector;
- only active school memberships can become the active dashboard context;
- School Owner/Admin controls are derived from the role **after** school context is established;
- role identity is displayed explicitly as School Owner, School Admin, School Leader or Teacher;
- quick metrics show current HQLS, Assessment, Diagnosis and Intervention workload;
- Teacher workflow and Leadership workflow are presented as coherent groups instead of an unstructured list;
- school administration appears only for School Owner/Admin;
- the interface explicitly states that personal workspaces do not confer school administration rights.

## 4. Navigation and visual structure

### Desktop

The old global navigation was essentially a mobile bottom bar on every screen. The new desktop experience uses a persistent left workspace sidebar with grouped navigation:

- Teacher workspace / Teaching workflow;
- Leadership workspace / Learning intelligence;
- School administration when authorised.

The current school and school role are visible in the sidebar, reducing workspace/permission ambiguity.

### Mobile

Mobile retains the compact bottom navigation pattern because it is appropriate to small screens. Existing product-wide mobile containment rules remain.

### Layout consequence

On desktop the app now behaves like a workspace/OS rather than a collection of vertically stacked web pages. Content occupies the main document area while navigation remains stable at the side.

## 5. HQLS Full Illumination

Stage 5 remains after Trial 1, but its teaching style is unrestricted.

Full Illumination may use normal conventional teaching and should provide:

- the actual subject explanation;
- detailed teacher lesson note;
- definitions and key terms;
- concepts and sub-concepts;
- formulas, rules, laws, principles and procedures where relevant;
- demonstrations and worked examples;
- board/note-ready content;
- direct misconception correction;
- questions and answers;
- real-life applications where useful;
- textbook-style explanation when that is the best way to teach the subject.

It is no longer constrained by the learner-led/anti-lecture rules that govern the earlier discovery stages.

### Result-page presentation

The HQLS result is now styled as a teacher lesson document:

- Stages 1–4 and 6–7 form a compact two-column teaching flow on suitable desktop widths.
- Stage 5 Full Illumination spans the full document width and receives the strongest reading hierarchy because it carries the complete normal lesson explanation and note.
- Mobile remains single-column and readable.

## 6. Download/export audit

### HQLS

- PDF backend: active.
- Direct `Download Lesson PDF` on the lesson result: added.
- Export remains limited to saved HQLS-validated lessons.
- Existing Lesson PDFs library remains available.

### Assessment

- Existing `Download PDF`: verified active.
- Export remains limited to validated assessments.
- No assessment export rule weakened.

### Diagnosis

- Existing `Download Parent PDF`: verified active.
- Available only after human review/final approval, and retained for archived final diagnoses.
- Draft/reviewed diagnoses are intentionally not exported as final parent reports.

### Intervention

- Previously had no PDF export.
- Added a KAEC-branded Intervention Plan PDF, authenticated route and `Download Intervention PDF` action.
- Available after confirmation and while archived.
- Draft interventions cannot be exported as final plans.

### Saved Work

- Continues to govern HQLS and Assessment archive/restore/delete lifecycle.
- Clear navigation to Lesson PDF exports is now present.

## 7. Active route audit

### Teacher / shared workflow

- `/dashboard` — school-only structured home.
- `/teacher/resources` — Academic Resources / Scheme → HQLS handoff.
- `/hqls` and `/hqls/result` — generation, saved result, direct PDF.
- `/assessment` and `/assessment/result` — assessment generation/result/PDF.
- `/diagnosis` and `/diagnosis/result` — evidence-led diagnosis, review/finalisation/PDF.
- `/interventions` and `/interventions/result` — follow-through and confirmed-plan PDF.
- `/saved-work` — governed saved artifact lifecycle.

### Leadership / administration

- `/leadership` — learning health and intelligence.
- `/setup` — school academic setup.
- `/setup/teaching-map` — governed Teacher ↔ Class ↔ Subject mapping.
- `/setup/staff-access` — governed staff access.
- `/setup/curriculum` — curriculum/coverage context.

### Platform governance

- `/admin/schools` — platform school access control.
- `/setup/curriculum/schemes` and curriculum review/factory surfaces — platform curriculum governance, kept separate from everyday school navigation.

### Retired legacy surface

Student-facing KSI routes remain retired/redirected and the Student Ask API remains unavailable. This pass does not reactivate them.

## 8. Security boundaries retained

This release does not:

- expose a service-role key to the browser;
- weaken school RLS;
- bypass human Diagnosis approval;
- auto-promote curriculum rows;
- reactivate Student KSI;
- delete legacy personal workspaces or their artifacts;
- change curriculum source-review governance.

The 2,957 scheme rows remain under the existing Pending / human-review / zero-auto-promotion governance boundary.

## 9. Release gates

Before production release:

1. Exact-head lint must pass.
2. Strict TypeScript must pass.
3. Constitutional and pre-release structural verification must pass.
4. Production build must pass.
5. Dependency audit must pass.
6. Migration 069 must receive explicit founder approval before it is applied.
7. After migration acceptance, PR #16 may be merged using its exact verified head.
8. Production deployment must become READY and the live domains must be smoke-checked.
9. Production runtime logs must show no new error cluster.

Production release is not complete until all nine gates are satisfied.
