-- KAEC School Intelligence — Stage 1 security and performance hardening
-- Moves SECURITY DEFINER helpers out of the exposed public API schema,
-- removes avoidable RLS initplan work, tightens membership management,
-- and adds covering indexes for foreign keys reported by Supabase advisors.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Keep the existing function OIDs so policies/triggers continue to reference them,
-- while removing the functions from the exposed public API schema.
alter function public.is_workspace_member(uuid) set schema private;
alter function public.has_workspace_role(uuid, text[]) set schema private;
alter function public.handle_new_user() set schema private;

revoke all on function private.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function private.has_workspace_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;

-- Direct auth.uid() references are wrapped in scalar SELECTs so PostgreSQL can
-- initialise them once per statement rather than once per row.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and (default_workspace_id is null or private.is_workspace_member(default_workspace_id))
);

-- Split the previous FOR ALL membership policy so SELECT has only one
-- permissive policy and so admins cannot promote anyone to owner or alter an
-- owner membership. Owner-level membership changes require an owner.
drop policy if exists workspace_members_manage_admin on public.workspace_members;

create policy workspace_members_insert_admin on public.workspace_members
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and (role <> 'owner' or private.has_workspace_role(workspace_id, array['owner']))
);

create policy workspace_members_update_admin on public.workspace_members
for update to authenticated
using (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and (role <> 'owner' or private.has_workspace_role(workspace_id, array['owner']))
)
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and (role <> 'owner' or private.has_workspace_role(workspace_id, array['owner']))
);

create policy workspace_members_delete_admin on public.workspace_members
for delete to authenticated
using (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and (role <> 'owner' or private.has_workspace_role(workspace_id, array['owner']))
);

-- Recreate policies with scalar auth.uid() evaluation.
drop policy if exists resources_select_scope on public.resources;
create policy resources_select_scope on public.resources
for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (visibility = 'workspace' or created_by = (select auth.uid()))
);

drop policy if exists resources_insert_member on public.resources;
create policy resources_insert_member on public.resources
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists resources_update_owner_or_admin on public.resources;
create policy resources_update_owner_or_admin on public.resources
for update to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (private.is_workspace_member(workspace_id));

drop policy if exists resources_delete_owner_or_admin on public.resources;
create policy resources_delete_owner_or_admin on public.resources
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['owner','admin'])
);

drop policy if exists diagnoses_insert_member on public.diagnoses;
create policy diagnoses_insert_member on public.diagnoses
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists artifact_versions_insert_member on public.artifact_versions;
create policy artifact_versions_insert_member on public.artifact_versions
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists ai_runs_insert_self on public.ai_runs;
create policy ai_runs_insert_self on public.ai_runs
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and initiated_by = (select auth.uid())
);

drop policy if exists ai_runs_update_self on public.ai_runs;
create policy ai_runs_update_self on public.ai_runs
for update to authenticated
using (
  initiated_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
)
with check (
  initiated_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

drop policy if exists generation_feedback_workspace_access on public.generation_feedback;
create policy generation_feedback_workspace_access on public.generation_feedback
for all to authenticated
using (private.is_workspace_member(workspace_id))
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

-- Cover foreign keys that Supabase's performance advisor identified.
create index if not exists ai_runs_initiated_by_idx on public.ai_runs(initiated_by);
create index if not exists artifact_resource_links_created_by_idx on public.artifact_resource_links(created_by);
create index if not exists artifact_resource_links_workspace_id_idx on public.artifact_resource_links(workspace_id);
create index if not exists artifact_versions_created_by_idx on public.artifact_versions(created_by);
create index if not exists artifact_versions_workspace_id_idx on public.artifact_versions(workspace_id);
create index if not exists assessments_class_id_idx on public.assessments(class_id);
create index if not exists assessments_created_by_idx on public.assessments(created_by);
create index if not exists assessments_subject_id_idx on public.assessments(subject_id);
create index if not exists classes_created_by_idx on public.classes(created_by);
create index if not exists diagnoses_assessment_id_idx on public.diagnoses(assessment_id);
create index if not exists diagnoses_created_by_idx on public.diagnoses(created_by);
create index if not exists diagnoses_finalised_by_idx on public.diagnoses(finalised_by);
create index if not exists diagnoses_reviewed_by_idx on public.diagnoses(reviewed_by);
create index if not exists generation_feedback_ai_run_id_idx on public.generation_feedback(ai_run_id);
create index if not exists generation_feedback_created_by_idx on public.generation_feedback(created_by);
create index if not exists generation_feedback_workspace_id_idx on public.generation_feedback(workspace_id);
create index if not exists hqls_fidelity_checks_checked_by_idx on public.hqls_fidelity_checks(checked_by);
create index if not exists hqls_fidelity_checks_lesson_id_idx on public.hqls_fidelity_checks(lesson_id);
create index if not exists hqls_fidelity_checks_workspace_id_idx on public.hqls_fidelity_checks(workspace_id);
create index if not exists lessons_class_id_idx on public.lessons(class_id);
create index if not exists lessons_created_by_idx on public.lessons(created_by);
create index if not exists lessons_subject_id_idx on public.lessons(subject_id);
create index if not exists profiles_default_workspace_id_idx on public.profiles(default_workspace_id);
create index if not exists resources_created_by_idx on public.resources(created_by);
create index if not exists student_evidence_assessment_item_id_idx on public.student_evidence(assessment_item_id);
create index if not exists student_evidence_recorded_by_idx on public.student_evidence(recorded_by);
create index if not exists student_evidence_workspace_id_idx on public.student_evidence(workspace_id);
create index if not exists students_created_by_idx on public.students(created_by);
create index if not exists subjects_created_by_idx on public.subjects(created_by);
create index if not exists workspaces_created_by_idx on public.workspaces(created_by);
