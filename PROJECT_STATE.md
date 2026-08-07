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

## Verified stack from current repository

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

## Current repository baseline

The repository remains close to a cleaned Create Next App foundation:

- `app/page.tsx` renders only the KSI title.
- `app/layout.tsx` carries KSI metadata.
- Supabase client package is installed.
- No KSI authentication flow is implemented yet.
- No dedicated KSI Supabase project exists in the connected Supabase account.

## Remote environment status

Connected Supabase projects currently visible:

- `pipupath-staging` — belongs to PipuPath and is not an authorised KSI target.

Therefore:

**Do not apply KSI migrations to any existing Supabase project until a dedicated KSI project is created and confirmed.**

## Stage 1 completed work so far

- Stage 1 branch exists.
- Approved Product Constitution is committed to the branch.
- Engineering guardrails are present in `AGENTS.md` while preserving the repository's Next.js 16 agent rule.
- Stage 1 architecture specification is committed.
- Canonical HQLS domain constants are now encoded in `lib/hqls/constants.ts`.
- Foundation database migration is now committed at `supabase/migrations/001_stage1_platform_foundation.sql`.
- The migration models workspaces, membership, subjects, classes, students, resources, structured HQLS lessons/stages, fidelity checks, assessments/items, student evidence, diagnoses, artifact versions, artifact-resource provenance, AI runs and generation feedback.
- The migration includes initial workspace-scoped RLS and a new-user private workspace bootstrap.
- Diagnosis schema enforces human review/finalisation metadata before a report can reach `final` status.

Latest implementation commits in this work session:

- `0cca4546e647f6b8d45fc3169ba398f51949d306` — encode HQLS constitutional constants
- `14c2ad84a8b7e443d303f159aded69b92bee093f` — add Stage 1 database foundation

## Next remote dependency

A dedicated KSI Supabase project must be created before the migration can be applied or auth/storage can be tested remotely.

Supabase project creation requires:

1. explicit selection of the Supabase organisation, and
2. cost retrieval and explicit cost confirmation before creation.

Once the dedicated KSI project exists:

1. apply the Stage 1 migration there only,
2. generate TypeScript database types,
3. run security and performance advisors,
4. fix all critical findings,
5. configure auth/session infrastructure,
6. verify workspace bootstrap and tenant isolation,
7. add private resource storage policies.

## Stage 1 remains blocked only on the remote KSI backend target for the next substage

Repository implementation can continue, but remote database, authentication and storage verification must not use `pipupath-staging`.
