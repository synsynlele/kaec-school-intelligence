# KAEC School Intelligence — Stage 3 Assessment Intelligence

Status: IN PROGRESS — v1.1 ACCEPTANCE  
Branch: `stage-3-assessment-intelligence`  
Base: cost-optimised merged `main`  
Constitution: `docs/PRODUCT_CONSTITUTION.md` v1.1 APPROVED

## 1. Purpose

Stage 3 turns lesson context, selected HQLS learning, multiple topics/objectives and authorised school resources into a structured, editable, saved and exportable assessment that reveals learning rather than merely producing questions.

Core flow:

**Choose lesson/context → Design weighted assessment blueprint → Generate structured items → Independent Validation → Review/Edit → Save/Version → Reopen → Export**

When an HQLS lesson is selected, `Lesson → Assessment` traceability persists without limiting the assessment to only one topic.

Diagnosis Intelligence remains Stage 4 and is explicitly outside this branch.

## 2. Assessment constitution

Assessment exists to reveal understanding, guide growth, inform instruction and build responsibility. It must not rank human worth, reward memorisation as the dominant mode, create fear or replace teaching.

KSI supports both:

- **Academic Mastery**
- **Human Capability Evidence** where an item genuinely reveals reasoning, explanation, problem-solving, creation, reflection or responsibility

Initial question/item formats:

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

Every item preserves, where applicable:

- topic
- objective
- competency/capability target
- difficulty
- item type
- marks
- expected evidence
- answer key or marking guide

## 3. Assessment type is separate from question format

Stage 3 v1.1 distinguishes **what the assessment is** from **what kinds of questions it contains**.

Assessment type:

- Assignment
- Quiz
- Test
- Examination
- Project

Question format may independently be:

- Objective only
- Subjective only
- Critical Thinking only
- Project only
- Mixed

For example, an Examination may contain mixed formats, while a Quiz may be objective-only. The assessment type must influence breadth, depth, workload and marking expectations without silently overriding a teacher's chosen question format.

## 4. Multi-topic weighted assessment blueprint

A single assessment may contain multiple topics.

Each requested topic must contain:

- topic name
- one or more assessable objectives where available
- explicit percentage weighting

Rules:

- one to twelve topics per assessment
- topic names must be unique
- topic weights must total exactly 100%
- every requested topic must be meaningfully assessed
- weighting should be reflected primarily through marks, not superficial topic mentions
- every generated item must map clearly to one of the requested topics
- generated blueprint coverage must match the actual persisted items

Selecting one source HQLS lesson may prefill one topic/objective, but the teacher can add more topics before generation.

## 5. Overall difficulty

The teacher chooses one overall difficulty:

- Easy
- Medium
- Hard

Item-level difficulty continues to use the internal structured levels:

- easy
- moderate
- challenging

Target profiles are approximate rather than mechanical:

- **Easy:** mostly accessible items, limited challenging demand
- **Medium:** balanced profile centred on moderate demand
- **Hard:** substantial challenging demand with limited easy items

The deterministic validator checks that the generated item profile is compatible with the requested overall difficulty.

## 6. World-class assessment quality standard

Stage 3 v1.1 adopts `KAEC_ASSESSMENT_QUALITY_v1.0` around these principles:

### Validity

- assess the intended taught knowledge, skill, reasoning or capability
- maintain alignment with supplied topics, objectives, HQLS lesson and authorised resources
- do not substitute irrelevant literacy, test-taking tricks or unrelated knowledge for the intended construct

### Reliability

- answer keys and marking guides must be internally consistent
- non-objective tasks must include observable marking criteria
- guidance should be clear enough for another competent teacher to mark consistently

### Fairness and accessibility

- age-appropriate, clear wording
- no irrelevant cultural, financial, disability, gender or emotional barriers
- no stereotypes or trick wording
- no hidden requirements unrelated to the intended learning

### Manageability

- workload should be credible for the assessment type, duration, marks and class level
- marks should reflect the evidence demanded

