# Stage 6 — Full-Loop Security Regression

Date: 8 August 2026

Status: **PASS — READ-ONLY LIVE DATABASE SECURITY AUDIT**

Project: KAEC School Intelligence
Supabase project: `zaoxfjbiizargeclnzmo`

This audit was performed without reading student record contents and without mutating production data.

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

## 1. Row Level Security

**PASS.**

RLS is enabled on every table in scope.

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

`intervention_handoffs` is stricter: the `anon` role has no direct `SELECT` privilege, so PostgreSQL rejected access before RLS evaluation.

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

## 5. Destructive actions and stronger authority

**PASS.**

Destructive operations are not open merely because a user belongs to the workspace.

Examples:

- lesson and assessment delete: creator or workspace owner/admin;
- evidence delete: recorder or workspace owner/admin;
- diagnosis delete: workspace owner/admin;
- Saved Work resource-link delete: creator or owner/admin;
- intervention handoff delete: owner/admin **and draft status only**.

Confirmed intervention history therefore remains durable.

## 6. Diagnosis final-state protection

**PASS.**

Diagnosis update policy requires workspace membership and only permits ordinary member updates while the diagnosis is not final. Updating a final diagnosis requires owner/admin authority.

This complements the diagnosis lifecycle triggers and human review/approval controls already verified in Stage 4.

## 7. Saved Work SECURITY DEFINER functions

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

## 8. Remaining Auth configuration warning

**OPEN — CONFIGURATION, NOT DATA ISOLATION.**

Supabase leaked-password protection remains disabled for the email/password fallback. Google OAuth remains the primary login path.

This must be enabled if the project plan supports it, or explicitly accepted with the strongest available fallback password requirements before public Version 1 launch.

## Conclusion

The live read-only database audit found **no anonymous data exposure and no missing workspace boundary in the Version 1 learning loop**.

The remaining Stage 6 release work is application-level Preview regression, mobile/refresh/re-login validation, the known low-risk diagnosis notice-state check, and the leaked-password-protection launch decision.
