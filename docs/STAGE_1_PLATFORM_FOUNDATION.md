# KAEC School Intelligence — Stage 1 Platform Foundation

Status: IN PROGRESS  
Branch: `stage-1-platform-foundation`  
Base: `main` @ `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`  
Constitution: `docs/PRODUCT_CONSTITUTION.md` v1.1 APPROVED

## 1. Purpose

Stage 1 turns the approved Stage 0 Product Constitution into a durable technical foundation. It does not build the final HQLS Lesson Generator, Assessment Generator, or Diagnosis experience yet. It creates the structures those engines require so later stages can be implemented without architectural rewrites.

The platform must preserve the core product loop:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

## 2. Actual Repository Baseline

The connected GitHub repository is `synsynlele/kaec-school-intelligence`.

Verified current baseline:

- Next.js `16.2.9`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `^4`
- `@supabase/supabase-js` already installed
- `framer-motion`, `react-icons`, `clsx`, and `tailwind-merge` already installed
- Current production branch: `main`
- Current application UI is intentionally minimal
- No KSI Supabase project currently exists in the connected Supabase account
- The only connected Supabase project currently visible is `pipupath-staging`; it must not be used for KSI

The older handoff that referenced Next.js 14 / React 18 / Prisma is superseded by the current repository state above.

## 3. Stage 1 Scope

Stage 1 includes only platform capabilities required by the approved Version 1 product:

1. Repository governance and constitutional guardrails.
2. Workspace and membership model.
3. Secure user profile foundation.
4. School/class/subject/student context.
5. Private resource metadata foundation.
6. Structured HQLS lesson persistence.
7. Structured assessment persistence.
8. Structured student evidence persistence.
9. Structured diagnosis persistence.
10. AI run, prompt/version and artifact-version traceability.
11. HQLS fidelity-check persistence.
12. Row Level Security boundaries for tenant isolation.
13. Domain constants/types that encode the seven-stage HQLS law.
14. Environment and Supabase client foundation.
15. A documented path to authentication and resource storage once a dedicated KSI Supabase project is created.

## 4. Explicitly Out of Scope

Stage 1 must not expand into:

- fees, payroll, transport, attendance or admissions
- timetable management
- parent portal or parent messaging
- student portal
- classroom observation product UI
- teacher induction/certification product UI
- daily/weekly/termly operations modules
- PipuPath integration
- final AI prompt implementation
- final HQLS Lesson Generator UI
- final Assessment Generator UI
- final Diagnosis UI

## 5. Architecture Decisions

### 5.1 Supabase is the Version 1 backend foundation

Use Supabase for authentication, PostgreSQL persistence, Row Level Security, private file storage and server-side data access.

Do not introduce Prisma into Stage 1. The current repository does not contain Prisma, and adding a second persistence abstraction would create unnecessary complexity.

### 5.2 Workspace is the tenant boundary

A user may eventually operate personally or as part of a school. Every school-owned artifact must belong to exactly one workspace.

Core roles:

- `owner`
- `admin`
- `teacher`

No parent or student login role is required in Version 1.

### 5.3 Structured artifacts, not AI text blobs

The database must preserve the semantic structure of each core artifact.

A lesson stores seven ordered HQLS stages. An assessment stores individual questions/tasks and their metadata. Student evidence is stored independently from diagnosis. Diagnosis stores evidence-aware findings plus a separately reviewable parent report.

### 5.4 Traceability is constitutional

When an assessment is generated from a lesson, preserve the link. When diagnosis uses an assessment, preserve the link.

Every AI-generated artifact must be able to record engine version, prompt version, model/provider, input summary, output artifact, generation status and human review/finalisation status where relevant.

### 5.5 Human review remains mandatory for parent diagnosis

Diagnosis drafts may be AI-assisted. A parent-facing diagnosis cannot become `final` without authorised human review.

## 6. Stage 1 Database Model

The initial migration should define these first-class entities:

- `profiles`
- `workspaces`
- `workspace_members`
- `subjects`
- `classes`
- `students`
- `resources`
- `lessons`
- `lesson_stages`
- `hqls_fidelity_checks`
- `assessments`
- `assessment_items`
- `student_evidence`
- `diagnoses`
- `artifact_versions`
- `artifact_resource_links`
- `ai_runs`
- `generation_feedback`

