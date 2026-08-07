# KAEC School Intelligence — Project State

Updated: 7 August 2026

## Current stage

**Stage 1 — Platform Foundation: IN PROGRESS / RUNTIME RELEASE GATES**

Stage 0 Product Constitution v1.1 is approved and frozen.

## Repository

- GitHub: `synsynlele/kaec-school-intelligence`
- Default branch: `main`
- Stage 1 branch: `stage-1-platform-foundation`
- Draft PR: `#1 — Stage 1 — Platform Foundation`
- Stage 1 base commit: `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`
- Latest exact verified head at this update: `cd6d22b7a4688da060b8e17c8b31567a5dd4c3c5`

## Verified stack

- Next.js `16.3.0`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `4.3.3`
- `@supabase/supabase-js` `^2.108.2`

The dependency security gate was repaired without weakening the audit threshold.

At the exact head recorded above:

- lint passed,
- strict TypeScript passed,
- production build passed,
- `npm audit --audit-level=high` passed,
- Vercel commit status was green.

## Product scope

Version 1 remains locked to:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

plus only the infrastructure necessary for those engines.

The governing product loop is:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

KSI is not a school ERP and Stage 1 does not build the final AI generators.

## Dedicated Supabase environment

- Project: `kaec-school-intelligence`
- Project ref: `zaoxfjbiizargeclnzmo`
- Region: `eu-west-1`
- API URL: `https://zaoxfjbiizargeclnzmo.supabase.co`

`pipupath-staging` remains separate and is not an authorised KSI target.

## Applied Stage 1 migrations

The dedicated KSI project has the following Stage 1 migrations applied:

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

Repository migration numbering is unique and replay-safe.

## Database and tenant architecture

The schema contains 18 public product tables, all with RLS enabled:

- profiles and workspaces
- workspace membership and roles
- subjects, classes and students
- resource metadata
- structured HQLS lessons and lesson stages
- HQLS fidelity checks
- assessments and assessment items
- student evidence
- diagnoses
- artifact versions and resource provenance
- AI-run provenance
- generation feedback

Verified structural guarantees include:

- cross-workspace relationships are blocked by same-workspace constraints,
- workspace IDs and creator/recorder provenance cannot be silently rewritten,
- every workspace must retain at least one active owner,
- a user's default workspace must be one of their active memberships,
- school roster/configuration mutation is restricted to owner/admin roles,
- lesson and assessment creation must preserve authenticated creator identity,
- evidence must preserve authenticated recorder identity,
- HQLS fidelity history is append-only for authenticated users,
- lesson-stage rows cannot be independently deleted by authenticated users,
- final parent-facing diagnosis is protected from ordinary-member mutation,
- diagnosis reviewer/finaliser identity is written by controlled RPCs rather than supplied by the browser.

## Constitutional HQLS persistence

The database enforces the exact stage mapping:

1. Awakening
2. Exploration
3. Micro-Illumination
4. Trial — First Attempt
5. Full Illumination
6. Trial — Second Attempt
7. Integration

`create_hqls_lesson_draft(...)` atomically creates the lesson plus all seven correctly ordered stage rows. A future engine therefore cannot persist a scrambled or partial HQLS skeleton as canonical output.

## Diagnosis integrity

- Browser clients cannot directly write reviewer/finaliser identity fields.
- `review_diagnosis(...)` records the authenticated reviewer.
- `finalise_diagnosis(...)` requires owner/admin role and prior human review.
- Privileged diagnosis mutation lives in the non-exposed `private` schema; public RPCs are SECURITY INVOKER wrappers.
- Latest Supabase security advisor result: **0 findings**.

## Private resource storage

- Private bucket: `ksi-resources`
- Public access: disabled
- Maximum file size: 20 MB
- Paths are workspace/user scoped
- A tracked `resources` metadata row is required before upload
- Private resource visibility is enforced
- Resource object access is workspace isolated
- `lib/resources/storage.ts` is the canonical client storage service

A usable `/resources` workspace UI now exists for curriculum, scheme, notes and reference files. It supports private/workspace visibility, secure upload, download and authorised deletion.

## Academic workspace setup

A usable `/setup` foundation now exists for reusable:

- subjects,
- classes,
- students.

The UI reads the active workspace and membership role. Owner/admin users may manage school configuration; other members remain read-only. This prevents the future three engines from asking users to repeatedly re-enter core school context.

## Canonical application/data architecture

- `lib/domain/*` — authoritative product vocabulary and invariants
- `lib/data/*` — canonical artifact/evidence/AI-run data-access layer
- `lib/resources/storage.ts` — canonical resource storage layer
- `lib/supabase/client.ts` — typed browser client
- `lib/supabase/database.types.ts` — persisted generated schema types
- `lib/supabase/database.ts` — Stage 1 RPC overlay for the final live RPC contract

