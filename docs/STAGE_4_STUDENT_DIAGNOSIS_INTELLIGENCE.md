# KAEC School Intelligence — Stage 4: Student Diagnosis Intelligence

Status: **IN PROGRESS — KAEC parent-diagnosis acceptance contract**

Base: Stage 3 merge commit `7ed108f8f493c1df3ebad2318cbfb2bd25234dc8`.

## Goal

Turn real student evidence into a diagnosis that gives parents clear first-hand information about their ward academically, practically and in character, while keeping KSI's evidence/uncertainty safeguards behind the school review process.

The Stage 4 loop is:

**Student + First-hand Evidence → Diagnosis Draft → Teacher Review/Edit → Approval → KAEC Parent Diagnosis Sheet**

Stage 4 does not build a medical, psychiatric, psychological, personality or character-labelling system.

## Parent-first product standard

The proven KAEC diagnosis sheet is the parent-facing reference structure. KSI must preserve its practical clarity rather than replacing it with a generic AI report.

The parent report must lead with:

1. **DIAGNOSIS** — a concise evidence-grounded summary.
2. **ACADEMICS / SKILLS**
   - Strengths
   - Challenges
3. **CHARACTER (Discipline)**
   - Strengths
   - Challenges
4. **ACTION PLAN (Academics / Skills)**
   - School
   - Parents
5. **ACTION PLAN (Character)**
   - School
   - Parents
6. Academic Session and Term.
7. School review/approval status.

Builder Growth Direction, Encouragement Note and evidence limitations may follow as supporting growth notes. Internal model/provider information, raw evidence IDs and private confidence mechanics never belong on the primary parent sheet.

## Constitutional reasoning hierarchy

Internally, every generated diagnosis must preserve:

**Observed Evidence → Detected Pattern → Possible Interpretation → Recommended Action**

If the evidence does not support a conclusion, KSI must state **Insufficient Evidence**.

This hierarchy exists to protect the quality of the parent-facing conclusions. It must not make the parent report difficult to understand.

### Evidence

Observed evidence is factual and attributable. It may come from:

- assessment score;
- assessment-item performance;
- first-hand teacher observation;
- teacher-indicated strength evidence;
- teacher-indicated challenge evidence;
- learner reflection already recorded as evidence.

Generated patterns and interpretations are never themselves evidence.

### Patterns

Every detected pattern must:

- cite one or more evidence IDs;
- carry `low`, `medium` or `high` confidence;
- describe recurrence/relationship rather than inventing a cause.

### Possible interpretations

Every possible interpretation must:

- cite supporting evidence IDs;
- carry explicit confidence;
- remain tentative;
- avoid medical/psychiatric/psychological diagnoses and unsupported character claims;
- never state an unsupported cause as fact.

### Actions

Every recommended action must be specific, feasible and linked to an evidence-backed need. School and parent responsibilities remain separate.

## Version 1 modes

### 1. Quick Teacher Diagnosis

Required:

- one active student;
- Academic Session;
- Term;
- at least two first-hand teacher observations/indicators.

The teacher intake deliberately mirrors KAEC's existing diagnosis practice:

- Academic / Skills Observations;
- Character / Discipline Observations;
- Academic / Skills Strength Indicators;
- Academic / Skills Challenge Indicators;
- Character Strength Indicators;
- Character Challenge Indicators;
- optional Additional Factual Notes with an explicit domain.

Assessment evidence is optional.

### 2. Assessment-Based Diagnosis

Required:

- one active student;
- Academic Session;
- Term;
- one saved assessment;
- assessment score and/or item-level evidence.

Teacher observations are optional but may strengthen the diagnosis.

### 3. Combined Diagnosis

Required:

- one active student;
- Academic Session;
- Term;
- one saved assessment with score/item evidence;
- at least one factual teacher observation/indicator.

## Evidence capture

Stage 4 records new evidence into `student_evidence` before diagnosis generation.

Supported capture:

- overall assessment score (`score`);
- item-level awarded marks (`item_result`);
- teacher observations and indicators (`observation`).

Item evidence preserves assessment item/topic/objective/maximum-mark context so Diagnosis can reason from actual learning evidence rather than only a percentage.

Teacher-indicated strengths/challenges are evidence signals, not automatically accepted conclusions. KSI still validates them against the complete supplied evidence before producing the parent sheet.

## Diagnosis structured output

Engine version: `DIAGNOSIS_ENGINE_v1.0`  
Prompt version: `DIAGNOSIS_PROMPT_v1.0`

Required generated fields:

- `observedEvidence[]`
- `detectedPatterns[]`
- `possibleInterpretations[]`
- Academics / Skills strengths
- Academics / Skills challenges
- Character (Discipline) strengths
- Character (Discipline) challenges
- concise Diagnosis
- School actions — Academics / Skills
- Parent actions — Academics / Skills
- School actions — Character
- Parent actions — Character
- Builder Growth Direction
- Encouragement Note
- Evidence Limitations

Strengths/challenges must be evidence-backed. When a domain has inadequate evidence, the generated content must say so instead of creating a conclusion.

## Deterministic diagnosis validator

AI self-declaration is insufficient. Before persistence KSI independently validates:

1. generated evidence IDs exist in the supplied evidence set;
2. patterns cite evidence and have confidence;
3. interpretations cite evidence, have confidence and explicit uncertainty;
4. unsupported medical/psychiatric/psychological/clinical labels are rejected;
5. deterministic/high-certainty causal language without adequate evidence is rejected;
6. strengths/challenges do not cite unsupported domains as facts;
7. school/parent actions are non-empty, concrete and feasible;
8. Evidence Limitations is present;
9. `Insufficient Evidence` appears where a requested domain has no adequate evidence;
10. parent-facing wording remains respectful and readable.

