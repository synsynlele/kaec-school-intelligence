# KAEC School Intelligence — Project State

Updated: 7 August 2026

## Current stage

**Stage 1 — Platform Foundation: ENGINEERING COMPLETE / EXTERNAL ACCEPTANCE DEFERRED**

Stage 0 Product Constitution v1.1 is approved and frozen.

Stage 1 has reached the engineering handoff threshold: the repository, database architecture, security boundaries, constitutional HQLS persistence, diagnosis review controls, resource isolation design, typed data layer, application foundation, CI and deployment build are complete and verified.

Two provider-controlled acceptance checks remain deferred rather than failed:

1. a real email/password multi-user smoke is blocked by the current Supabase Auth email-delivery rate limit;
2. direct `/api/health` inspection of the Vercel Preview is blocked by Vercel Preview Protection and the available Vercel connector is authenticated to a different team.

These constraints do not justify weakening Auth security or Preview protection.

## Repository

- GitHub: `synsynlele/kaec-school-intelligence`
- Default branch: `main`
- Stage 1 branch: `stage-1-platform-foundation`
- Draft PR: `#1 — Stage 1 — Platform Foundation`
- Stage 1 base commit: `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`
- Exact branch head immediately before this state-document update: `05a3f75292e70a762baf520ef6a162fc269f47c5`

The PR remains draft and must not be merged without explicit approval.

## Verified stack

- Next.js `16.3.0`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `4.3.3`
- `@supabase/supabase-js` `^2.108.2`

The inherited vulnerable dependency graph was upgraded without weakening the audit threshold.

At head `05a3f75292e70a762baf520ef6a162fc269f47c5`, permanent CI passed:

- dependency installation,
- lint,
- strict TypeScript,
- constitutional structure verification,
- production build,
- `npm audit --audit-level=high`.

The Preview Backend Smoke also passed at that head using the protection-aware check.

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

The repository contains one ordered migration file for each Stage 1 step:

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

Remote migration history contains an additional repeated application of the idempotent Stage 1 diagnosis RPC hardening migration. The repository has only one `011` source file; the repeated remote apply changed no intended contract and is recorded here rather than hidden.

## Database and tenant architecture

The schema contains 18 public product tables, all protected by RLS:

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
- lesson and assessment creation preserves authenticated creator identity,
- evidence preserves authenticated recorder identity,
- HQLS fidelity history is append-only for authenticated users,
- lesson-stage rows cannot be independently deleted by authenticated users,
- final parent-facing diagnosis is protected from ordinary-member mutation,
- diagnosis reviewer/finaliser identity is written from `auth.uid()` by controlled database functions rather than supplied by the browser.

## Constitutional HQLS persistence

The database enforces the exact stage mapping:

1. Awakening
2. Exploration
3. Micro-Illumination
4. Trial — First Attempt
5. Full Illumination
6. Trial — Second Attempt
7. Integration

`create_hqls_lesson_draft(...)` atomically creates the lesson plus all seven correctly ordered stage rows.

A rollback-only authenticated fixture test proved:

- exactly seven lesson stages are created;
- the persisted order is exactly `awakening → exploration → micro_illumination → trial_first → full_illumination → trial_second → integration`.

A future engine therefore cannot persist a scrambled or partial HQLS skeleton as canonical output.

## Authentication bootstrap verification

The `auth.users` bootstrap trigger was exercised directly against the dedicated KSI database inside a rollback-only transaction.

Verified result for a synthetic auth user:

- profile created: PASS
- private individual workspace created: PASS
- active owner membership created: PASS
- `default_workspace_id` linked to that workspace: PASS

This proves the database bootstrap logic itself.

A separate external email/password signup attempt reached the live Supabase Auth endpoint but was rejected by the provider with `email rate limit exceeded` before a test account was created. Anonymous sign-in was also tested as a non-email route and correctly returned `Anonymous sign-ins are disabled`; that security setting was not weakened for testing.

Therefore real external email/password session creation remains a deferred acceptance smoke, not a database or application defect.

## Tenant and private-resource isolation verification

RLS was exercised against the live KSI database with synthetic authenticated JWT claims and rollback/cleaned fixtures.

Verified:

- User A could read Workspace A but not Workspace B;
- User A could read Lesson A but not Lesson B;
- a second teacher inside Workspace A could read a workspace-visible resource;
- that teacher could not read the owner's private resource;
- an authenticated user could update their own workspace lesson but not a foreign-workspace lesson.

The private resource bucket is also verified as:

- bucket: `ksi-resources`
- public: `false`
- maximum object size: 20 MB
- workspace/user-scoped paths
- metadata-first upload requirement
- private/workspace visibility enforcement
- MIME allowlist for the supported school resource formats.

A browser-level signed-session upload/download round trip is still deferred with the external Auth session smoke.

## Diagnosis integrity verification

High-consequence diagnosis lifecycle rules were tested against the live database with rollback-only owner and teacher identities.

All checks passed:

- teacher cannot finalise before review;
- teacher cannot forge lifecycle/reviewer/finaliser columns directly;
- `review_diagnosis(...)` stamps the authenticated reviewer;
- teacher cannot finalise a reviewed diagnosis;
- owner/admin can finalise after review;
- `finalise_diagnosis(...)` stamps the authenticated finaliser.

