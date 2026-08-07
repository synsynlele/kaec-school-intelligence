# KAEC School Intelligence — Project State

Updated: 7 August 2026

## Current stage

**Stage 1 — Platform Foundation: ACCEPTANCE PASSED / READY FOR FOUNDER MERGE APPROVAL**

Stage 0 Product Constitution v1.1 remains approved and frozen.

Stage 1 has completed both engineering verification and live external acceptance for the Google-first product path. The platform foundation for HQLS Lesson Intelligence, Assessment Intelligence and Student Diagnosis Intelligence is now operational on the dedicated KSI environment.

The Stage 1 PR remains **draft and unmerged** until explicit founder approval. Stage 2 must not begin from an unmerged Stage 1 branch.

## Repository

- GitHub: `synsynlele/kaec-school-intelligence`
- Default branch: `main`
- Stage 1 branch: `stage-1-platform-foundation`
- Draft PR: `#1 — Stage 1 — Platform Foundation`
- Stage 1 base commit: `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`
- Accepted implementation head before closeout documentation: `96c6b19f6822d5a84cc3a346f946c61f443fa753`

## Product scope

Version 1 remains locked to:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

plus only the shared infrastructure genuinely required by those engines.

The governing loop is:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

KSI is not a school ERP. Stage 1 does not build the final AI generators.

## Branding guardrail

KSI should use the **official KAEC-NG logo and approved KAEC-NG visual identity** on appropriate product surfaces, including authentication, dashboard/header, favicon/app identity and generated reports. Do not invent or substitute a replacement logo when the official asset is available.

## Verified stack

- Next.js `16.3.0`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `4.3.3`
- `@supabase/supabase-js` `^2.108.2`

Permanent CI validates dependency installation, lint, strict TypeScript, constitutional structure, production build and high-severity dependency audit.

At accepted implementation head `96c6b19f6822d5a84cc3a346f946c61f443fa753`, the complete KSI CI workflow passed and the matching Vercel Preview deployment succeeded.

## Authentication decision and live acceptance

**Google Sign-In is the primary KSI sign-up/sign-in path.** Email/password remains a secondary fallback.

Google OAuth is configured against the dedicated KSI Supabase project and the protected Vercel Preview.

Live acceptance passed:

- first real Google sign-in: PASS
- Google identity created in Supabase: PASS
- profile bootstrap: PASS
- private individual workspace bootstrap: PASS
- active owner membership bootstrap: PASS
- default workspace link: PASS
- sign-out: PASS
- repeat Google sign-in: PASS
- repeat login did not duplicate private workspace/membership: PASS
- OAuth return loaded dashboard directly on repeat login: PASS

The initial first-return dashboard race was transient and did not reproduce on repeat login. No security control was weakened.

## Dedicated Supabase environment

- Project: `kaec-school-intelligence`
- Project ref: `zaoxfjbiizargeclnzmo`
- Region: `eu-west-1`
- API URL: `https://zaoxfjbiizargeclnzmo.supabase.co`

`pipupath-staging` remains separate and is not an authorised KSI target.

## Applied Stage 1 migrations

The repository contains one ordered migration source for each Stage 1 step:

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

Remote history contains an additional repeated application of the idempotent diagnosis RPC hardening operation. The repository intentionally contains only one `011` source file; the remote repetition is documented rather than hidden.

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

- cross-workspace relationships are blocked by same-workspace constraints;
- workspace IDs and creator/recorder provenance cannot be silently rewritten;
- every workspace retains at least one active owner;
- a user's default workspace must be one of their active memberships;
- school roster/configuration mutation is restricted to owner/admin;
- lesson and assessment creation preserves authenticated creator identity;
- evidence preserves authenticated recorder identity;
- HQLS fidelity history is append-oriented;
- lesson-stage rows cannot be independently deleted by authenticated users;
- final diagnosis is protected from ordinary-member mutation;
- diagnosis reviewer/finaliser identity is derived from `auth.uid()` by controlled database functions.

## Live school workspace acceptance

A real Google-authenticated user created a school workspace successfully after the secure client insert flow was corrected.

Verified:

- school workspace insert: PASS
- owner membership trigger: PASS
- profile default-workspace switch: PASS
- dashboard school context: PASS
- switching between individual and school workspaces: PASS
- no RLS weakening was required.

The accepted school-workspace creation flow generates the workspace UUID client-side, inserts without premature `RETURNING`, lets the owner-membership trigger complete, and then switches the user's default workspace.

## Private resource storage and live isolation

Private bucket: `ksi-resources`

Verified configuration:

- public access disabled
- 20 MB maximum object size
- supported school document/image MIME allowlist
- storage path contract: `<workspace>/<creator>/<unique-name>`
- matching authorised `resources` metadata required
- workspace-visible resources available only inside authorised workspace context
- private resources creator-only
- authorised deletion only

Live browser acceptance passed with a real PDF:

- metadata creation: PASS
- private bucket upload: PASS
- authenticated download/open: PASS
- private workspace did not display the school resource: PASS
- switching back to the school workspace restored the resource: PASS

## Academic Setup

Route: `/setup`

Reusable school context supports:

- subjects
- classes
- students

Owner/admin users can perform full managed lifecycle operations:

