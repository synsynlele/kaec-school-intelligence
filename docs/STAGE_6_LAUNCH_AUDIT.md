# Stage 6 — Version 1 Launch Audit

Updated: 8 August 2026

## Status

**IN PROGRESS — FIRST INTEGRATION CHECKPOINT GREEN**

Stage 6 begins from merged Stage 5 head `b4567d1ba8af418467023a4a4ba877f8b1ede3a4`.

## 1. Intervention → Next HQLS Lesson

### Data relationship

PASS.

`intervention_handoffs.next_lesson_id` preserves the exact generated lesson and prevents duplicate replacement after confirmation.

### Live generation

PASS from Stage 5 acceptance.

The confirmed intervention generated validated HQLS lesson `4a29afd2-27e2-4c54-9002-228d35a9d0e8` through the existing `/api/hqls` route and linked it back to the intervention.

### Navigation continuity

Stage 6 fix implemented.

- HQLS now supports exact artifact URLs using `/hqls?lesson=<lesson-id>`.
- The requested lesson must already be visible in the active workspace before it is opened.
- Selecting/opening an HQLS lesson updates the URL to the exact artifact.
- Successful intervention-based generation routes directly to the exact new HQLS lesson.
- The fallback Open Generated HQLS Lesson action uses the exact lesson URL.

Engineering checkpoint: PASS.

## 2. HQLS Lesson → Assessment

### Data relationship

PASS.

Assessment persistence already contains `source_lesson_id` and the live world-class Assessment Intelligence client already supports selecting a validated HQLS lesson and carrying its topic, objective, subject, class and age context into the assessment blueprint.

### Navigation continuity

OPEN.

The HQLS workspace does not yet provide an exact source-lesson handoff into the live `/assessment` route, and the live `WorldClassAssessmentClient` does not yet consume a source lesson from the route query.

Required Stage 6 outcome:

- expose Create Assessment from selected HQLS lesson;
- pass the exact lesson ID;
- validate the lesson belongs to the active workspace and is eligible;
- prefill the live world-class assessment blueprint through the existing `applySourceLesson` path.

No new assessment engine or data model is required.

## 3. Assessment / Evidence → Diagnosis

### Data relationship

PASS.

Diagnosis already supports Assessment-Based and Combined modes and persists `assessment_id`. The Diagnosis workspace loads saved assessments and their items so teachers can enter score and item-level evidence.

### Navigation continuity

OPEN.

A saved assessment currently does not hand the exact assessment into Diagnosis automatically.

Required Stage 6 outcome:

- expose Diagnose from selected saved assessment;
- pass the exact assessment ID;
- validate it is available in the active workspace;
- switch Diagnosis to an assessment-capable mode and preselect that assessment without removing the required student/teacher evidence steps.

No automatic clinical inference or student diagnosis is permitted.

## 4. Diagnosis → Intervention

PASS.

Final diagnoses are the only diagnoses eligible to create intervention handoffs. Diagnosis already exposes Interventions and Stage 5 live acceptance proved the handoff.

## 5. Saved work and durability

PARTIALLY VERIFIED / REGRESSION REQUIRED.

HQLS lessons and assessments are durable database artifacts and the existing Saved Work system provides archive/restore/dependency-safe deletion for those artifact types.

Stage 6 must re-test:

- refresh;
- sign-out/sign-in;
- archived item listing;
- restore;
- dependency-safe permanent deletion;
- exact artifact opening after re-login.

Diagnosis and confirmed intervention history are governed by their dedicated lifecycle/history screens and should not be forced into the lesson/assessment Saved Work RPC merely for UI uniformity.

## 6. Supabase security advisor

### Intentional SECURITY DEFINER warnings

REVIEWED / ACCEPTED BY DESIGN.

`list_archived_saved_work(uuid)` and `manage_saved_artifact(text, uuid, text)` are intentionally callable by `authenticated` users because they are the controlled Saved Work API.

Both functions:

- reject missing `auth.uid()`;
- check workspace membership;
- enforce creator or owner/admin authority where mutation is involved;
- enforce dependency checks before deletion;
- use a fixed search path;
- are not executable by `anon`.

Do not weaken, revoke or convert these functions merely to silence the generic advisor warning unless their product contract changes.

### Leaked password protection

OPEN LAUNCH CONFIGURATION GATE.

Supabase currently reports leaked-password protection disabled for the email/password fallback. Google OAuth remains the primary authentication path.

Before public Version 1 launch, either:

1. enable leaked-password protection if the project's Supabase plan supports it; or
2. explicitly accept/document the fallback-password risk and enforce the strongest available password requirements.

This is an Auth configuration decision, not a database migration.

## 7. Supabase performance advisor

NO CURRENT LAUNCH BLOCKER.

Current findings are INFO-level unused-index notices, including new Stage 5 indexes and several long-lived foreign-key/provenance indexes. This environment has very little traffic, so zero usage is not evidence that these indexes are unnecessary.

Do not delete integrity/query-support indexes purely to clear the advisor before meaningful production workload exists.

## 8. Product-facing release language

IN PROGRESS.

Stage 6 has removed internal development-stage wording from the Dashboard and top-level Intervention / Closed Learning Loop headers. Remaining core surfaces should be checked for developer-stage labels before launch.

## 9. Stage 6 permanent verification

PASS at first checkpoint.

`scripts/verify-stage6.mjs` is now included in `npm run verify:structure` and protects:

- the three-engine constitutional boundary;
- the Stage 6 release contract;
- exact intervention → HQLS deep-link behavior;
- active-workspace verification before opening a linked HQLS lesson;
- existing HQLS → Assessment source provenance;
- existing Assessment → Diagnosis evidence provenance;
- the no-duplicate intervention lesson-link contract.

## Next engineering slice

1. Complete exact HQLS → live WorldClassAssessment handoff.
2. Complete exact Assessment → Diagnosis handoff.
3. Add exact linked-lesson URL to the confirmed-intervention history action.
4. Re-run CI.
5. Audit user-facing failure/recovery messages and mobile core navigation.
6. Create one deliberate Stage 6 Preview only after the integration slice is green.
