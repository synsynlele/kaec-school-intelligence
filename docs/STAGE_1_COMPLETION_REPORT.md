# KAEC School Intelligence — Stage 1 Completion Report

Date: 7 August 2026  
Stage: **1 — Platform Foundation**  
Status: **ENGINEERING COMPLETE / EXTERNAL ACCEPTANCE DEFERRED**  
Repository: `synsynlele/kaec-school-intelligence`  
Branch: `stage-1-platform-foundation`  
PR: `#1 — Stage 1 — Platform Foundation`  
Base: `main` @ `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`

## 1. Executive result

Stage 1 successfully converts the approved KAEC School Intelligence Product Constitution into a secure, durable platform foundation for the three Version 1 engines:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

The platform now has one workspace/tenant model, one constitutional HQLS domain model, one evidence graph, one resource-isolation model, one artifact-versioning primitive and one audited diagnosis lifecycle.

No final AI generator has been built in Stage 1.

The engineering foundation is complete. Two external provider paths remain acceptance-deferred:

- Supabase email/password smoke is currently blocked by the provider's email-delivery rate limit;
- direct protected Vercel Preview health inspection is blocked by Preview Protection plus lack of connector access to the owning Vercel team.

Neither constraint is being bypassed by weakening security.

## 2. Product boundary preserved

Stage 1 did not expand KSI into a generic school-management system.

Not added:

- fees/accounting
- attendance
- payroll/HR
- admissions
- transport
- timetabling
- parent messaging/portal
- student portal
- PipuPath integration
- full observation/certification/operations products
- final AI generation prompts

The governing loop remains:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

## 3. Repository governance completed

The branch contains:

- approved `docs/PRODUCT_CONSTITUTION.md`
- `AGENTS.md` constitutional and Next.js 16 engineering guardrails
- `PROJECT_STATE.md`
- `docs/STAGE_1_PLATFORM_FOUNDATION.md`
- `docs/STAGE_1_RUNTIME_VERIFICATION.md`
- permanent CI workflow
- protection-aware Preview health smoke

The codebase now has a single canonical responsibility for each core concern rather than parallel/competing implementations.

## 4. Dedicated backend created

Dedicated Supabase project:

- name: `kaec-school-intelligence`
- ref: `zaoxfjbiizargeclnzmo`
- region: `eu-west-1`
- API URL: `https://zaoxfjbiizargeclnzmo.supabase.co`

No KSI migration was applied to `pipupath-staging`.

## 5. Database foundation completed

Stage 1 created 18 public product tables covering:

- profiles
- workspaces
- workspace membership
- subjects
- classes
- students
- resources
- lessons
- lesson stages
- HQLS fidelity checks
- assessments
- assessment items
- student evidence
- diagnoses
- artifact versions
- artifact/resource provenance
- AI-run provenance
- generation feedback

All public product tables have RLS enabled.

### Applied migration source files

1. `001_stage1_platform_foundation.sql`
2. `002_stage1_security_performance_hardening.sql`
3. `003_stage1_tenant_integrity.sql`
4. `004_stage1_school_workspace_bootstrap.sql`
5. `005_stage1_private_resource_storage.sql`
6. `006_stage1_resource_storage_integrity.sql`
7. `007_stage1_artifact_version_rpc.sql`
8. `008_stage1_hqls_lesson_structure.sql`
9. `009_stage1_diagnosis_review_integrity.sql`
10. `010_stage1_role_provenance_hardening.sql`
11. `011_stage1_diagnosis_rpc_hardening.sql`

Remote history contains an extra repeated application of the idempotent diagnosis RPC hardening operation. The repository intentionally contains only one `011` source file. This discrepancy is documented rather than concealed.

## 6. Tenant security completed

Stage 1 enforces workspace isolation through both RLS and relational constraints.

Verified protections include:

- foreign records cannot be linked into another workspace through class, subject, lesson, assessment, evidence, diagnosis or resource relationships;
- `workspace_id` cannot be silently moved after creation;
- creator/recorder provenance cannot be silently rewritten;
- every workspace retains at least one active owner;
- a user's default workspace must be a workspace they are authorised to use;
- school roster/configuration mutation is restricted to owner/admin;
- lesson/assessment creation is bound to authenticated creator identity;
- student evidence is bound to authenticated recorder identity;
- HQLS fidelity history is append-oriented;
- resource metadata and object paths are workspace-scoped.

