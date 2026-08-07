# KAEC School Intelligence — Stage 2 HQLS Lesson Intelligence

Status: FUNCTIONALLY ACCEPTED / READY FOR MERGE APPROVAL  
Branch: `stage-2-hqls-lesson-intelligence`  
Base: merged Stage 1 `main` @ `4e1bdfb973bc4761895c84730fd5dcec0f0f9ad1`  
Constitution: `docs/PRODUCT_CONSTITUTION.md` v1.1 APPROVED

## 1. Purpose

Stage 2 turns the verified Stage 1 platform foundation into the first complete KSI intelligence engine: **HQLS Lesson Intelligence**.

The teacher flow is:

**Give lesson context → Generate seven-stage HQLS lesson → Validate fidelity → Repair if needed → Review/Edit → Save/Version → Reopen later → Download teacher-ready PDF**

Stage 2 does not implement the final Assessment or Diagnosis generators. It preserves the future handoff by saving structured lesson context and traceability.

## 2. Constitutional lesson law

Every lesson must preserve the exact sequence:

1. Awakening
2. Exploration
3. Micro-Illumination
4. Trial — First Attempt
5. Full Illumination
6. Trial — Second Attempt
7. Integration

Roles are fixed:
- learner = Hero
- teacher = Guide
- problem = Villain

Non-negotiables:
- no full teaching before the first meaningful struggle
- no struggle without guardrails
- no second attempt without illumination
- no learning without reflection
- no HQLS Lite

## 3. AI provider

Stage 2 uses the OpenAI Responses API with strict Structured Outputs.

- `OPENAI_API_KEY` is server-only.
- `KSI_OPENAI_MODEL` controls the model.
- accepted live runs used `gpt-5.6-terra`.
- generator self-claims never replace the independent deterministic HQLS validator.

## 4. Lesson context

Essential context:
- workspace
- subject
- class / level
- topic
- objective
- age range
- duration

Optional advanced context:
- previous learning
- available resources / constraints
- class context
- teacher instructions
- up to three authorised workspace resources

## 5. Structured lesson output

Each lesson contains exactly seven structured stages.

Each stage includes:
- stage number / key / title
- purpose
- learner experience / task
- teacher prompts
- learner actions
- Guide Guardrails
- evidence to notice
- productive struggle where relevant
- teaching content where relevant
- Full Illumination response to Trial 1 gaps
- explicit Integration reflection prompt
- Integration transfer / real-life task

## 6. HQLS fidelity validation

Deterministic validation runs after generation and after repair.

It verifies the constitutional sequence and laws, including:
- Awakening does not dump teaching
- Exploration permits discovery before correction
- Micro-Illumination gives only enough light to proceed
- Trial 1 contains meaningful productive struggle and Guide Guardrails
- Full Illumination teaches after effort and responds to Trial 1 gaps
- Trial 2 requires genuine re-application and observable improvement
- Integration contains changed-thinking reflection and transfer
- learner cognitive ownership remains visible

Still-invalid output is rejected.

Every accepted generation writes a system-origin fidelity record through the secure authenticated Stage 2 RPC; browser clients cannot forge system fidelity results directly.

## 7. Editing and regeneration

Teachers can edit saved stage content and save it back to the authorised lesson.

Every true manual save creates an artifact version with origin `manual_edit`.

Stage actions include:
- Improve
- Simplify
- Increase Challenge
- Make More Practical
- Reduce Resource Dependence
- Regenerate

Regeneration is stage-level whenever possible. It changes only the explicitly selected stage and creates an artifact version with origin `regeneration`.

## 8. Saved lesson and export experience

Stage 2 supports:
- saved lesson list
- reopen after refresh / later session
- visible fidelity state
- source provenance
- structured seven-stage editor
- teacher-ready PDF export from the latest saved validated lesson

The PDF includes:
- official KAEC-NG branding
- lesson metadata
- all seven HQLS stages
- Guide Guardrails
- evidence to notice
- Full Illumination
- reflection and transfer
- discreet HQLS validation status

## 9. Security, provenance and branding

- all records remain workspace-scoped under RLS
- API routes authenticate the real Supabase user token
- resources must be readable under existing RLS/storage rules
- `OPENAI_API_KEY` remains server-only
- AI runs record engine/prompt/provider/model/status/input summary
- resource links are recorded in `artifact_resource_links`
- no service-role key is required for normal teacher generation/export
- the founder-supplied official KAEC-NG logo is the canonical KSI mark

## 10. Live acceptance

All functional Stage 2 acceptance gates passed:

- [x] branch starts from merged Stage 1 main
- [x] essential and optional lesson context
- [x] server-only OpenAI configuration
- [x] Responses API Structured Outputs
- [x] exact seven-stage schema
- [x] deterministic fidelity validation
- [x] repair-or-reject behavior
- [x] lesson + seven stages persistence
- [x] engine/prompt/provider/model provenance
- [x] secure system fidelity persistence
- [x] saved/reopen flow
- [x] true manual edit/save/reopen; `manual_edit` artifact version persisted
- [x] stage regeneration; database proof confirms only selected Indices Stage 3 changed
- [x] resource-grounded generation using `HQLS Eng wk 3 lesson 1.pdf`
- [x] resource provenance persisted
- [x] legacy prompt-v1.0 lesson compatibility
- [x] cross-account/workspace isolation
- [x] dashboard entry
- [x] useful error states
- [x] official KAEC-NG favicon
- [x] teacher-ready branded PDF export
- [x] PDF logo/divider placement
- [x] lint
- [x] strict TypeScript
- [x] constitutional structure verification
- [x] production build
- [x] dependency audit
- [x] authenticated live OpenAI generation

## 11. Final cosmetic correction

The black transparency matte behind the KAEC-NG logo in generated PDFs has been removed in code by compositing the founder-supplied transparent official logo onto the white PDF page before JPEG embedding.

This is cosmetic only; it changes no HQLS logic, security, persistence or AI behavior. The correction passed the full GitHub engineering gate. Vercel temporarily rejected that final cosmetic preview build because the free-plan build-rate limit was reached again. The founder explicitly requested no further browser retest for this cosmetic correction.

## 12. Governance

Stage 2 is functionally complete and awaits explicit founder approval to merge PR #2.

Stage 3 — Assessment Intelligence must begin from the accepted Stage 2 merge commit, not from an unmerged branch.