This schema is deliberately broader than a single generator while remaining inside the three-engine Version 1 boundary.

## 7. Security Model

The database foundation must enforce:

- RLS on every user/workspace table.
- Users can only see workspaces they belong to.
- Workspace content is inaccessible to non-members.
- Resource metadata respects `private` vs `workspace` visibility.
- Student records are accessible only inside the owning workspace.
- Diagnosis finalisation is auditable.
- Artifact history is append-only by normal users.
- No service-role key is ever exposed in client code.

A storage bucket and storage-object policies will be added only after the dedicated KSI Supabase project exists, because storage policy testing must occur against the real project.

## 8. Stage 1 Substages

### Stage 1.1 — Repository Governance
- Add approved Product Constitution.
- Update `AGENTS.md` without deleting framework-specific agent rules.
- Add `PROJECT_STATE.md`.
- Add this Stage 1 specification.
- Encode HQLS constants in TypeScript.

### Stage 1.2 — Database Foundation
- Add migration `001_stage1_platform_foundation.sql`.
- Create dedicated KSI Supabase project.
- Apply migration to KSI staging/development only.
- Generate database TypeScript types.
- Run Supabase security and performance advisors.
- Correct all critical RLS/security findings.

### Stage 1.3 — Authentication & Workspace Foundation
- Configure KSI environment variables.
- Add browser/server Supabase clients appropriate to Next.js 16.
- Add sign-in/sign-out flow.
- Add authenticated workspace bootstrap.
- Add route protection.
- Verify refresh-safe sessions.

### Stage 1.4 — Persistence Foundation
- Create typed repositories/services for lessons, assessments, evidence and diagnoses.
- Validate tenant boundaries.
- Add artifact-version writes.
- Add AI-run audit persistence.

### Stage 1.5 — Resource Foundation
- Create private KSI resource bucket.
- Add workspace-scoped storage policies.
- Upload and retrieve authorised curriculum/resource files.
- Persist source provenance.

### Stage 1.6 — Validation & Release Gate
- Formatting/lint/typecheck/build pass.
- Authenticated smoke tests pass.
- RLS cross-tenant tests pass.
- Core artifact create/read/update flows pass.
- No secret reaches browser bundle.
- Stage 1 completion report committed.

## 9. Current External Dependency

A dedicated KSI Supabase project does not yet exist in the connected account. Remote Stage 1.2 cannot be executed against `pipupath-staging`.

Before creating a new Supabase project, the Supabase tool requires explicit confirmation of the organisation and project cost. Until then, repository work may continue, but remote migration/auth/storage verification remains blocked.

## 10. Stage 1 Exit Criteria

Stage 1 is complete only when all of the following are proven:

- [ ] Approved Product Constitution is in the repository.
- [ ] Repository governance files are present.
- [ ] Seven-stage HQLS domain constants are encoded once and reused.
- [ ] Dedicated KSI Supabase project exists.
- [ ] Stage 1 migration applies cleanly to KSI staging/development.
- [ ] RLS prevents cross-workspace reads and writes.
- [ ] Authentication works end-to-end.
- [ ] Workspace membership and role boundaries work.
- [ ] Structured lesson persistence works.
- [ ] Structured assessment persistence works.
- [ ] Student evidence persistence works.
- [ ] Diagnosis draft/final workflow works.
- [ ] Parent-facing diagnosis cannot be finalised without human reviewer metadata.
- [ ] Prompt/engine/model traceability is persisted.
- [ ] Private resources cannot leak across workspaces.
- [ ] TypeScript generation and application typecheck pass.
- [ ] Production build passes.
- [ ] Supabase security advisors have no unresolved critical findings.
- [ ] Stage 1 completion report documents exact commit and remote project state.

## 11. Non-Negotiable Engineering Rule

Do not optimise for the fastest demo. Optimise for a foundation that allows the three KSI engines to improve independently while keeping one shared evidence graph, one tenant boundary, one audit trail, and one HQLS constitutional source of truth.