Public diagnosis RPCs are SECURITY INVOKER wrappers over private privileged logic. Browser clients do not control reviewer or finaliser identity.

## Private resource storage

A usable `/resources` workspace UI exists for curriculum, scheme, notes and reference files.

It supports:

- private/workspace visibility,
- metadata-first secure upload,
- authorised download,
- authorised deletion,
- 20 MB limit,
- workspace and creator path isolation.

`lib/resources/storage.ts` is the canonical client storage service.

## Academic workspace setup

A usable `/setup` foundation exists for reusable:

- subjects,
- classes,
- students.

The UI reads the active workspace and membership role. Owner/admin users may manage school configuration; other members remain read-only. This prevents future engines from repeatedly asking for the same school context.

## Canonical application/data architecture

- `lib/domain/*` — authoritative product vocabulary and invariants
- `lib/data/*` — canonical artifact/evidence/AI-run data-access layer
- `lib/resources/storage.ts` — canonical resource storage layer
- `lib/supabase/client.ts` — typed browser client
- `lib/supabase/database.types.ts` — persisted generated table/schema types
- `lib/supabase/database.ts` — verified Stage 1 RPC overlay for the final live RPC contract

Duplicate HQLS constants, duplicate persistence-service layers and temporary live-type extensions were removed so there is one source of truth per responsibility.

Live RPC signatures have been verified for:

- `append_artifact_version(...)`
- `create_hqls_lesson_draft(...)`
- `review_diagnosis(...)`
- `finalise_diagnosis(...)`

The final RPC overlay compiles under strict TypeScript and formally reconciles the generated table snapshot with the final RPC contract.

## Authentication and workspace UX

Implemented:

- email/password sign-up
- email/password sign-in
- sign-out
- auth-user private workspace bootstrap trigger
- authenticated dashboard
- workspace switching
- school workspace creation/bootstrap
- lesson/assessment/diagnosis counts per active workspace
- academic setup route
- private resource library route

## Vercel / deployment state

GitHub integration has created the KSI Vercel project and Preview deployments build successfully.

Known URLs:

- production alias: `https://kaec-school-intelligence.vercel.app`
- Stage 1 Preview: `https://kaec-school-intelligence-git-s-4f5a8d-synsynlele-3991s-projects.vercel.app`

The Preview is protected by Vercel Authentication. The permanent protection-aware smoke currently receives the Vercel authentication redirect and classifies it as an external access constraint rather than an application failure.

The available Vercel connector in this ChatGPT environment is authenticated to a different Vercel team than the team that owns this KSI project, so it cannot inspect the protected KSI Preview runtime or project environment variables directly.

We deliberately do not disable Preview protection simply to make an unauthenticated health request possible.

The Preview build/deployment status is green; direct runtime health JSON remains a deferred provider-access acceptance check.

## Latest database advisor state

- Supabase security advisor: **0 findings**
- Performance advisor: no warning-level findings; only `unused_index` informational notices expected on the new/mostly empty database

## Stage 1 engineering gate — passed

- [x] Approved Product Constitution and engineering guardrails committed
- [x] Dedicated KSI Supabase project created
- [x] Core schema and tenant model applied
- [x] RLS enabled across all public product tables
- [x] Cross-workspace relational integrity hardened
- [x] Auth-user workspace bootstrap implemented and DB-verified
- [x] Authentication UI implemented
- [x] Private resource bucket and storage RLS implemented
- [x] Resource Library UI implemented
- [x] Academic subjects/classes/students setup implemented
- [x] Canonical lesson/assessment/evidence/diagnosis data services implemented
- [x] Atomic artifact versioning implemented
- [x] Exact seven-stage HQLS persistence enforced and live DB-verified
- [x] Human review/finalisation path enforced and live DB-verified
- [x] Tenant/private-resource RLS boundary live DB-verified
- [x] Final Stage 1 RPC compile-time contract reconciled
- [x] Dependency audit gate passes
- [x] Lint passes
- [x] Strict TypeScript passes
- [x] Constitutional structure check passes
- [x] Production build passes
- [x] Vercel Preview build succeeds
- [x] Supabase security advisor returns zero findings
- [x] Runtime verification checklist documented

## External acceptance smokes — deferred, not failed

- [ ] Real email/password sign-up/sign-in/sign-out after the provider email-rate-limit window clears
- [ ] Signed-session two-user browser/API tenant-isolation rerun
- [ ] Signed-session school workspace creation/switching rerun
- [ ] Signed-session private resource upload/download round trip
- [ ] Direct protected Preview `/api/health` JSON inspection with access to the owning Vercel team or a project-scoped bypass mechanism

The underlying security and persistence invariants for these flows have already been proven at database/RLS level. These remaining checks validate provider delivery/access paths rather than redefine the Stage 1 architecture.

## Stage transition rule

**Stage 1 engineering work is complete.**

The Stage 1 PR remains draft pending explicit merge approval. Stage 2 — HQLS Lesson Intelligence — should begin from the merged, verified Stage 1 foundation, not by adding final AI-engine code onto an unmerged foundation branch.
