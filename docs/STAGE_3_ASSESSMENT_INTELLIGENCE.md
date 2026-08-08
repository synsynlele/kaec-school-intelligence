# KAEC School Intelligence — Stage 3 Assessment Intelligence

Status: IN PROGRESS  
Branch: `stage-3-assessment-intelligence`  
Base: cost-optimised merged `main`  
Constitution: `docs/PRODUCT_CONSTITUTION.md` v1.1 APPROVED

## 1. Purpose

Stage 3 turns a teacher's lesson context, selected HQLS lesson and authorised school resources into a structured, editable, saved and exportable assessment that reveals learning rather than merely producing questions.

Core flow:

**Choose lesson/context → Design assessment blueprint → Generate structured items → Independent Validation → Review/Edit → Save/Version → Reopen → Export**

When an HQLS lesson is selected, the relationship `Lesson → Assessment` must persist and carry forward the lesson topic/objective/context without duplicating or weakening Stage 2.

Stage 3 does not implement Student Diagnosis. It prepares the structured assessment object that Stage 4 will later consume with student evidence.

## 2. Assessment constitution

Assessment exists to reveal understanding, guide growth, inform instruction and build responsibility. It must not rank human worth, reward memorisation as the dominant mode, create fear, or replace teaching.

KSI must support:

- Academic Mastery
- Human Capability Evidence where the item can genuinely reveal it

Initial item modes:

- Objective
- Subjective
- Critical Thinking
- Project

Initial KAEC Critical Thinking experience types:

- Reality Simulation
- Imperfect Choice
- Hidden Problem
- Creation
- Crisis

Every assessment item must preserve, where applicable:

- topic
- objective
- competency / capability target
- difficulty
- item type
- marks
- expected evidence
- answer key or marking guide

## 3. Assessment inputs

Required teacher context:

- workspace
- subject
- class
- assessment title
- topic/objective, unless inherited from a selected HQLS lesson
- assessment mode
- total requested items

Optional progressive context:

- source HQLS lesson
- authorised private/workspace resources
- assessment purpose/instructions
- duration
- total marks
- difficulty mix
- requested item-type counts
- teacher constraints

The interface must work on desktop and mobile. Essential controls appear first; advanced controls remain progressive.

## 4. Blueprint

Before persistence, the generated assessment must include a structured blueprint describing:

- covered topics/objectives
- intended mastery evidence
- intended human-capability evidence where applicable
- requested item-type distribution
- difficulty distribution
- total items
- total marks

The blueprint must be internally consistent with the actual persisted items.

## 5. Objective items

Objective questions must include:

- clear stem
- plausible options
- exactly one intended answer unless the item explicitly declares a different objective format in a future version
- answer key
- short rationale for teacher use
- expected evidence

Distractors should diagnose likely misunderstanding rather than rely on tricks.

## 6. Subjective items

Subjective items must require explanation, working, application or constructed response appropriate to the subject and class.

Each must include:

- prompt
- expected evidence
- marking guide / key points
- marks

## 7. Critical-thinking items

Critical-thinking tasks must require genuine reasoning, choice, problem identification or creation. Renaming a normal recall question as `critical_thinking` is invalid.

Each critical-thinking item must use one KAEC experience type and make the learner's reasoning observable.

## 8. Project items

Project tasks must produce a concrete observable output or performance and include:

- task / brief
- expected evidence
- deliverable
- constraints where relevant
- marking criteria
- marks

## 9. Independent validation

Generation and validation are separate concerns. The model's self-claim is not sufficient.

The deterministic Stage 3 validator must reject or repair assessments when:

- requested item counts/types do not match
- item positions are duplicated/missing
- total marks are inconsistent when a total is requested
- required metadata is missing
- objective items lack valid options/answer keys
- subjective/project items lack usable marking guides
- critical-thinking items lack a valid KAEC experience type or are obvious recall masquerading as reasoning
- lesson/resource alignment is missing where a lesson/resource was explicitly selected

