# Stage 7 — Database Design: School Access, Roles and Student Identity

This document is the migration contract for KSI 2.0 Stage 7. It is intentionally not yet an applied migration because the dedicated KSI Supabase project must be connected and verified before schema/RLS mutation.

## Existing entities preserved

KSI already has:

- `workspaces`
- `workspace_members`
- `students`
- workspace-scoped lessons, assessments, evidence, diagnoses, interventions and resources
- RLS helpers `is_workspace_member(...)` and `has_workspace_role(...)`

Stage 7 extends these rather than creating a second tenancy system.

## 1. `workspaces` additions

Add:

- `access_status text not null default 'active'` constrained to `active | paused | blocked | disabled`
- `access_status_changed_at timestamptz`
- `access_status_changed_by uuid references auth.users(id)`
- `access_status_note text`

All existing school workspaces must migrate to `active` so accepted V1 behavior is preserved.

## 2. Workspace roles

Extend the existing `workspace_members.role` constraint from:

`owner | admin | teacher`

to:

`owner | admin | leader | teacher | student`

Existing memberships remain unchanged.

## 3. Platform administrators

Create a dedicated authorization table for KAEC platform access administrators. Platform authority must not be inferred from school workspace ownership.

Proposed entity:

`platform_access_admins`

Fields:

- `user_id uuid primary key references auth.users(id)`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`
- `created_by uuid references auth.users(id)`

Platform-admin lookup must not trust user-editable JWT metadata.

## 4. Access audit

Create append-only `school_access_audit` entries for every access-state transition:

- workspace
- previous status
- new status
- actor
- note/reason
- timestamp

School-level owners/admins must not be able to alter their own platform access state or delete audit records.

## 5. Student account binding

Create `student_accounts` to bind an authenticated user to one existing KSI student record.

Required integrity:

- one auth user → at most one student account;
- one student row → at most one auth user;
- binding workspace must equal the student's workspace;
- ordinary students can read only their own binding;
- only authorized school administrators/leaders or governed provisioning workflows can create/revoke a binding.

## 6. Central access enforcement

The existing workspace authorization helpers must be evolved so normal workspace membership/role checks also require:

`workspaces.access_status = 'active'`

This is the leverage point: existing RLS policies that depend on those canonical helpers inherit the school access gate without duplicating payment/access logic across lessons, assessments, diagnoses, interventions and future Student/Leadership tables.

Platform administration requires a separate, tightly bounded authorization path to view and update school access state even when the school is not active.

## 7. Required database proofs

Before the migration is accepted, test all of the following against a disposable/development KSI database:

1. Active school teacher retains existing V1 access.
2. Paused school teacher loses protected access.
3. Blocked school owner cannot self-reactivate.
4. Disabled school user loses protected access.
5. Platform access admin can reactivate the school.
6. Reactivation restores prior data without repair.
7. School A cannot read School B data.
8. Student A cannot read Student B evidence, diagnosis or intervention.
9. Leader access is limited to the approved learning-intelligence scope.
10. `anon` remains unable to access protected KSI data.
11. Security and performance advisors introduce no unresolved Stage 7 regressions.

## 8. Migration creation rule

When the dedicated KSI Supabase development environment is connected, create the migration through the repository's Supabase CLI workflow, run the SQL/RLS proofs, run Supabase advisors, regenerate TypeScript database types, then commit the generated migration and types to the Stage 7 branch.
