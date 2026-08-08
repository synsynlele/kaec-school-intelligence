# Stage 6 — Version 1 Launch Audit

Updated: 8 August 2026

## Status

**IN PROGRESS — EXACT V1 ARTIFACT HANDOFFS GREEN; PREVIEW CHECKPOINT**

Stage 6 begins from merged Stage 5 head `b4567d1ba8af418467023a4a4ba877f8b1ede3a4`.

Current verified implementation head before this preview-marker commit: `82f366c0970a2da3d0483d6efa3cf3be34e62ccb`.

## 1. Intervention → Next HQLS Lesson

### Data relationship

PASS.

`intervention_handoffs.next_lesson_id` preserves the exact generated lesson and prevents duplicate replacement after confirmation.

### Live generation

PASS from Stage 5 acceptance.

The confirmed intervention generated a validated HQLS lesson through the existing `/api/hqls` route and linked it back to the intervention.

### Navigation continuity

PASS in Stage 6.

- HQLS supports exact artifact URLs using `/hqls?lesson=<lesson-id>`.
- The requested lesson must already be visible in the active workspace before it is opened.
- Selecting/opening an HQLS lesson updates the URL to the exact artifact.
- Successful intervention-based generation routes directly to the exact new HQLS lesson.
- Confirmed intervention history opens the exact linked HQLS lesson.

## 2. HQLS Lesson → Assessment

### Data relationship

PASS.

Assessment persistence contains `source_lesson_id`, and the live WorldClass Assessment Intelligence client carries lesson topic, objective, subject, class and age context into the assessment blueprint.

### Navigation continuity

PASS in Stage 6.

- Only validated HQLS lessons expose `Build Assessment`.
- The exact handoff is `/assessment?lesson=<lesson-id>`.
- The live `WorldClassAssessmentClient` verifies that the requested lesson is a validated source visible in the active workspace.
- The existing source-lesson logic populates the assessment blueprint rather than creating a second assessment engine.
- Saved assessments are addressable as `/assessment?assessment=<assessment-id>`.
- A saved assessment linked to a lesson can navigate back to that exact source HQLS lesson.

## 3. Assessment / Evidence → Diagnosis

### Data relationship

PASS.

Diagnosis supports Assessment-Based and Combined modes, persists `assessment_id`, and loads saved assessment items so teachers can enter score and item-level evidence.

### Navigation continuity

PASS in Stage 6.

- Non-archived saved assessments expose `Use in Diagnosis`.
- The exact handoff is `/diagnosis?assessment=<assessment-id>`.
- Diagnosis verifies the assessment is available as evidence in the active workspace.
- The handoff switches Diagnosis to Assessment-Based mode and preselects that exact assessment.
- Learner selection, marks, factual observations and review remain human-controlled.

No automatic clinical inference or student diagnosis was introduced.

## 4. Diagnosis → Intervention

PASS.

Final diagnoses remain the only diagnoses eligible to create intervention handoffs. Stage 5 live acceptance proved the governed handoff and next-learning loop.

## 5. Saved work and durability

PARTIALLY VERIFIED / LIVE REGRESSION REQUIRED.

HQLS lessons and assessments are durable database artifacts and the existing Saved Work system provides archive/restore/dependency-safe deletion for those artifact types.

The Stage 6 Preview must re-test:

- refresh;
- sign-out/sign-in;
- archived item listing;
- restore;
- dependency-safe permanent deletion;
- exact artifact opening after re-login.

Diagnosis and confirmed intervention history remain governed by their dedicated lifecycle/history screens and are not forced into the lesson/assessment Saved Work RPC.

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

Current findings are INFO-level unused-index notices in a low-traffic environment. Zero usage is not evidence that integrity, provenance or future query-support indexes are unnecessary.

Do not delete integrity/query-support indexes purely to clear the advisor before meaningful production workload exists.

## 8. Product-facing release language and responsive structure

STRUCTURAL PASS / LIVE MOBILE REGRESSION REQUIRED.

Release-facing Stage 4/5 labels were removed from the Dashboard, Diagnosis, Intervention and Closed Learning Loop workflow shells.

The current core workflow layouts structurally use responsive stacks, wrapping actions and one-column mobile fallbacks rather than fixed desktop-only widths:

- HQLS selected-lesson actions stack on small screens;
- Assessment selected-artifact actions stack and wrap;
- Diagnosis evidence/action quadrants collapse to one column;
- workflow top navigation groups wrap;
- Intervention action groups wrap.

The Preview must still be checked on an actual mobile viewport before launch acceptance.

## 9. Error and recovery audit

IN PROGRESS.

The exact artifact handoffs now return explicit user-facing recovery messages when a requested lesson or assessment is not available in the active workspace.

One low-risk UI state item remains for final regression: saved-diagnosis selection should never display a success/error notice belonging to a previously opened diagnosis. This does not affect persistence, permissions or diagnosis lifecycle integrity, but must be verified/fixed before Stage 6 closeout if reproducible on the Preview.

## 10. Stage 6 permanent verification

PASS at current hardened checkpoint.

`scripts/verify-stage6.mjs` is included in `npm run verify:structure` and protects:

- the three-engine constitutional boundary;
- the Stage 6 release contract;
- exact intervention → HQLS artifact navigation;
- active-workspace verification before opening linked HQLS lessons;
- validated HQLS → live WorldClass Assessment handoff;
- exact saved Assessment → Diagnosis evidence handoff;
- source/back-link provenance;
- confirmed-intervention exact linked-lesson navigation;
- release-facing removal of Stage 4/5 workflow labels.

Engineering proof:

- exact handoff head `286bd1da37e9984a4e5a641ebb9606e67f18879c` passed CI run #456;
- hardened release-label head `82f366c0970a2da3d0483d6efa3cf3be34e62ccb` passed CI run #458;
- both runs passed dependency installation, lint, strict TypeScript, constitutional verification, production build and dependency audit.

## Preview acceptance gates

1. Build the deliberate Stage 6 Vercel Preview from this checkpoint.
2. Run authenticated desktop regression through the complete loop.
3. Run authenticated mobile regression through the core loop and navigation.
4. Verify refresh/re-login and Saved Work durability.
5. Verify workspace/role isolation and unavailable-artifact recovery.
6. Resolve or explicitly record the leaked-password-protection launch decision.
7. Fix any reproducible stale diagnosis notice/state issue.
8. Obtain explicit founder acceptance before merge.

**DO NOT MERGE until all live Version 1 acceptance gates pass and founder approval is explicit.**
