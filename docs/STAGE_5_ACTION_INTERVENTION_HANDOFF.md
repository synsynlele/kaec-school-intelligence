# KSI Stage 5 — Action & Intervention Handoff

## Constitutional role

Stage 5 is a supporting capability inside the approved KSI closed learning loop. It is **not a fourth intelligence engine**.

The authoritative loop is:

**Lesson → Assessment → Evidence → Diagnosis → Action / Intervention → Next Lesson**

The three core intelligence engines remain:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

Stage 5 connects the approved output of Student Diagnosis Intelligence back into HQLS Lesson Intelligence without introducing a parallel generator or a second diagnosis process.

## MVP outcome

**Final Diagnosis → Intervention Handoff → Human Confirmation → Next HQLS Lesson**

A final diagnosis may create one governed intervention handoff. The handoff records what the school and parent should do, what improvement should become observable, when the checkpoint should occur, and how the next HQLS lesson should deliberately create another evidence opportunity.

## Entry gate

Only a diagnosis with `status = final` may create an intervention handoff.

The final diagnosis remains the evidence authority. Stage 5 must not:

- reinterpret the learner through a new AI engine;
- invent new evidence;
- introduce clinical or psychological conclusions;
- alter a final diagnosis;
- silently replace the school/parent actions already approved in Stage 4.

## Intervention handoff fields

Each handoff contains:

- Priority Growth Target
- Evidence Basis
- School Intervention
- Parent Intervention
- Overall Timeframe
- Success Indicator
- Review Date / Checkpoint
- Next Learning Adjustment
- Human confirmation metadata
- Optional linked next HQLS lesson

## Derivation rule

The initial intervention draft is derived deterministically from the approved final diagnosis:

- `builder_growth_direction` is the preferred priority target;
- diagnosis challenges and concise diagnosis provide fallbacks and evidence context;
- approved school actions become school interventions;
- approved parent actions become parent interventions;
- the review checkpoint defaults to 14 days and remains editable before confirmation;
- the next learning adjustment translates the approved growth direction into HQLS-compatible teaching guidance.

This deterministic derivation deliberately avoids paying for, auditing, or governing another AI generation pass.

## Human control

The intervention begins as `draft`.

A workspace member may review and edit the draft. Confirmation is an explicit human action.

A handoff cannot be confirmed unless it contains:

- a non-empty growth target;
- evidence basis;
- at least one school intervention;
- timeframe;
- success indicator;
- review date;
- next learning adjustment.

On confirmation, KSI records `confirmed_by` and `confirmed_at`.

Confirmed intervention content is immutable. If the evidence materially changes, the school must start a new diagnosis cycle rather than rewrite an already approved intervention.

## Provenance and tenant boundaries

The handoff is permanently linked to exactly one final diagnosis and its student/workspace boundary.

Database enforcement must block:

- creation from non-final diagnosis;
- diagnosis/student/workspace mismatch;
- later movement to another diagnosis or learner;
- linking a next lesson from another workspace;
- linking an unconfirmed intervention to a lesson;
- changing the confirmed intervention after confirmation;
- replacing an already-linked next lesson with a different lesson.

RLS is mandatory. `anon` must have no access to the intervention table.

## Next HQLS lesson handoff

A confirmed intervention may feed the **existing** `/api/hqls` generation path.

Stage 5 must not copy or fork the HQLS engine.

The teacher supplies the normal next-lesson academic context:

- Subject
- Topic
- Lesson Objective
- Duration

KSI then supplies the confirmed intervention as private class context and teacher guidance.

The handoff must preserve learner dignity:

- do not name the target learner inside generated class lesson content;
- do not label or single out a learner;
- translate the intervention into inclusive differentiation appropriate for the whole class;
- preserve HQLS productive struggle and the seven-stage constitutional sequence;
- make the target capability or behaviour observable again through learner work.

After the existing HQLS engine creates the lesson, Stage 5 stores the returned lesson id as `next_lesson_id` on the confirmed handoff.

This creates an auditable database chain:

**Final Diagnosis → Confirmed Intervention → Next HQLS Lesson**

## MVP non-goals

Stage 5 does not add:

- a fourth AI engine;
- autonomous intervention approval;
- medical, clinical or psychological intervention;
- complex case-management workflows;
- intervention chat or messaging;
- longitudinal analytics dashboards;
- automatic parent notifications;
- automatic lesson generation without a teacher choosing the next topic/objective.

Those may be considered only after the closed-loop MVP is proven.

## Deployment discipline

Intermediate Stage 5 commits use `[skip vercel]` and must still pass GitHub CI.

A Vercel preview should be created only at a deliberate Stage 5 checkpoint after:

- migration and RLS verification;
- deterministic derivation verification;
- intervention draft/save/confirm verification;
- confirmed-handoff → existing HQLS generation verification;
- linked lesson verification;
- Stage 1–4 regression checks.