One controlled AI repair pass may be used after deterministic validation. If still invalid, do not persist as validated.

## 10. Editing and versioning

Teachers may edit the generated assessment before use.

Manual save:

- updates the assessment/items under workspace RLS
- revalidates the complete assessment
- creates an `artifact_versions` row with `artifact_type='assessment'`, origin `manual_edit`

Stage 3 may support item-level AI improvement/regeneration, but any such action must change only the explicitly selected item and create an artifact version with origin `regeneration`.

## 11. Source and provenance rules

Every successful generation persists:

- `assessments`
- ordered `assessment_items`
- `source_lesson_id` when generated from an HQLS lesson
- engine/prompt versions
- OpenAI provider/model provenance through `ai_runs`
- authorised resource links through `artifact_resource_links`
- initial `artifact_versions` snapshot with origin `generated`

KSI uses the cost-optimised OpenAI model configuration already established before Stage 3. The server adapter remains configurable through `KSI_OPENAI_MODEL` and defaults to `gpt-5-mini`.

## 12. Saved assessment experience

Stage 3 must support:

- list saved assessments in the active workspace
- reopen after refresh/re-login
- show source lesson when present
- show assessment blueprint
- show ordered editable items
- show answers/marking guide separately from student-facing content
- show source resource provenance
- preserve draft/validated/archived state

## 13. Teacher-ready export

A saved validated assessment must be exportable as a teacher-ready branded PDF using the official KAEC-NG logo.

The export should provide:

- clean student assessment section without exposed answer keys
- separate teacher marking/answer section
- title, subject, class, duration/marks where available
- ordered questions/tasks and marks
- official KAEC-NG branding

The export must reflect the latest saved teacher-reviewed version, not a transient AI response.

## 14. Security

- authenticate the real Supabase user before generation/edit/export
- preserve workspace RLS on assessments/items/resources
- never expose `OPENAI_API_KEY`
- never use service-role credentials for normal teacher flows
- do not permit cross-workspace source lessons or resources
- preserve source lesson/resource provenance

## 15. Stage 3 exit criteria

Stage 3 is complete only when all are proven:

- [ ] Branch starts from the cost-optimised merged Stage 2 main.
- [ ] Assessment UI is usable on desktop and mobile.
- [ ] Objective, Subjective, Critical Thinking and Project items are supported.
- [ ] All five KAEC Critical Thinking experience types are supported.
- [ ] Structured blueprint generation is implemented.
- [ ] Deterministic independent assessment validation is implemented.
- [ ] Invalid generation is repaired or rejected before validated persistence.
- [ ] Valid generation persists assessment + ordered item rows.
- [ ] Source HQLS lesson relationship persists when selected.
- [ ] Authorised resource grounding and provenance persist.
- [ ] AI engine/prompt/provider/model provenance persists.
- [ ] Default model remains `gpt-5-mini` unless server environment explicitly overrides it.
- [ ] Saved assessment survives refresh/re-login.
- [ ] Manual edit/save creates an assessment artifact version.
- [ ] Item-level regeneration changes only the selected item, if exposed in Stage 3 UI.
- [ ] Teacher-ready branded PDF export is implemented and excludes answers from the student section.
- [ ] Cross-workspace assessment/source/resource isolation holds.
- [ ] HQLS Stage 2 regression remains green.
- [ ] Lint passes.
- [ ] Strict TypeScript passes.
- [ ] Constitutional structure verification passes.
- [ ] Production build passes.
- [ ] High-severity dependency audit passes.
- [ ] Matching Vercel Preview is READY.
- [ ] Authenticated live OpenAI assessment generation E2E passes.
- [ ] Lesson-derived assessment E2E passes.
- [ ] Resource-grounded assessment E2E passes.
- [ ] Manual edit/save/reopen E2E passes.

Diagnosis Intelligence remains Stage 4 and is explicitly outside this branch.
