# KAEC School Intelligence — Stage 4: Student Diagnosis Intelligence

Status: **IN PROGRESS — constitutional implementation contract**

Base: Stage 3 merge commit `7ed108f8f493c1df3ebad2318cbfb2bd25234dc8`.

## Goal

Turn real student evidence into an educational diagnosis that clearly separates what was observed from what KSI infers and what the school/parent should do next.

The Stage 4 loop is:

**Student + Evidence → Diagnosis Draft → Teacher Review/Edit → Approval → Parent Report**

Stage 4 does not build a medical, psychiatric, psychological, personality or character-labelling system.

## Constitutional reasoning hierarchy

Every generated diagnosis must preserve:

**Observed Evidence → Detected Pattern → Possible Interpretation → Recommended Action**

If the evidence does not support a conclusion, KSI must state **Insufficient Evidence**.

### Evidence

Observed evidence is factual and attributable. It may come from:

- assessment score;
- assessment-item performance;
- teacher observation;
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
- at least two factual teacher observations.

Assessment evidence is optional.

### 2. Assessment-Based Diagnosis

Required:

- one active student;
- one saved assessment;
- assessment score and/or item-level evidence.

Teacher observations are optional.

### 3. Combined Diagnosis

Required:

- one active student;
- one saved assessment with score/item evidence;
- at least one factual teacher observation.

## Evidence capture

Stage 4 records new evidence into `student_evidence` before diagnosis generation.

Supported capture in the first Stage 4 UI:

- overall assessment score (`score`);
- item-level awarded marks (`item_result`);
- teacher observations (`observation`).

Item evidence preserves assessment item/topic/objective/maximum-mark context so Diagnosis can reason from actual learning evidence rather than only a percentage.

## Diagnosis structured output

Engine version: `DIAGNOSIS_ENGINE_v1.0`  
Prompt version: `DIAGNOSIS_PROMPT_v1.0`

Required generated fields:

- `observedEvidence[]`
  - evidence ID
  - source
  - domain (`academic`, `skill`, `character`)
  - factual statement
- `detectedPatterns[]`
  - statement
  - evidence IDs
  - confidence
- `possibleInterpretations[]`
  - statement
  - evidence IDs
  - confidence
  - uncertainty note
- Academics / Skills strengths
- Academics / Skills challenges
- Character (Discipline) strengths
- Character (Discipline) challenges
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

Existing database lifecycle remains authoritative:

`draft → reviewed → final → archived`

- Generated diagnosis starts as `draft`.
- Draft content may be edited by an authorised workspace member.
- `review_diagnosis(...)` records the authenticated human reviewer.
- Final approval requires workspace owner/admin through `finalise_diagnosis(...)`.
- Reviewer/finaliser identity is derived from `auth.uid()`; the browser cannot forge it.
- Final diagnosis content cannot be silently edited by an ordinary member.

Required parent-report flow:

**Generate → Teacher Review → Edit if needed → Mark Reviewed → Owner/Admin Approve → Preview Parent Report → Download**

Stage 4 does not automatically send reports to parents.

## Parent-facing report

The branded KAEC-NG parent report preserves:

- student details;
- Academics / Skills strengths and challenges;
- Character (Discipline) strengths and challenges;
- concise Diagnosis;
- Action Plan — Academics / Skills: School and Parents;
- Action Plan — Character: School and Parents;
- Builder Growth Direction;
- Encouragement Note;
- prepared/reviewed/approved information and dates.

The parent report must not expose internal prompt text, provider/model details, raw database IDs, private internal confidence mechanics or speculative notes that were not approved for parent communication.

PDF download is permitted only for `final` diagnoses. Preview is permitted after human review.

## Traceability and provenance

Stage 4 preserves:

**Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention**

Diagnosis persistence includes:

- student ID;
- optional assessment ID;
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

The workspace should provide:

- mode selection;
- student selection;
- assessment selection when required;
- simple overall-score capture;
- optional item-level mark capture;
- factual teacher-observation entry;
- generated structured diagnosis review/edit;
- saved diagnosis history;
- Review / Approve state controls;
- Parent Report preview/download.

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
- two or more factual observations persist as evidence;
- generated draft separates evidence/pattern/interpretation/action;
- unsupported certainty is absent;
- save/reopen/edit passes.

### Assessment-Based
- selected assessment and student are same-workspace;
- score/item evidence persists with assessment provenance;
- generated diagnosis cites the actual evidence IDs;
- item/topic patterns are traceable to assessment evidence.

### Combined
- both teacher observation and assessment evidence are represented;
- conclusions do not exceed evidence.

### Review/approval
- ordinary member can mark a draft Reviewed;
- reviewer identity is authentic;
- ordinary member cannot Finalise;
- owner/admin can Finalise only after review;
- final content is protected from ordinary-member mutation.

### Parent report
- reviewed preview matches reviewed content;
- final PDF matches final content;
- official KAEC-NG branding is used;
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