# Stage 6 — Full-Loop Security Regression

Date: 9 August 2026

Status: **PASS — LIVE DATABASE SECURITY AUDIT**

Project: KAEC School Intelligence  
Supabase project: `zaoxfjbiizargeclnzmo`

The original Version 1 isolation audit was performed without reading student record contents and without mutating production data. On 9 August 2026, migration `024_stage6_archive_result_lifecycle.sql` was then applied to add the approved archive/delete lifecycle. A follow-up schema and role audit again read no student record contents and made no production-record mutations.

## Scope

The Version 1 learning loop was re-audited across:

- `lessons`
- `lesson_stages`
- `hqls_fidelity_checks`
- `assessments`
- `assessment_items`
- `student_evidence`
- `diagnoses`
- `intervention_handoffs`
- `artifact_versions`
- `artifact_resource_links`
- `generation_feedback`

The 9 August follow-up specifically re-verified the changed `diagnoses` and `intervention_handoffs` boundaries after the guarded archive lifecycle migration.

## 1. Row Level Security

**PASS.**

RLS is enabled on every table in scope, including both lifecycle-modified tables.

All exposed policies in scope are assigned to `authenticated`; there are **zero anon RLS policies** on the audited tables.

`FORCE ROW LEVEL SECURITY` is not enabled. This is not a launch defect for the browser/API roles because Supabase `anon` and `authenticated` are not table owners and therefore remain subject to RLS.

## 2. Anonymous visibility

**PASS.**

A live read-only test executed under PostgreSQL role `anon` returned **0 visible rows** from:

- `lessons`
- `lesson_stages`
- `hqls_fidelity_checks`
- `assessments`
- `assessment_items`
- `student_evidence`
- `diagnoses`
- `artifact_versions`
- `artifact_resource_links`
- `generation_feedback`

After the lifecycle migration, `diagnoses` was explicitly re-tested as `anon` and still returned **0 visible rows**.

`intervention_handoffs` remains stricter: the `anon` role has no direct `SELECT`, `INSERT`, `UPDATE` or `DELETE` privilege, so PostgreSQL rejects access before RLS evaluation.

Several older Supabase tables still carry default table-level grants for `anon`. The live anonymous-role test proves that their RLS boundary returns zero rows. Do not weaken RLS merely because a default grant exists.

## 3. Workspace isolation

**PASS.**

Authenticated SELECT policies for tenant-owned artifacts consistently require workspace membership, directly or through the parent artifact.

Examples:

- `lessons` → `private.is_workspace_member(workspace_id)`
- `assessments` → `private.is_workspace_member(workspace_id)`
- `student_evidence` → `private.is_workspace_member(workspace_id)`
- `diagnoses` → `private.is_workspace_member(workspace_id)`
- `intervention_handoffs` → `private.is_workspace_member(workspace_id)`
- `lesson_stages` → membership in the parent lesson workspace
- `assessment_items` → membership in the parent assessment workspace
- `hqls_fidelity_checks` → membership in the fidelity record workspace
- Saved Work provenance tables → workspace membership

No cross-workspace public policy was found in the audited loop.

## 4. Creation provenance

**PASS.**

Creation policies preserve authenticated actor provenance where applicable:

- lessons/assessments/artifact records require `created_by = auth.uid()`;
- evidence requires `recorded_by = auth.uid()`;
- intervention handoffs require `created_by = auth.uid()`;
- human fidelity checks require `checked_by = auth.uid()` and `check_origin = 'human'`.

## 5. Guarded archive and destructive actions

**PASS.**

Destructive operations are not open merely because a user belongs to the workspace. Stage 6 now distinguishes reversible archival from permanent deletion for diagnoses and interventions.

### Diagnoses

- `draft`, `reviewed`, `final`, and `archived` are valid states.
- Moving a diagnosis into `archived` requires workspace owner/admin authority.
- An archived diagnosis is immutable.
- A diagnosis cannot be archived while a linked intervention remains active; the intervention must be archived first.
- Permanent diagnosis deletion requires owner/admin authority, `status = 'archived'`, and **no remaining intervention dependency**.
- This prevents the diagnosis foreign-key cascade from silently erasing intervention provenance.

### Intervention handoffs

- `draft`, `confirmed`, and `archived` are valid states.
- Moving an intervention into `archived` requires workspace owner/admin authority.
- Archived interventions are immutable.
- A confirmed intervention may move only to `confirmed` or `archived`; its confirmed content and actor/timestamp provenance remain unchanged.
- Permanent intervention deletion is limited to owner/admin and either a draft mistake or an archived plan with **no linked next HQLS lesson**.
- If an intervention already produced a linked next lesson, it remains durable Archive history and permanent deletion is blocked.

These rules preserve the approved chain:

**Evidence → Diagnosis → Intervention → Next HQLS Lesson**

while still allowing schools to remove completed or departed-student work from active operational views.

## 6. Diagnosis final/archive protection

**PASS.**

Diagnosis update policy requires workspace membership. Ordinary members can work on draft/reviewed records, while transitions to final or archived require owner/admin authority.

The new `diagnoses_archive_integrity` trigger prevents archived records from returning to an active state and prevents hiding a diagnosis while its intervention is still active.

Approved parent PDFs remain available for both `final` and `archived` diagnoses, provided human review and final approval timestamps are present.

## 7. Intervention integrity after archive extension

**PASS.**

The existing intervention integrity trigger remains active and now recognises archival without weakening confirmed-plan provenance:

- new handoffs still require a final diagnosis;
- workspace/student provenance is immutable;
- confirmed intervention content is immutable;
- the one governed next-lesson link cannot be changed after it is set;
- linked lessons must remain in the same workspace;
- archived handoffs cannot be modified or restored.

## 8. Saved Work SECURITY DEFINER functions

**PASS / ACCEPTED BY DESIGN.**

The Supabase Security Advisor continues to warn that authenticated users may execute:

- `list_archived_saved_work(uuid)`
- `manage_saved_artifact(text, uuid, text)`

These functions remain intentional controlled APIs. Previous Stage 6 review verified that they:

- reject missing `auth.uid()`;
- enforce workspace membership;
- enforce creator/owner/admin authority for management operations;
- enforce dependency safety before permanent deletion;
- use a fixed search path;
- are not executable by `anon`.

Do not remove these permissions merely to silence the generic advisor warning.

## 9. Remaining Auth configuration warning

**OPEN — CONFIGURATION, NOT DATA ISOLATION.**

Supabase leaked-password protection remains disabled for the email/password fallback. Google OAuth remains the primary login path.

This must be enabled if the project plan supports it, or explicitly accepted with the strongest available fallback password requirements before public Version 1 launch.

## Conclusion

The live database audits found **no anonymous data exposure and no missing workspace boundary in the Version 1 learning loop**.

The final archive/delete lifecycle is intentionally asymmetric: Archive is the normal completion path; permanent delete exists only when provenance dependencies make it safe. Linked interventions and their generated next lessons remain traceable rather than being silently destroyed.

Remaining Stage 6 release work is the final Preview acceptance of the separated result pages and archive lifecycle, followed by the leaked-password-protection launch decision and explicit founder approval before merge.