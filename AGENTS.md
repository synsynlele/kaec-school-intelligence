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

Do not begin implementation before reading all three.

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

## Working discipline

- Inspect existing code before changing it.
- Do not rebuild completed work.
- Prefer small, reviewable stages.
- Keep strict TypeScript.
- Run formatting/lint/typecheck/build and relevant tests before declaring a stage complete.
- Never use `pipupath-staging` for KSI migrations or test data.
- Do not make production data mutations unless explicitly authorised and the target environment is confirmed disposable/staging.

## Change control

If a request conflicts with `docs/PRODUCT_CONSTITUTION.md`, stop and surface the conflict. Do not reinterpret the Constitution to make implementation easier.