### Coverage and cognitive demand

- requested topics/objectives must be represented
- recall must not dominate merely because objective questions are requested
- assessment should include suitable progression into application, analysis/reasoning and, where appropriate, evaluation/creation
- critical-thinking items must require genuine reasoning, choice, problem identification or creation

### Item quality

- no duplicate or effectively identical prompts
- objective options must be distinct and plausible
- exactly one intended objective answer must be uniquely identifiable
- project assessments must contain an observable project deliverable

## 7. Assessment inputs

Required teacher context:

- workspace
- subject
- class
- age/age range
- assessment title
- assessment type
- overall difficulty
- at least one topic
- topic weighting totalling 100%
- question format
- total requested items

Progressive/optional context:

- objectives for each topic
- source HQLS lesson
- authorised private/workspace resources
- purpose/student instructions
- duration
- total marks
- mixed question-format counts
- teacher constraints

The interface must remain usable on desktop and mobile. Essential controls appear first; source/context controls remain progressive.

## 8. Generated structured blueprint

Before persistence, every generated assessment includes a structured blueprint describing:

- covered topics/objectives
- intended mastery evidence
- intended human-capability evidence where applicable
- requested item-type distribution
- item difficulty distribution
- total items
- total marks

Stage 3 v1.1 also persists teacher-requested blueprint metadata:

- `assessmentKind`
- `overallDifficulty`
- `requestedTopics`
- `qualitySummary`
- `KAEC_ASSESSMENT_QUALITY_v1.0`

The persisted blueprint must remain consistent with the actual persisted items.

## 9. Objective items

Objective questions must include:

- clear stem
- at least four plausible, mutually distinct options
- exactly one intended answer
- answer key
- short teacher rationale
- expected evidence

Distractors should reveal likely misunderstanding rather than rely on tricks, grammatical clues or duplicate wording.

## 10. Subjective items

Subjective items must require explanation, working, application or constructed response appropriate to the subject and class.

Each includes:

- prompt
- expected evidence
- marking guide/key points
- marks

## 11. Critical-thinking items

Critical-thinking tasks must require genuine reasoning, choice, problem identification or creation. Renaming a normal recall question as `critical_thinking` is invalid.

Each critical-thinking item must use one KAEC experience type and make learner reasoning observable.

## 12. Project items

Project tasks must produce a concrete observable output or performance and include:

- task/brief
- expected evidence
- deliverable
- constraints where relevant
- marking criteria
- marks

When the overall Assessment type is **Project**, at least one project item/deliverable is mandatory.

## 13. Independent Validation

Generation and validation are separate concerns. The model's self-claim is insufficient.

The deterministic validator rejects or repairs when:

- requested item counts/types do not match
- positions are duplicated/missing
- total marks are inconsistent
- required item metadata is missing
- objective options/answer keys are invalid or duplicated
- subjective/project items lack usable marking guides
- critical-thinking items lack a valid KAEC experience type or are recall disguised as reasoning
- any requested topic is missing
- topic weighting is materially misaligned
- blueprint topic coverage is incomplete
- overall difficulty is materially misaligned
- prompts are duplicated
- a Project assessment lacks a project deliverable

One controlled AI repair pass may follow deterministic validation. If still invalid, do not persist as validated.

## 14. Editing and versioning

Teachers may edit generated assessments before use.

Manual save:

- updates assessment/items under workspace RLS
- revalidates the complete assessment against the v1.1 world-class blueprint
- recomputes quality summary
- creates an `artifact_versions` row with `artifact_type='assessment'`, origin `manual_edit`

A teacher edit must not silently weaken topic coverage, marks consistency, question-format integrity or the world-class quality gate.

## 15. Source and provenance rules

Every successful v1.1 generation persists:

