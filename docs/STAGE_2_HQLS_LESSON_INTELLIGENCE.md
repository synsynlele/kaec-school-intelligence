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
- the formal lesson topic remains concealed from learners through Stages 1–4
- Stages 1–4 operate as one connected suspense flow: Curiosity & Meaning → Crude Thinking → Minimal Clarity → First Attempt
- Awakening uses a vivid scenario, story, headline, image, object, quotation or real-life dilemma plus at most one central provocative question
- Exploration may use 3–5 short oral critical-thinking questions to surface crude meanings, reasons, assumptions and life connections; no correction or formal product yet
- Micro-Illumination provides minimal orientation and may add up to three guiding questions for Trial 1; it must not become teaching or a separate learner activity
- Trial — First Attempt is the first real collaborative task, with 2–4 clear outputs, explicit expected struggle and clear teacher "must not" guardrails
- related clues may appear before Stage 5, but the formal topic name remains concealed through Stage 4
- Full Illumination is the reveal and contains a proper teacher-ready lesson note, including correct explanation, key ideas/vocabulary or process, application, summary and common mistakes corrected
- Trial — Second Attempt returns to the same first-attempt material or a close equivalent so improvement is visible
- Integration includes changed-thinking reflection, an identity connection and a concrete real-life assignment/application
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

## 6. Independent Validation — HQLS fidelity

Deterministic validation runs after generation and after repair.

The generator contract governs qualitative lesson design such as imagination, suspense, scenario quality and whether the tiny clue genuinely prepares the coming trial. The deterministic validator is deliberately limited to rules that can be checked reliably from structured output instead of rejecting good pedagogy because a particular keyword was absent.

It verifies the constitutional sequence and enforceable laws, including:
- Awakening does not dump teaching, assign the first task or exceed the one-central-question boundary
- Exploration remains oral crude thinking, permits several short questions and withholds correction, group work and formal products
- Micro-Illumination may contain minimal orientation, several guiding prompts and light learner thinking/responses; it cannot become full teaching, solution-giving or a separate formal learner task. Fidelity is checked by function, not by counting learner-action lines
- the formal topic name is blocked throughout Stages 1–4, including a core topic phrase derived from generic labels such as "Vocabulary Development: Words associated with..."
- Trial 1 structurally requires pairs/small-team collaboration, contribution from learners, one shared response and productive struggle; the intellectual quality of the challenge remains governed by the generation contract
- Trial 2 must link back to the first attempt and make improvement observable
- Integration must contain reflection, identity connection and real-life transfer
- Full Illumination teaches only after Trial 1
- Trial 2 requires genuine re-application and observable improvement
- Integration contains changed-thinking reflection and transfer
- learner cognitive ownership remains visible

A targeted repair is attempted first when only one or two stages fail. If that repair still leaves the lesson invalid, KSI performs one final full-lesson repair before rejecting the generation. Still-invalid output is rejected.

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
- [x] Authenticated live OpenAI generation E2E

## 11. Final cosmetic correction

The black transparency matte behind the KAEC-NG logo in generated PDFs has been removed in code by compositing the founder-supplied transparent official logo onto the white PDF page before JPEG embedding.

This is cosmetic only; it changes no HQLS logic, security, persistence or AI behavior. The correction passed the full GitHub engineering gate. Vercel temporarily rejected that final cosmetic preview build because the free-plan build-rate limit was reached again. The founder explicitly requested no further browser retest for this cosmetic correction.

## 12. Governance

Stage 2 is functionally complete and awaits explicit founder approval to merge PR #2.

Stage 3 — Assessment Intelligence must begin from the accepted Stage 2 merge commit, not from an unmerged branch.