### Live RLS evidence

Using isolated synthetic authenticated JWT claims against the dedicated KSI database:

- User A saw Workspace A but not Workspace B;
- User A saw Lesson A but not Lesson B;
- a teacher in Workspace A saw a workspace-visible resource;
- the same teacher could not see the owner's private resource;
- User A could not mutate a foreign-workspace lesson.

Fixtures were cleaned/rolled back after testing.

## 7. Auth-user bootstrap completed and verified at database level

The new-auth-user trigger creates:

1. `profiles` record
2. private individual workspace
3. active owner membership
4. `default_workspace_id` link

A rollback-only insertion into `auth.users` verified all four outcomes as PASS.

External email/password session creation remains deferred because the live Supabase Auth provider returned `email rate limit exceeded` before a test account could be established.

Anonymous Auth was tested as an alternative non-email acceptance route and correctly returned `Anonymous sign-ins are disabled`. That project security setting was not changed merely for testing.

## 8. Constitutional HQLS persistence completed

The HQLS domain model has one canonical TypeScript source under `lib/domain/hqls.ts`.

The database enforces the seven-stage mapping:

1. `awakening`
2. `exploration`
3. `micro_illumination`
4. `trial_first`
5. `full_illumination`
6. `trial_second`
7. `integration`

`create_hqls_lesson_draft(...)` atomically creates a lesson with all seven stage rows.

A rollback-only live database test proved:

- stage count = 7
- exact constitutional ordering = PASS

This prevents a future AI engine from persisting a partial or scrambled HQLS lesson skeleton as canonical output.

## 9. Assessment/evidence foundation completed

The platform persists assessments independently from raw generated prose.

Assessment data supports:

- source lesson linkage
- class/subject linkage
- blueprint metadata
- item position/type
- KAEC critical-thinking experience type
- topic/objective
- difficulty
- marks
- content
- answer key
- marking guide
- evidence metadata

Student evidence is a separate first-class entity, enabling future diagnosis to distinguish observed evidence from AI interpretation.

## 10. Diagnosis governance completed

Diagnosis lifecycle is:

`draft → reviewed → final → archived`

High-consequence controls are enforced at the database level:

- browser clients cannot directly assign reviewer/finaliser identity;
- `review_diagnosis(...)` stamps `auth.uid()` as reviewer;
- finalisation requires prior review;
- only owner/admin may finalise;
- `finalise_diagnosis(...)` stamps `auth.uid()` as finaliser.

### Live diagnosis integrity evidence

Rollback-only live tests all passed:

- teacher cannot finalise before review;
- teacher cannot forge review/final lifecycle columns;
- authenticated reviewer identity is stamped correctly;
- teacher cannot finalise a reviewed diagnosis;
- owner can finalise after review;
- finaliser identity is stamped correctly.

The public RPC surface uses SECURITY INVOKER wrappers over private privileged logic, preserving both PostgREST usability and least-privilege behaviour.

## 11. Artifact versioning and AI provenance completed

Stage 1 provides one shared artifact-history primitive:

`append_artifact_version(...)`

It supports:

- lesson versions
- assessment versions
- diagnosis versions
- generated/manual/regenerated/review/finalisation origins
- engine version
- prompt version
- actor identity
- immutable snapshots

`ai_runs` separately records provider/model/engine/prompt provenance, input summaries, status and failures.

This prevents future engines from inventing incompatible audit/history behaviours.

## 12. Private resource foundation completed

Private bucket:

`ksi-resources`

Verified configuration:

- public access disabled
- 20 MB maximum object size
- supported school document/image MIME allowlist
- storage path contract: `<workspace>/<creator>/<unique-name>`
- matching authorised `resources` metadata row required before upload
- workspace-visible resources available to authorised workspace users
- private resources creator-only
- authorised deletion only

Client service:

`lib/resources/storage.ts`

Workspace UI:

`/resources`

A signed-session browser upload/download round trip is deferred with the external Auth session smoke; the storage bucket, policy and metadata invariants are already live and advisor-clean.

## 13. Academic context foundation completed

Route:

`/setup`