- `assessments`
- ordered `assessment_items`
- `source_lesson_id` when generated from an HQLS lesson
- `ASSESSMENT_ENGINE_v1.1`
- `ASSESSMENT_PROMPT_v1.1`
- OpenAI provider/model through `ai_runs`
- authorised resource links through `artifact_resource_links`
- initial artifact version with origin `generated`
- assessment type, overall difficulty and weighted requested topics in the blueprint

KSI remains configurable through `KSI_OPENAI_MODEL` and defaults to `gpt-5-mini`.

Existing v1.0 assessment artifacts remain readable and exportable.

## 16. Saved assessment experience

Stage 3 supports:

- list saved assessments in the active workspace
- reopen after refresh/re-login
- preserve legacy v1.0 artifacts
- show assessment type/difficulty for v1.1 artifacts
- show ordered editable items
- keep answers/marking guidance separate from student-facing content
- preserve source provenance
- preserve validated/archived state

## 17. Teacher-ready export

A saved validated assessment is exportable as a branded PDF using the official KAEC-NG logo.

The export provides:

- student assessment section without answer keys
- separate teacher answer/marking section
- title, subject and class
- assessment type and overall difficulty for v1.1 assessments
- weighted topic coverage for v1.1 assessments
- duration/marks where available
- ordered questions/tasks and marks
- per-item teacher topic/difficulty metadata
- official KAEC-NG branding

The PDF must reflect the latest saved teacher-reviewed version.

## 18. Security

- authenticate the real Supabase user before generation/edit/export
- preserve workspace RLS on assessments/items/resources
- never expose `OPENAI_API_KEY`
- never use service-role credentials for normal teacher flows
- do not permit cross-workspace source lessons or resources
- preserve source lesson/resource provenance

## 19. Stage 3 v1.1 exit criteria

Stage 3 is complete only when all are proven:

- [x] Branch starts from the cost-optimised merged Stage 2 main.
- [x] Objective, Subjective, Critical Thinking and Project item formats are supported.
- [x] All five KAEC Critical Thinking experience types are supported.
- [x] Assignment, Quiz, Test, Examination and Project assessment types are implemented.
- [x] Easy, Medium and Hard overall difficulty selection is implemented.
- [x] Multiple topics/objectives can be entered in one assessment.
- [x] Topic weighting totals and uniqueness are validated before generation.
- [x] v1.1 generation persists assessment type, overall difficulty and requested topics.
- [x] World-class deterministic validation checks topic coverage, weighting, difficulty and duplicate item/option risks.
- [x] Structured blueprint generation is implemented.
- [x] Invalid generation is repaired or rejected before validated persistence.
- [x] Valid generation persists assessment + ordered items.
- [x] Source HQLS lesson relationship persists when selected.
- [x] Authorised resource grounding/provenance persist.
- [x] AI engine/prompt/provider/model provenance persists.
- [x] Default model remains `gpt-5-mini` unless server environment overrides it.
- [x] Manual edit/save creates an assessment artifact version and revalidates v1.1 quality.
- [x] Teacher-ready PDF includes v1.1 assessment type/difficulty/topic coverage.
- [x] Responsive desktop/mobile v1.1 workspace is implemented.
- [x] Lint passes on implementation head.
- [x] Strict TypeScript passes on implementation head.
- [x] Constitutional + Stage 3 v1.1 structural verification passes.
- [x] Production build passes on implementation head.
- [x] High-severity dependency audit passes on implementation head.
- [x] Matching Vercel Preview is READY on implementation head.
- [ ] Authenticated live v1.1 multi-topic generation passes.
- [ ] Live v1.1 assessment type/difficulty provenance passes.
- [ ] Live weighted topic coverage persists and matches generated items.
- [ ] Live v1.1 save/reopen/edit remains valid.
- [ ] Live v1.1 PDF shows assessment type, difficulty and weighted topic coverage correctly.
- [ ] Cross-workspace v1.1 isolation regression passes.
- [ ] HQLS Stage 2 regression remains green after v1.1 acceptance.

Diagnosis Intelligence remains Stage 4 and is explicitly outside this branch.
