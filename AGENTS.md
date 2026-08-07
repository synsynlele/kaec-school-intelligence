<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# KAEC School Intelligence — Engineering Guardrails

This repository is governed by the approved KAEC School Intelligence Product Constitution.

## Mandatory reading before changes

1. `docs/PRODUCT_CONSTITUTION.md`
2. `docs/STAGE_1_PLATFORM_FOUNDATION.md`
3. `PROJECT_STATE.md`
4. `docs/STAGE_1_RUNTIME_VERIFICATION.md` when changing auth, workspace, storage, diagnosis approval, deployment or Stage 1 release-gate behaviour

Do not begin implementation before reading the relevant governing documents.

## Product boundary

Version 1 contains exactly three core intelligence engines:

- HQLS Lesson Intelligence
- Assessment Intelligence
- Student Diagnosis Intelligence

Supporting infrastructure is allowed only when it materially enables these three engines.

Do not add school ERP features.

## HQLS constitutional rules

The HQLS learning sequence is fixed:

1. Awakening
2. Exploration
3. Micro-Illumination
4. Trial — First Attempt
5. Full Illumination
6. Trial — Second Attempt
7. Integration

No full teaching before first meaningful struggle.  
No struggle without guardrails.  
No second attempt without illumination.  
No learning without reflection.

Do not create an "HQLS Lite" pathway that removes constitutional requirements.

## Architecture rules

- Preserve Lesson → Assessment → Evidence → Diagnosis → Improvement traceability.
- Store important artifacts as structured data, not only raw generated prose.
- Keep tenant boundaries workspace-scoped.
- Use RLS as a security boundary, not merely UI filtering.
- Keep AI/API secrets server-side.
- Version AI engines/prompts and persist provenance.
- Separate observed evidence from inferred interpretation in diagnosis.
- Require human review before parent-facing diagnosis reaches Final status.
- Do not silently modify constitutional behaviour.
- Keep one canonical data-access/storage layer per responsibility; remove duplicate abstractions rather than letting them drift.

## Security and verification discipline

- Never use `pipupath-staging` for KSI migrations or test data.
- Do not make production data mutations unless explicitly authorised and the target environment is confirmed disposable/staging.
- Do not enable anonymous authentication merely to manufacture test identities.
- Do not disable Vercel Preview Protection merely to make an unauthenticated smoke test pass.
- Do not weaken RLS, audit thresholds, diagnosis approval rules or tenant boundaries to get a green build.
- Never claim a runtime gate passed from structural inspection alone.
- If a live test is blocked by an external provider limit or access control, record the blocker explicitly and keep the gate open.

## Working discipline

- Inspect existing code before changing it.
- Do not rebuild completed work.
- Prefer small, reviewable stages.
- Keep strict TypeScript.
- Run lint, typecheck, constitutional structure verification, production build and relevant tests before declaring a stage complete.
- Re-fetch the current branch/file SHA before sequential GitHub updates; concurrent automation may advance the branch.

## Change control

If a request conflicts with `docs/PRODUCT_CONSTITUTION.md`, stop and surface the conflict. Do not reinterpret the Constitution to make implementation easier.
