-- KAEC School Intelligence — Stage 1 role and provenance hardening
-- Tightens browser writes so teachers cannot impersonate another creator,
-- mutate final diagnosis as an ordinary member, delete HQLS fidelity history,
-- or alter core school roster/configuration without an admin role.

-- A user's default workspace must always be one they actively belong to.
create or replace function private.validate_profile_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.default_workspace_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = new.default_workspace_id
      and wm.user_id = new.id
      and wm.status = 'active'
  ) then
    raise exception 'Default workspace must be an active workspace membership';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_profile_default_workspace()
from public, anon, authenticated;

create trigger profiles_validate_default_workspace
before insert or update of default_workspace_id on public.profiles
for each row execute function private.validate_profile_default_workspace();

-- School configuration and roster are readable by members but managed by owners/admins.
drop policy if exists subjects_workspace_access on public.subjects;
create policy subjects_select_member on public.subjects
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy subjects_insert_admin on public.subjects
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and created_by = (select auth.uid())
);
create policy subjects_update_admin on public.subjects
for update to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']))
with check (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy subjects_delete_admin on public.subjects
for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists classes_workspace_access on public.classes;
create policy classes_select_member on public.classes
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy classes_insert_admin on public.classes
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and created_by = (select auth.uid())
);
create policy classes_update_admin on public.classes
for update to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']))
with check (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy classes_delete_admin on public.classes
for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists students_workspace_access on public.students;
create policy students_select_member on public.students
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy students_insert_admin on public.students
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and created_by = (select auth.uid())
);
create policy students_update_admin on public.students
for update to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']))
with check (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy students_delete_admin on public.students
for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']));

-- Lesson provenance: members collaborate, but cannot attribute new lessons to another user.
drop policy if exists lessons_workspace_access on public.lessons;
create policy lessons_select_member on public.lessons
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy lessons_insert_self on public.lessons
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy lessons_update_member on public.lessons
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy lessons_delete_creator_or_admin on public.lessons
for delete to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

-- Constitutional HQLS stage rows can be edited but never deleted independently.
drop policy if exists lesson_stages_workspace_access on public.lesson_stages;
create policy lesson_stages_select_member on public.lesson_stages
for select to authenticated
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and private.is_workspace_member(l.workspace_id)
  )
);
create policy lesson_stages_insert_member on public.lesson_stages
for insert to authenticated
with check (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and private.is_workspace_member(l.workspace_id)
  )
);
create policy lesson_stages_update_member on public.lesson_stages
for update to authenticated
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and private.is_workspace_member(l.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and private.is_workspace_member(l.workspace_id)
  )
);

-- Fidelity checks are audit evidence: authenticated users can read them and
-- append human checks, but cannot edit or delete historical checks.
drop policy if exists fidelity_workspace_access on public.hqls_fidelity_checks;
create policy fidelity_select_member on public.hqls_fidelity_checks
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy fidelity_insert_human_self on public.hqls_fidelity_checks
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and check_origin = 'human'
  and checked_by = (select auth.uid())
);

-- Assessment provenance mirrors lesson provenance.
drop policy if exists assessments_workspace_access on public.assessments;
create policy assessments_select_member on public.assessments
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy assessments_insert_self on public.assessments
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy assessments_update_member on public.assessments
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy assessments_delete_creator_or_admin on public.assessments
for delete to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

-- Student evidence must retain true recorder provenance.
drop policy if exists evidence_workspace_access on public.student_evidence;
create policy evidence_select_member on public.student_evidence
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy evidence_insert_self on public.student_evidence
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and recorded_by = (select auth.uid())
);
create policy evidence_update_member on public.student_evidence
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy evidence_delete_recorder_or_admin on public.student_evidence
for delete to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    recorded_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

-- A final parent-facing diagnosis cannot be reopened or altered by an ordinary member.
drop policy if exists diagnoses_update_member on public.diagnoses;
create policy diagnoses_update_member on public.diagnoses
for update to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    status <> 'final'
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    status <> 'final'
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

-- Artifact/resource provenance cannot impersonate another creator.
drop policy if exists artifact_resources_workspace_access on public.artifact_resource_links;
create policy artifact_resources_select_member on public.artifact_resource_links
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy artifact_resources_insert_self on public.artifact_resource_links
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy artifact_resources_delete_creator_or_admin on public.artifact_resource_links
for delete to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

-- Generation feedback is user-owned evidence; members may read aggregate feedback
-- later, but only the creator may edit/delete their own row.
drop policy if exists generation_feedback_workspace_access on public.generation_feedback;
create policy generation_feedback_select_member on public.generation_feedback
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy generation_feedback_insert_self on public.generation_feedback
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy generation_feedback_update_self on public.generation_feedback
for update to authenticated
using (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
)
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy generation_feedback_delete_self on public.generation_feedback
for delete to authenticated
using (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