One repair attempt is allowed. Nothing is saved unless the repaired output passes the same validator.

## Human review and approval

Database lifecycle remains authoritative:

`draft → reviewed → final → archived`

- Generated diagnosis starts as `draft`.
- Draft parent-facing content may be edited by an authorised workspace member.
- `review_diagnosis(...)` records the authenticated human reviewer.
- Final approval requires workspace owner/admin through `finalise_diagnosis(...)`.
- Reviewer/finaliser identity is derived from `auth.uid()`; the browser cannot forge it.
- Final diagnosis content cannot be silently edited.
- Changing Academic Session or Term after review also invalidates the review.

Required parent-report flow:

**Generate → Teacher Review → Edit if needed → Mark Reviewed → Owner/Admin Approve → Preview Parent Report → Download**

Stage 4 does not automatically send reports to parents.

## Parent-facing report

The official KAEC-NG parent PDF uses a **landscape diagnosis-sheet matrix** as Page 1:

- official KAEC-NG logo and branding;
- Name;
- Class;
- Academic Session;
- Term;
- concise Diagnosis;
- four Academics/Skills + Character strength/challenge cells;
- four School/Parents action-plan cells;
- digital school approval indicator.

A supporting Growth & Review Notes page may contain:

- Builder Growth Direction;
- Encouragement Note;
- Evidence Limitations;
- assessment/report basis;
- review and approval dates;
- educational-report scope note.

The parent report must not expose internal prompt text, provider/model details, raw database IDs, private internal confidence mechanics or speculative notes that were not approved for parent communication.

PDF download is permitted only for `final` diagnoses.

## Report context persistence

`diagnoses.academic_session` and `diagnoses.term` are first-class reviewed fields.

`set_diagnosis_report_context(...)`:

- requires authenticated active workspace membership;
- requires non-empty Academic Session and Term;
- cannot modify a Final diagnosis;
- participates in review freshness so a change to report period returns Reviewed content to Draft.

## Traceability and provenance

Stage 4 preserves:

**Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention**

Diagnosis persistence includes:

- student ID;
- optional assessment ID;
- Academic Session and Term;
- diagnosis mode;
- structured observed evidence and evidence IDs;
- AI engine/prompt version;
- `ai_runs` provider/model provenance (`gpt-5-mini` under the current deployment policy);
- artifact versions for generation, edit, review and finalisation.

## Security

- Student/evidence/diagnosis reads and writes remain workspace-scoped through RLS.
- No service-role secret is exposed to the browser.
- Cross-workspace student, assessment or evidence IDs are rejected.
- Final approval remains owner/admin only.
- Existing Stage 1 diagnosis authority controls must not be weakened.

## UI / mobile

`/diagnosis` must be usable on desktop and phone.

The workspace must provide:

- mode selection;
- student selection;
- Academic Session and Term;
- KAEC first-hand teacher input sheet;
- assessment selection when required;
- simple overall-score capture;
- optional item-level mark capture;
- internal evidence/pattern/interpretation review;
- editable KAEC parent diagnosis sheet;
- saved diagnosis history;
- Review / Approve state controls;
- final Parent Report preview/download.

## Deployment quota discipline

During active development, intermediate commits may use the commit marker **`[skip vercel]`**. `vercel.json` is configured so those commits still reach GitHub/CI but skip a Vercel build.

A deliberate final checkpoint commit without `[skip vercel]` triggers the Preview build. This keeps development verification rigorous while avoiding unnecessary Hobby-plan deployment consumption.

## Out of scope

Stage 4 does not add:

- parent messaging/portal;
- student portal;
- clinical screening;
- attendance/behaviour management ERP;
- broad school analytics;
- autonomous parent communication;
- Stage 5 intervention-loop automation beyond exposing the approved diagnosis/action output.

## Acceptance gates

### Quick Teacher

- Academic Session and Term persist;
- two or more first-hand observations/indicators persist as evidence;
- generated draft separates evidence/pattern/interpretation/action internally;
- parent sheet clearly separates Academics/Skills and Character strengths/challenges;
- parent sheet clearly separates School and Parents actions;
- save/reopen/edit passes.

### Assessment-Based

- selected assessment and student are same-workspace;
- score/item evidence persists with assessment provenance;
- generated diagnosis cites actual evidence IDs;
- item/topic patterns are traceable to assessment evidence.

### Combined

- teacher input and assessment evidence are both represented;
- conclusions do not exceed evidence.

### Review/approval

- ordinary member can mark a draft Reviewed;
- reviewer identity is authentic;
- ordinary member cannot Finalise;
- owner/admin can Finalise only after review;
- changing reviewed report content/session/term returns it to Draft;
- final content is immutable.

### Parent report

- final Preview matches final content;
- Page 1 visually follows the KAEC diagnosis-sheet matrix;
- final PDF matches final content;
- official KAEC-NG branding is used;
- Session and Term are visible;
- respectful readable wording;
- no internal model/prompt metadata;
- download blocked before Final.

### Platform regression

- HQLS and Assessment remain operational;
- cross-workspace isolation passes;
- strict Structured Outputs remain server-side;
- `gpt-5-mini` remains the configured core generation default;
- desktop/mobile usable;
- lint, strict TypeScript, constitutional verification, production build and dependency audit pass.

Diagnosis Intelligence remains Stage 4 only. Stage 5 will connect approved diagnosis actions back into intervention/next-HQLS generation.
