# KAEC School Intelligence — Project State

Updated: 8 August 2026

## Current stage

**Stage 5 — Action & Intervention Intelligence: LIVE ACCEPTANCE PASSED / READY FOR MERGE**

Stage 0 Product Constitution v1.1 remains approved and frozen.

Stages 1–4 are complete and merged. Stage 5 completes the governed KSI learning loop without introducing a fourth intelligence engine.

## Repository

- GitHub: `synsynlele/kaec-school-intelligence`
- Default branch: `main`
- Stage 5 branch: `stage-5-action-intervention-intelligence`
- Stage 5 PR: `#6 — Stage 5 — Action & Intervention Intelligence`
- Stage 5 base: `00597234403edab6261fd08eaa2f3f12583a71e7`
- Verified Stage 5 head before merge: `9f23d9b210b3b6bd02ef11eb0ef62bd6cfc6bb70`

## Product scope

Version 1 remains locked to three intelligence engines:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

Stage 5 is the governed handoff layer connecting those engines through the constitutional loop:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

KSI is not a school ERP.

## Stage 5 accepted behaviour

A final diagnosis can now produce one practical intervention handoff containing:

- Priority Growth Target
- Evidence Basis
- School Intervention
- Parent Intervention
- Overall Timeframe
- Success Indicator
- Review Date / Checkpoint
- Next Learning Adjustment

The intervention begins as a draft and requires explicit human confirmation before it becomes authoritative. Confirmed intervention content is immutable and retained as durable audit history.

A confirmed intervention can then feed the existing HQLS Lesson Intelligence engine. The teacher still selects the next lesson Subject, Topic, Objective and Duration. KSI supplies the intervention as private, class-safe differentiation context rather than exposing or singling out the learner.

The generated HQLS lesson is linked back to the intervention handoff and duplicate next-lesson generation from the same confirmed intervention is blocked.

## Stage 5 live acceptance

Manual Vercel deployment:

- deployment: `dpl_CmJXiydy6i44wNJZUhPw85kG1ndP`
- branch: `stage-5-action-intervention-intelligence`
- deployment commit: `acee75bda43c0c7a5ff77ca083735275b8c43165`
- status: READY

Founder live acceptance proved:

- final diagnosis appeared in Interventions: PASS
- intervention draft creation: PASS
- intervention review/edit/save: PASS
- intervention confirmation and lock: PASS
- confirmed handoff entered next-HQLS flow: PASS
- `/api/hqls` intervention generation request: HTTP 200
- new lesson created and validated: PASS
- intervention linked to exact new lesson ID: PASS
- duplicate generation prevention: PASS
- generated lesson reflected the intervention: PASS
- learner was not named or singled out inside the HQLS lesson: PASS

Accepted generated lesson during live proof:

- title: `Who, What, Whose? Practising Pronouns with Drawing and Numbered Steps`
- lesson id: `4a29afd2-27e2-4c54-9002-228d35a9d0e8`
- status: `validated`

The lesson demonstrably incorporated the intervention's English communication target, emotion-regulation routines, mathematical sequencing strength and creative/drawing strength across the seven constitutional HQLS stages without naming the target learner.

The final UX clarification commit `9f23d9b210b3b6bd02ef11eb0ef62bd6cfc6bb70` improves the intervention screen wording so an already-generated/linked lesson is clearly surfaced instead of appearing as if generation failed. This commit intentionally uses `[skip vercel]`; the underlying closed-loop behaviour was already proven live.

## Stage 5 database

Applied migrations:

1. `021_stage5_intervention_handoff.sql`
2. `022_stage5_handoff_actor_indexes.sql`
3. `023_stage5_confirmed_handoff_retention.sql`

Verified guarantees:

- RLS enabled;
- anon access revoked;
- final-diagnosis-only provenance;
- one intervention per diagnosis;
- diagnosis/workspace/student provenance immutable;
- authenticated confirmation actor/timestamp stamping;
- required fields enforced before confirmation;
- confirmed content immutable;
- confirmed handoffs cannot be deleted by product users;
- owner/admin may delete accidental drafts only;
- next lesson must belong to the same workspace;
- first linked lesson is immutable;
- rollback proofs left no test rows.

## Engineering verification

The final Stage 5 UX clarification head `9f23d9b210b3b6bd02ef11eb0ef62bd6cfc6bb70` passed KSI CI run `31270049741` / run #429:

- dependency installation: PASS
- lint: PASS
- strict TypeScript: PASS
- Stage 2–5 constitutional structure verification: PASS
- production build: PASS
- dependency audit: PASS

Stage 5 is accepted and may be merged. The next stage must begin only from the resulting merged `main` head and must remain inside the frozen Product Constitution unless the constitution is explicitly amended.