# KAEC School Intelligence — Project State

Updated: 7 August 2026

## Current stage

**Stage 1 — Platform Foundation: IN PROGRESS**

Stage 0 Product Constitution v1.1 is approved and frozen.

## Repository

- GitHub: `synsynlele/kaec-school-intelligence`
- Default branch: `main`
- Stage 1 branch: `stage-1-platform-foundation`
- Stage 1 base commit: `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`

## Verified stack

- Next.js `16.2.9`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `^4`
- `@supabase/supabase-js` `^2.108.2`

## Product scope

Version 1 is locked to:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

plus only the infrastructure necessary for those engines.

The governing product loop is:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

## Dedicated Supabase environment

A dedicated KAEC School Intelligence Supabase project now exists.

- Project: `kaec-school-intelligence`
- Project ref: `zaoxfjbiizargeclnzmo`
- Region: `eu-west-1`
- Status at creation: `ACTIVE_HEALTHY`
- API URL: `https://zaoxfjbiizargeclnzmo.supabase.co`

`pipupath-staging` remains a separate PipuPath environment and is not an authorised KSI target.

## Stage 1 database state

The following KSI migrations are committed and have been applied successfully to the dedicated KSI project:

1. `001_stage1_platform_foundation.sql`
2. `002_stage1_security_performance_hardening.sql`
3. `003_stage1_tenant_integrity.sql`

The schema now includes:

- profiles and workspaces
- workspace membership and roles
- subjects, classes and students
- private resource metadata
- structured HQLS lessons and seven lesson stages
- HQLS fidelity checks
- assessments and assessment items
- student evidence
- diagnoses with human review/finalisation metadata
- artifact versions
- artifact/resource provenance
- AI run provenance
- generation feedback

## Security state

- RLS is enabled across user/workspace tables.
- SECURITY DEFINER helper functions were moved out of the exposed `public` API schema.
- Direct execution of internal trigger/helper functions is restricted.
- Workspace relationships are constrained so linked records cannot silently cross tenant boundaries.
- Workspace IDs and creator/recorder provenance are protected from silent rewrites.
- Every workspace must retain at least one active owner.
- A parent-facing diagnosis cannot reach `final` without recorded human review and finalisation metadata.
- Latest Supabase security advisor result: **0 findings**.
- Latest performance advisor has no warning-level findings; only `unused_index` informational notices are present on the new, currently empty database.

## Type and environment state

- Supabase TypeScript types have been generated successfully from the live KSI schema; repository persistence of the generated type file is still pending.
- `.env.example` defines the public Supabase URL and publishable-key contract without committing live credentials.
- `lib/env.ts` validates public Supabase configuration.
- `lib/supabase/client.ts` provides a persistent browser Supabase client.
- No service-role key has been retrieved or exposed to client code.

## Domain model state

Canonical product domain definitions live under `lib/domain/`.

- `hqls.ts` — seven HQLS stages and fidelity failures
- `assessment.ts` — assessment modes, critical-thinking experience types and difficulty vocabulary
- `diagnosis.ts` — diagnosis modes, evidence layers and lifecycle states

A duplicate HQLS constants source was removed so the codebase does not carry competing definitions. Diagnosis lifecycle now includes the constitutionally required `reviewed` state.

## Current application state

- The application UI remains intentionally thin.
- Final Lesson, Assessment and Diagnosis generator interfaces have not been started.
- Authentication/workspace UX is the next active substage.
- A dedicated KSI Vercel project does not yet exist in the connected Vercel team.

## Stage 1 validation still required

- [ ] Persist generated database TypeScript types in the repository.
- [ ] Implement sign-up/sign-in/sign-out against the dedicated KSI project.
- [ ] Verify auth-user bootstrap creates profile + private workspace + owner membership.
- [ ] Verify two authenticated users cannot read or mutate each other's workspace data.
- [ ] Add school-workspace creation/bootstrap flow.
- [ ] Add typed persistence services for lessons, assessments, evidence and diagnoses.
- [ ] Add private resource storage bucket and storage RLS policies.
- [ ] Run formatting, lint, strict TypeScript and production build.
- [ ] Create/verify KSI deployment environment and authenticated smoke test.
- [ ] Commit Stage 1 completion report with exact verified head.

## Current execution order

1. Complete Stage 1.3 authentication and workspace bootstrap.
2. Run live tenant-isolation tests with real test identities.
3. Persist live generated database types.
4. Build Stage 1.4 typed persistence services.
5. Build Stage 1.5 private resource storage.
6. Complete Stage 1.6 validation and release gate.

Do not begin the final AI generators until the Stage 1 platform foundation passes its release gate.