- create
- edit
- deactivate/reactivate
- dependency-safe delete

Teachers remain read-only for structural school configuration.

Live browser CRUD acceptance passed. Destructive deletion is blocked when a subject, class or student already has dependent learning history; deactivation is used instead to preserve evidence and diagnosis integrity.

## Constitutional HQLS persistence

The database enforces the exact seven-stage mapping:

1. Awakening
2. Exploration
3. Micro-Illumination
4. Trial — First Attempt
5. Full Illumination
6. Trial — Second Attempt
7. Integration

`create_hqls_lesson_draft(...)` atomically creates the lesson plus all seven correctly ordered stage rows.

Rollback-only authenticated verification proved exactly seven stages and the exact constitutional order.

## Diagnosis integrity

Diagnosis lifecycle remains:

`draft → reviewed → final → archived`

Database-level authenticated verification passed:

- teacher cannot finalise before review;
- teacher cannot forge lifecycle/reviewer/finaliser columns;
- `review_diagnosis(...)` stamps the authenticated reviewer;
- teacher cannot finalise a reviewed diagnosis;
- owner/admin can finalise after review;
- `finalise_diagnosis(...)` stamps the authenticated finaliser.

Public diagnosis RPCs are SECURITY INVOKER wrappers over private privileged logic. No final Diagnosis UI is part of Stage 1, so the authority boundary is verified at the persistence/RPC layer rather than through a Stage 1 diagnosis screen.

## Two-user isolation — live acceptance passed

A second real Google account was authenticated in an isolated browser session.

Bootstrap verified:

- separate auth user: PASS
- separate profile: PASS
- exactly one separate private workspace: PASS
- active owner membership: PASS
- zero school-workspace memberships: PASS

From the second user's authenticated RLS perspective:

- first user's school workspace visible: 0 rows
- first user's private resource visible: 0 rows
- first user's profile visible: 0 rows
- second user's own private workspace visible: 1 row
- second user's own profile visible: 1 row

A rollback-only write-isolation probe also returned zero mutable rows for the first user's school workspace, resource and profile.

Browser confirmation passed:

- `KAEC Nigerian Schools` was not listed for the second account;
- the first account's uploaded PDF was not visible.

This closes the major signed-session tenant-isolation gate.

## Health endpoint — live acceptance passed

Protected Preview `/api/health` returned:

```json
{"ok":true,"supabaseConfigured":true,"dedicatedKsiTarget":true,"backendReachable":true}
```

This proves the deployed app is configured against the dedicated KSI Supabase target and the backend is reachable under the protected Preview session.

## Canonical application/data architecture

- `lib/domain/*` — authoritative product vocabulary and invariants
- `lib/data/*` — canonical artifact/evidence/AI-run data layer
- `lib/resources/storage.ts` — canonical resource storage layer
- `lib/supabase/client.ts` — typed browser client
- `lib/supabase/database.types.ts` — generated table/schema snapshot
- `lib/supabase/database.ts` — verified Stage 1 RPC overlay

Live RPC contract includes:

- `append_artifact_version(...)`
- `create_hqls_lesson_draft(...)`
- `review_diagnosis(...)`
- `finalise_diagnosis(...)`

## Supabase advisor state

Latest closeout advisor state:

- Security advisor: one **WARN** — leaked-password protection is disabled for the email/password fallback.
- Performance advisor: only `unused_index` informational notices on the new/low-usage database.

The leaked-password warning does **not** affect Google OAuth, which is the primary authentication path, but it should be enabled before production launch while email/password fallback remains available.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Unused-index INFO notices are intentionally retained until real engine workload provides evidence for index removal.

## Vercel / deployment state

Known URLs:

- production alias: `https://kaec-school-intelligence.vercel.app`
- Stage 1 Preview: `https://kaec-school-intelligence-git-s-4f5a8d-synsynlele-3991s-projects.vercel.app`

Preview Protection remains enabled. We did not disable it to manufacture a green test. An authorised browser session successfully reached the deployed app and `/api/health`.

## Stage 1 acceptance gate — passed

- [x] Product Constitution and engineering guardrails
- [x] dedicated KSI Supabase environment
- [x] 18-table RLS-protected schema
- [x] cross-workspace relational integrity
- [x] exact seven-stage HQLS persistence
- [x] diagnosis review/finalisation authority controls
- [x] Google OAuth primary authentication
- [x] first-user profile/private-workspace bootstrap
- [x] sign-out and repeat Google sign-in
- [x] school workspace creation and switching
- [x] private resource upload/download
- [x] private-vs-school workspace resource isolation
- [x] Academic Setup CRUD with safe deletion behavior
- [x] protected Preview health endpoint
- [x] second real Google-user bootstrap
- [x] two-user browser/RLS read isolation
- [x] two-user write-isolation probe
- [x] permanent CI gate
- [x] Vercel Preview deployment

## Stage transition rule

**Stage 1 is acceptance-passed and ready for explicit founder merge approval.**

PR #1 must remain unmerged until that approval is given.

After merge, the next stage is:

**Stage 2 — HQLS Lesson Intelligence**

Stage 2 should consume this verified foundation rather than reopen completed Stage 1 architecture.
