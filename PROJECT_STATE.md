# KAEC School Intelligence — Project State

Updated: 7 August 2026

## Current stage

**Stage 1 — Platform Foundation: IN PROGRESS**

Stage 0 Product Constitution v1.1 is approved.

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

## Current repository state before Stage 1

The repository is still near its cleaned Create Next App foundation:

- `app/page.tsx` renders only the KSI title.
- `app/layout.tsx` carries KSI metadata.
- Supabase client package is installed.
- No KSI database schema is committed.
- No KSI authentication flow is implemented.
- No dedicated KSI Supabase project exists in the connected Supabase account.

## Remote environment status

Connected Supabase projects currently visible:

- `pipupath-staging` — belongs to PipuPath and is not an authorised KSI target.

Therefore:

**Do not apply KSI migrations to any existing Supabase project until a dedicated KSI project is created and confirmed.**

## Stage 1 work started

- Stage 1 branch created.
- Product Constitution added to the branch.
- Engineering guardrails added to `AGENTS.md` while preserving the repository's Next.js 16 agent rule.
- Stage 1 architecture specification is being added.
- HQLS domain constants and database foundation are next.

## Next remote dependency

Create a dedicated KSI Supabase project after:

1. the Supabase organisation is explicitly selected, and
2. the Supabase project cost is shown and confirmed.

Then apply and verify the Stage 1 migration in that KSI environment only.