Reusable workspace context now includes:

- subjects
- classes
- students

Owner/admin may mutate setup data. Teachers remain read-only for structural school configuration.

This removes repeated manual context entry from future Lesson, Assessment and Diagnosis workflows.

## 14. Authentication/workspace UI completed

Implemented:

- email/password sign-up
- email/password sign-in
- sign-out
- authenticated dashboard
- workspace switching
- school workspace creation
- active workspace counts
- setup route
- resources route

The UI foundation remains intentionally light; final AI engine interfaces are not part of Stage 1.

## 15. Type contract completed

Canonical architecture:

- `lib/domain/*` — product vocabulary/invariants
- `lib/data/*` — artifact/evidence/AI-run persistence
- `lib/resources/storage.ts` — resource storage
- `lib/supabase/client.ts` — typed browser client
- `lib/supabase/database.types.ts` — generated table/schema snapshot
- `lib/supabase/database.ts` — verified final RPC overlay

Final live RPC contract includes:

- `append_artifact_version(...)`
- `create_hqls_lesson_draft(...)`
- `review_diagnosis(...)`
- `finalise_diagnosis(...)`

The combined contract passes strict TypeScript.

## 16. Build, dependency and CI gates passed

The inherited dependency graph was hardened to:

- Next.js `16.3.0`
- Tailwind CSS `4.3.3`
- eslint-config-next `16.3.0`

Permanent KSI CI validates:

- `npm ci`
- lint
- strict TypeScript
- constitutional structure
- production build
- `npm audit --audit-level=high`

At branch head `05a3f75292e70a762baf520ef6a162fc269f47c5` immediately before completion documentation was committed, every permanent CI step passed.

A final exact-head run is required after this report commit and is recorded below before Stage 1 merge approval.

## 17. Supabase advisor gate passed

Latest verified advisor state before completion-document commits:

- Security advisor: **0 findings**
- Performance advisor: no warning-level findings; only `unused_index` informational notices on the new/mostly empty database

Unused-index INFO notices are intentionally not removed at this stage because the schema has not yet accumulated production workload from the three engines; premature index removal would be speculation rather than optimization.

## 18. Vercel deployment state

GitHub/Vercel integration successfully builds Stage 1 Preview deployments.

Known deployment surfaces:

- production alias: `https://kaec-school-intelligence.vercel.app`
- Stage 1 Preview: `https://kaec-school-intelligence-git-s-4f5a8d-synsynlele-3991s-projects.vercel.app`

The Preview is protected by Vercel Authentication.

The protection-aware smoke passes by correctly detecting the Vercel authentication redirect rather than pretending it reached the KSI health route.

Direct health JSON inspection remains deferred because:

- Preview Protection blocks anonymous access;
- the available Vercel connector is authenticated to a different Vercel team than the team owning KSI.

Preview Protection is intentionally not disabled just for CI.

## 19. External acceptance items deferred

These are acceptance-path checks, not unresolved architecture defects:

1. real email/password sign-up/sign-in/sign-out after Supabase's email-rate-limit window clears;
2. two real signed user sessions repeating tenant isolation through the public API;
3. real signed-session school workspace create/switch flow;
4. real signed-session private resource upload/download round trip;
5. direct protected Preview `/api/health` response using authorised Preview access.

The database, RLS, trigger, storage-policy and diagnosis-authority invariants beneath these paths have already been directly verified.

## 20. Stage 1 disposition

**Engineering disposition: PASS.**

**External provider acceptance: DEFERRED, not failed.**

Stage 1 is ready for founder review and merge approval once the final exact-head CI/advisor/deployment checks remain green.

Do not add final AI-engine code to the Stage 1 branch.

After merge, the next stage should be:

**Stage 2 — HQLS Lesson Intelligence**

That stage should consume this foundation rather than alter the constitutional platform boundary.

## 21. Final exact-head verification

This section must be updated after the completion-report/state commits settle on one branch head.

Required final proof:

- exact branch head SHA
- KSI CI: PASS
- Vercel deployment/build status: PASS
- Preview protection-aware smoke: PASS
- Supabase security advisor: 0 findings
- Supabase performance advisor: no warning-level findings
- PR mergeability: PASS
- PR remains unmerged until explicit approval
