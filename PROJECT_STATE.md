# KAEC School Intelligence — Project State

Updated: 7 August 2026

## Current stage

**Stage 1 — Platform Foundation: IN PROGRESS / RELEASE-GATE HARDENING**

Stage 0 Product Constitution v1.1 is approved and frozen.

## Repository

- GitHub: `synsynlele/kaec-school-intelligence`
- Default branch: `main`
- Stage 1 branch: `stage-1-platform-foundation`
- Draft PR: `#1 — Stage 1 — Platform Foundation`
- Stage 1 base commit: `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`

## Verified stack

- Next.js `16.3.0`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `4.3.3`
- `@supabase/supabase-js` `^2.108.2`

The dependency security gate was repaired without weakening the audit threshold. The latest verified CI run passed lint, strict TypeScript, production build and `npm audit --audit-level=high`.

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

The dedicated KSI project now has the following Stage 1 migrations applied:

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

The repository migration numbering is now unique and replay-safe.

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

- cross-workspace relationships are blocked by same-workspace constraints
- workspace IDs and creator/recorder provenance cannot be silently rewritten
- every workspace must retain at least one active owner
- a user's default workspace must be one of their active memberships
- school roster/configuration mutation is restricted to owner/admin roles
- lesson and assessment creation must preserve the authenticated creator identity
- evidence must preserve the authenticated recorder identity
- HQLS fidelity history is append-only for authenticated users
- lesson-stage rows cannot be individually deleted by authenticated users
- final parent-facing diagnosis is protected from ordinary-member mutation
- diagnosis reviewer/finaliser identity is written by controlled RPCs, not supplied by the browser

## Constitutional HQLS persistence

The database now enforces the exact stage mapping:

1. Awakening
2. Exploration
3. Micro-Illumination
4. Trial — First Attempt
5. Full Illumination
6. Trial — Second Attempt
7. Integration

`create_hqls_lesson_draft(...)` atomically creates the lesson plus all seven correctly ordered stage rows. A future engine therefore cannot accidentally persist a scrambled or partial HQLS structure as the canonical lesson skeleton.

## Diagnosis integrity

- Browser clients cannot directly write reviewer/finaliser identity fields.
- `review_diagnosis(...)` records the authenticated reviewer.
- `finalise_diagnosis(...)` requires owner/admin role and a prior human review.
- Privileged diagnosis mutation now lives in the non-exposed `private` schema; public RPCs are SECURITY INVOKER wrappers.
- Latest Supabase security advisor result after hardening: **0 findings**.

## Private resource storage

- Private bucket: `ksi-resources`
- Public access: disabled
- Maximum file size: 20 MB
- Paths are workspace/user scoped.
- A tracked `resources` metadata row is required before upload.
- Private resource visibility is enforced.
- Resource object access is workspace isolated.
- `lib/resources/storage.ts` is the canonical client storage service.

## Canonical application/data architecture

- `lib/domain/*` — authoritative product vocabulary and invariants
- `lib/data/*` — canonical artifact/evidence/AI-run data-access layer
- `lib/resources/storage.ts` — canonical resource storage layer
- `lib/supabase/client.ts` — typed browser client
- `lib/supabase/database.types.ts` — persisted generated database types

Duplicate HQLS constants and duplicate persistence-service layers have been removed so the codebase has one source of truth per responsibility.

## Authentication and workspace UX

Implemented:

- email/password sign-up
- email/password sign-in
- sign-out
- new-auth-user private workspace bootstrap
- authenticated dashboard
- workspace switching
- school workspace creation/bootstrap
- lesson/assessment/diagnosis counts per active workspace

A real two-user authenticated isolation proof is still required before Stage 1 closes. Structural RLS and database constraints are verified, but that runtime test must not be claimed until executed with real authenticated identities.

## Vercel / deployment state

GitHub integration has created the KSI Vercel project and Preview deployments are building successfully. The latest checked preview deployment was READY and the Vercel commit status was green.

Runtime connection to the dedicated Supabase project still requires verification in the actual Vercel environment. The application contract is:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No service-role key has been retrieved or exposed to browser code.

## Type-generation note

The generated database type file is persisted and the browser Supabase client is typed. Because later Stage 1 migrations added new RPCs after the last full type generation, the live types must be regenerated once more before Stage 1 is declared complete.

## Latest database advisor state

- Security advisor: **0 findings**
- Performance advisor: no warning-level findings; only `unused_index` informational notices on the currently empty database

## Stage 1 release gate — completed

- [x] Approved Product Constitution and engineering guardrails committed
- [x] Dedicated KSI Supabase project created
- [x] Core schema and tenant model applied
- [x] RLS enabled across all public product tables
- [x] Cross-workspace relational integrity hardened
- [x] School workspace bootstrap implemented
- [x] Authentication UI implemented
- [x] Private resource bucket and storage RLS implemented
- [x] Canonical lesson/assessment/evidence/diagnosis data services implemented
- [x] Atomic artifact versioning implemented
- [x] Exact seven-stage HQLS persistence enforced
- [x] Human review/finalisation path enforced for diagnosis
- [x] Dependency high-severity audit gate passes
- [x] Lint passes
- [x] Strict TypeScript passes
- [x] Production build passes
- [x] Vercel Preview build succeeds
- [x] Supabase security advisor returns zero findings

## Stage 1 release gate — still required

- [ ] Regenerate database TypeScript types after the final Stage 1 RPC migrations
- [ ] Verify Vercel Preview is using the dedicated KSI Supabase environment variables
- [ ] Complete a real authenticated sign-up/sign-in/sign-out smoke test
- [ ] Verify auth-user bootstrap creates profile + private workspace + owner membership with a real user
- [ ] Verify two authenticated users cannot read or mutate each other's workspace data
- [ ] Verify school workspace creation and switching live against the dedicated backend
- [ ] Verify private resource upload/download isolation live
- [ ] Record the exact final verified Stage 1 head and completion report

## Current execution order

1. Close the live environment/authentication verification gap.
2. Run the two-user tenant-isolation and private-resource smoke tests.
3. Regenerate final database types.
4. Re-run CI, Supabase advisors and Vercel Preview on one exact head.
5. Publish the Stage 1 completion report and only then begin the HQLS Lesson Intelligence engine.

**Do not begin the final AI generators until Stage 1 passes every remaining release gate.**
