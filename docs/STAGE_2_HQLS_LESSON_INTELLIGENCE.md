# KAEC School Intelligence — Stage 2 HQLS Lesson Intelligence

Status: IN PROGRESS  
Branch: `stage-2-hqls-lesson-intelligence`  
Base: merged Stage 1 `main` @ `4e1bdfb973bc4761895c84730fd5dcec0f0f9ad1`  
Constitution: `docs/PRODUCT_CONSTITUTION.md` v1.1 APPROVED

## 1. Purpose

Stage 2 turns the verified Stage 1 platform foundation into the first complete KSI intelligence engine: **HQLS Lesson Intelligence**.

The teacher flow is:

**Give lesson context → Generate seven-stage HQLS lesson → Validate fidelity → Repair if needed → Review/Edit → Save/Version → Reopen later**

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

Immutable roles:

- learner = Hero
- teacher = Guide
- problem = Villain

Non-negotiables:

- no full teaching before first meaningful struggle
- no struggle without guardrails
- no second attempt without illumination
- no learning without reflection
- learner thinking must remain visible
- teacher restraint must protect cognitive ownership
- dignity must remain intact

There is no HQLS Lite path.

## 3. Required inputs

Basic generation requires:

- subject
- topic
- class level
- age or age range
- lesson duration
- lesson objective

Optional advanced context may include:

- previous learning
- available resources / constraints
- class context
- teacher instructions
- selected workspace curriculum, scheme, notes or reference resources

The UI must use progressive disclosure rather than presenting one long form.

## 4. Structured output contract

The AI response must be structured, schema-validated data rather than one prose block.

Each of the seven stage objects contains:

- stage number, key and title
- learning experience / task
- exact teacher prompts or actions where useful
- expected learner actions
- Guide Guardrails
- evidence for the teacher to notice
- productive struggle where relevant
- teaching content where relevant
- explicit connection from Full Illumination to gaps exposed in Trial 1
- transfer / real-life task where relevant

Stage 5 teaching must be sufficient for clarity but concise and targeted. It must not become a lecture dump or erase learner ownership.

## 5. Generation architecture

Stage 2 must follow the constitutional orchestration hierarchy:

**Constitutional Rules → HQLS Module Rules → School/Resource Context → User Request → Structured Generation → Independent Validation → Repair**

Rules:

- AI credentials remain server-side.
- Provider/model can be changed without rewriting HQLS constitutional rules.
- Engine and prompt versions are explicit and persisted.
- Selected source resources are workspace-scoped and provenance is persisted.
- The browser never receives the provider API key.

Initial provider adapter: Google Gemini API, with model configurable by server environment. The HQLS engine remains provider-independent at the contract layer.

## 6. Fidelity validator

A model claiming its own output is valid is insufficient.

Stage 2 uses deterministic constitutional validation after structured generation. Validation checks include:

- exactly seven stages in exact order
- Awakening contains no content dump / premature teaching
- Exploration protects crude thinking and avoids early correction
- Micro-Illumination remains minimal
- Trial 1 contains real productive struggle and no rescue
- Full Illumination contains teaching after effort and responds to Trial 1 gaps
- Trial 2 requires genuine re-application and observable improvement
- Integration contains reflection and transfer
- learner actions are present and teacher cognitive ownership does not dominate

If validation fails, the server runs a repair pass and validates again. A lesson that still fails is not persisted or presented as HQLS-complete.

Every accepted generation writes an `hqls_fidelity_checks` record.

## 7. Editing and regeneration

Teachers may edit any generated stage.

Required Stage 2 controls:

- Save edits
- Improve
- Simplify
- Increase Challenge
- Make More Practical
- Reduce Resource Dependence
- Regenerate

Regeneration is stage-level whenever possible. It changes only the explicitly selected stage and must not silently overwrite manual edits elsewhere.

Every manual save or AI regeneration creates an artifact version.

## 8. Saved lesson experience

Stage 2 must support:

- list recent/saved lessons in the active workspace
- reopen a lesson after refresh or re-login
- display all seven stages as structured cards/sections
- show HQLS fidelity status and violations/evidence when relevant
- show source resource labels/provenance
- preserve draft vs validated lesson status

No output should appear as an undifferentiated AI wall of text.

## 9. Security and provenance

- All lesson, stage, resource, fidelity, artifact-version and AI-run writes remain workspace-scoped under RLS.
- API routes authenticate the real Supabase user token before generation.
- Selected resources must be readable by the authenticated user under existing RLS/storage rules.
- AI runs record engine version, prompt version, provider/model, status and input summary.
- Generated lesson rows record engine and prompt versions.
- Resource links are recorded in `artifact_resource_links`.
- No service-role key is required for normal teacher generation.

## 10. Stage 2 UI

Primary route: `/hqls`

The surface should remain calm and teacher-facing:

- essential lesson context first
- optional advanced context collapsed/disclosed separately
- clear Generate HQLS Lesson action
- saved lesson list / recent work
- seven structured stage cards
- explicit Edit / Save controls
- stage-level AI actions
- fidelity status visible but not noisy

Dashboard HQLS Lesson Intelligence card becomes an active entry point. Assessment and Diagnosis cards remain future stages.

## 11. Stage 2 exit criteria

Stage 2 is complete only when all of the following are proven:

- [ ] Stage 2 branch starts from merged Stage 1 main.
- [ ] Required lesson inputs and progressive optional context are implemented.
- [ ] AI provider key remains server-side.
- [ ] Structured seven-stage schema is enforced before persistence.
- [ ] Deterministic HQLS fidelity validation is independent of generator self-claims.
- [ ] Failed generation is repaired or rejected rather than presented as compliant.
- [ ] Valid generation persists lesson + seven stage rows.
- [ ] Engine/prompt/provider/model provenance is persisted.
- [ ] HQLS fidelity check is persisted.
- [ ] Selected resource provenance is persisted.
- [ ] Saved lesson survives refresh/re-login.
- [ ] Manual stage edits save and create an artifact version.
- [ ] Stage-level regeneration works without overwriting other stages.
- [ ] Generated lesson can be reopened from saved work.
- [ ] Cross-workspace lesson/resource isolation still holds.
- [ ] Dashboard entry point works.
- [ ] Error states are recoverable and understandable.
- [ ] Desktop/mobile remain usable.
- [ ] Lint passes.
- [ ] Strict TypeScript passes.
- [ ] Constitutional structure check passes.
- [ ] Production build passes.
- [ ] High-severity dependency audit passes.
- [ ] Matching Vercel Preview is READY.
- [ ] Authenticated live Gemini generation E2E passes against the dedicated KSI environment.
- [ ] Stage 2 completion report records exact accepted head and live evidence.

## 12. Explicitly out of scope

Do not add in Stage 2:

- Assessment Generator implementation
- Diagnosis Generator implementation
- school ERP features
- parent/student portals
- classroom observation product UI
- teacher certification
- PipuPath

Stage 2 must strengthen the first engine without reopening or diluting the verified Stage 1 platform foundation.