Duplicate HQLS constants and duplicate persistence-service layers were removed so there is one source of truth per responsibility.

The live RPC signatures for artifact versioning, HQLS lesson bootstrap and diagnosis review/finalisation have been verified against the dedicated database. The final Stage 1 RPC overlay compiles under strict TypeScript. A fresh full generated-type export is still desirable before closure, but the application no longer treats the final RPCs as untyped calls.

## Authentication and workspace UX

Implemented:

- email/password sign-up
- email/password sign-in
- sign-out
- new-auth-user private workspace bootstrap trigger
- authenticated dashboard
- workspace switching
- school workspace creation/bootstrap
- lesson/assessment/diagnosis counts per active workspace
- academic setup route
- private resource library route

### Live Auth test result

A real external signup smoke reached the dedicated KSI Supabase Auth endpoint, but Supabase rejected the attempt with:

`email rate limit exceeded`

No test profile/bootstrap record was created from that attempt. Therefore:

**Real authenticated bootstrap and two-user tenant isolation remain unproven and must not be claimed as passed.**

Retry after the Auth email-delivery rate-limit window clears or through another explicitly approved test-user mechanism.

## Vercel / deployment state

GitHub integration created the KSI Vercel project and Preview deployments build successfully.

The Preview is protected by Vercel Authentication. An unauthenticated CI request to `/api/health` is intercepted by Vercel before the KSI route executes. The protection-aware smoke now correctly classifies this as an external access constraint rather than an application failure.

Therefore the following still requires an authenticated Preview session or an approved project-scoped bypass mechanism:

- prove the deployed Preview environment points to `zaoxfjbiizargeclnzmo.supabase.co`,
- prove the deployed application can reach the dedicated KSI backend.

Do not disable Preview protection merely to make a smoke test green.

## Runtime verification specification

`docs/STAGE_1_RUNTIME_VERIFICATION.md` is the authoritative repeatable checklist for:

- deployed backend target,
- real user bootstrap,
- two-user tenant isolation,
- school workspace switching,
- private resource isolation,
- diagnosis human-review/finalisation,
- final exact-head proof.

## Latest database advisor state

- Security advisor: **0 findings**
- Performance advisor: no warning-level findings; only `unused_index` informational notices on the currently empty database

## Stage 1 release gate — completed

- [x] Approved Product Constitution and engineering guardrails committed
- [x] Dedicated KSI Supabase project created
- [x] Core schema and tenant model applied
- [x] RLS enabled across all public product tables
- [x] Cross-workspace relational integrity hardened
- [x] School workspace bootstrap implemented structurally
- [x] Authentication UI implemented
- [x] Private resource bucket and storage RLS implemented
- [x] Resource Library UI implemented
- [x] Academic subjects/classes/students setup implemented
- [x] Canonical lesson/assessment/evidence/diagnosis data services implemented
- [x] Atomic artifact versioning implemented
- [x] Exact seven-stage HQLS persistence enforced
- [x] Human review/finalisation path enforced for diagnosis
- [x] Final Stage 1 RPC compile-time overlay implemented
- [x] Dependency high-severity audit gate passes
- [x] Lint passes
- [x] Strict TypeScript passes
- [x] Production build passes
- [x] Vercel Preview build succeeds
- [x] Supabase security advisor returns zero findings
- [x] Runtime verification checklist documented

## Stage 1 release gate — still required

- [ ] Verify protected Vercel Preview is using the dedicated KSI Supabase environment variables
- [ ] Complete a real authenticated sign-up/sign-in/sign-out smoke test after the Auth rate limit clears
- [ ] Verify real auth-user bootstrap creates profile + private workspace + owner membership
- [ ] Verify two authenticated users cannot read or mutate each other's workspace data
- [ ] Verify school workspace creation/switching live against the dedicated backend
- [ ] Verify private resource upload/download isolation live
- [ ] Verify diagnosis review/finalisation with real authenticated roles
- [ ] Refresh the full generated database TypeScript export or formally reconcile it with the verified RPC overlay
- [ ] Record one final exact verified Stage 1 head and publish the completion report

## Current execution order

1. Keep normal CI and database security green while waiting for runtime access constraints to clear.
2. Verify the protected Preview with an authenticated/bypass-capable session.
3. Retry real Auth bootstrap after Supabase email rate limiting clears.
4. Run the two-user, workspace, resource and diagnosis runtime tests.
5. Re-run CI, Supabase advisors and Vercel Preview on one exact head.
6. Publish the Stage 1 completion report and only then begin the HQLS Lesson Intelligence engine.

**Do not begin the final AI generators until Stage 1 passes every remaining release gate.**
