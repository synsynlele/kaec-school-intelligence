-- KSI teacher artifact isolation + school leadership oversight.
-- Teachers can access only teaching intelligence they created.
-- Owner/Admin/Leader retain school-wide read visibility.
-- Owner/Admin destructive lifecycle rules remain unchanged.

-- Policy predicates use creator columns heavily after this migration.
create index if not exists lessons_workspace_creator_idx
  on public.lessons (workspace_id, created_by);
create index if not exists assessments_workspace_creator_idx
  on public.assessments (workspace_id, created_by);
create index if not exists diagnoses_workspace_creator_idx
  on public.diagnoses (workspace_id, created_by);
create index if not exists intervention_handoffs_workspace_creator_idx
  on public.intervention_handoffs (workspace_id, created_by);
create index if not exists student_evidence_workspace_recorder_idx
  on public.student_evidence (workspace_id, recorded_by);
create index if not exists ai_runs_workspace_initiator_idx
  on public.ai_runs (workspace_id, initiated_by);

-- This helper exists in the private schema because it must inspect parent
-- artifacts without being recursively constrained by the very RLS policies it
-- supports. It still authorizes exclusively from auth.uid() + governed school
-- membership; no user_metadata or client-supplied role claim is trusted.
create or replace function private.can_view_teacher_artifact(
  target_workspace_id uuid,
  target_artifact_type text,
  target_artifact_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select
    (select auth.uid()) is not null
    and private.is_workspace_member(target_workspace_id)
    and (
      private.has_workspace_role(
        target_workspace_id,
        array['owner'::text, 'admin'::text, 'leader'::text]
      )
      or case lower(target_artifact_type)
        when 'lesson' then exists (
          select 1
          from public.lessons l
          where l.id = target_artifact_id
            and l.workspace_id = target_workspace_id
            and l.created_by = (select auth.uid())
        )
        when 'assessment' then exists (
          select 1
          from public.assessments a
          where a.id = target_artifact_id
            and a.workspace_id = target_workspace_id
            and a.created_by = (select auth.uid())
        )
        when 'diagnosis' then exists (
          select 1
          from public.diagnoses d
          where d.id = target_artifact_id
            and d.workspace_id = target_workspace_id
            and d.created_by = (select auth.uid())
        )
        else false
      end
    );
$function$;

revoke all on function private.can_view_teacher_artifact(uuid, text, uuid)
from public, anon;
grant execute on function private.can_view_teacher_artifact(uuid, text, uuid)
to authenticated;

-- HQLS lessons ---------------------------------------------------------------
drop policy if exists lessons_select_member on public.lessons;
create policy lessons_select_creator_or_leadership
on public.lessons
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists lessons_update_member on public.lessons;
create policy lessons_update_creator_or_leadership
on public.lessons
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

-- HQLS stages inherit the parent lesson boundary.
drop policy if exists lesson_stages_select_member on public.lesson_stages;
drop policy if exists lesson_stages_insert_member on public.lesson_stages;
drop policy if exists lesson_stages_update_member on public.lesson_stages;
create policy lesson_stages_select_parent_visible
on public.lesson_stages
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_view_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
);
create policy lesson_stages_insert_parent_visible
on public.lesson_stages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_view_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
);
create policy lesson_stages_update_parent_visible
on public.lesson_stages
for update
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_view_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_view_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
);

-- Fidelity data may contain generated details from a lesson, so it inherits the
-- lesson owner boundary rather than the broad workspace-member boundary.
drop policy if exists fidelity_select_member on public.hqls_fidelity_checks;
create policy fidelity_select_parent_visible
on public.hqls_fidelity_checks
for select
to authenticated
using (private.can_view_teacher_artifact(workspace_id, 'lesson', lesson_id));

drop policy if exists fidelity_insert_human_self on public.hqls_fidelity_checks;
create policy fidelity_insert_human_parent_visible
on public.hqls_fidelity_checks
for insert
to authenticated
with check (
  private.can_view_teacher_artifact(workspace_id, 'lesson', lesson_id)
  and check_origin = 'human'
  and checked_by = (select auth.uid())
);

-- Assessments ----------------------------------------------------------------
drop policy if exists assessments_select_member on public.assessments;
create policy assessments_select_creator_or_leadership
on public.assessments
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists assessments_update_member on public.assessments;
create policy assessments_update_creator_or_leadership
on public.assessments
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

-- Assessment items previously had one workspace-wide FOR ALL policy. Replace it
-- with explicit operation policies tied to the visible parent assessment.
drop policy if exists assessment_items_workspace_access on public.assessment_items;
create policy assessment_items_select_parent_visible
on public.assessment_items
for select
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);
create policy assessment_items_insert_parent_visible
on public.assessment_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);
create policy assessment_items_update_parent_visible
on public.assessment_items
for update
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
)
with check (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);
create policy assessment_items_delete_parent_visible
on public.assessment_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);

-- Evidence -------------------------------------------------------------------
drop policy if exists evidence_select_member on public.student_evidence;
create policy evidence_select_recorder_or_leadership
on public.student_evidence
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    recorded_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists evidence_update_member on public.student_evidence;
create policy evidence_update_recorder_or_leadership
on public.student_evidence
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    recorded_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    recorded_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

-- Diagnoses ------------------------------------------------------------------
drop policy if exists diagnoses_select_member on public.diagnoses;
create policy diagnoses_select_creator_or_leadership
on public.diagnoses
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists diagnoses_update_member on public.diagnoses;
create policy diagnoses_update_creator_or_leadership
on public.diagnoses
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
  and (
    status <> 'final'
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
  and (
    status in ('draft','reviewed')
    or (
      status in ('final','archived')
      and private.has_workspace_role(workspace_id, array['owner','admin'])
    )
  )
);

-- Intervention handoffs ------------------------------------------------------
drop policy if exists intervention_handoffs_select_member on public.intervention_handoffs;
create policy intervention_handoffs_select_creator_or_leadership
on public.intervention_handoffs
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists intervention_handoffs_update_member on public.intervention_handoffs;
create policy intervention_handoffs_update_creator_or_leadership
on public.intervention_handoffs
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
  and (
    status in ('draft','confirmed')
    or (
      status = 'archived'
      and private.has_workspace_role(workspace_id, array['owner','admin'])
    )
  )
);

-- Provenance / linked metadata ----------------------------------------------
drop policy if exists artifact_versions_select_member on public.artifact_versions;
create policy artifact_versions_select_parent_visible
on public.artifact_versions
for select
to authenticated
using (
  private.can_view_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

drop policy if exists artifact_versions_insert_member on public.artifact_versions;
create policy artifact_versions_insert_parent_visible
on public.artifact_versions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_view_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

drop policy if exists artifact_resources_select_member on public.artifact_resource_links;
create policy artifact_resources_select_parent_visible
on public.artifact_resource_links
for select
to authenticated
using (
  private.can_view_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

drop policy if exists artifact_resources_insert_self on public.artifact_resource_links;
create policy artifact_resources_insert_parent_visible
on public.artifact_resource_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_view_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

drop policy if exists ai_runs_select_member on public.ai_runs;
create policy ai_runs_select_initiator_or_leadership
on public.ai_runs
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    initiated_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists ai_runs_insert_self on public.ai_runs;
create policy ai_runs_insert_self_visible_artifact
on public.ai_runs
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and initiated_by = (select auth.uid())
  and (
    artifact_id is null
    or private.can_view_teacher_artifact(workspace_id, artifact_type, artifact_id)
  )
);

drop policy if exists generation_feedback_select_member on public.generation_feedback;
create policy generation_feedback_select_creator_or_leadership
on public.generation_feedback
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin','leader'])
  )
);

drop policy if exists generation_feedback_insert_self on public.generation_feedback;
create policy generation_feedback_insert_self_visible_artifact
on public.generation_feedback
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_view_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

-- Saved Work archive is a SECURITY DEFINER RPC and therefore must implement the
-- same teacher-vs-leadership boundary itself; table RLS alone cannot protect it.
create or replace function public.list_archived_saved_work(target_workspace_id uuid)
returns table (
  artifact_type text,
  artifact_id uuid,
  title text,
  updated_at timestamptz,
  dependency_count bigint,
  can_manage boolean,
  can_permanently_delete boolean
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  leadership_view boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not private.is_workspace_member(target_workspace_id) then
    raise exception 'The selected workspace is not available to this account.' using errcode = '42501';
  end if;

  leadership_view := private.has_workspace_role(
    target_workspace_id,
    array['owner'::text, 'admin'::text, 'leader'::text]
  );

  return query
  select
    'lesson'::text,
    l.id,
    l.title,
    l.updated_at,
    (select count(*) from public.assessments a where a.source_lesson_id = l.id)::bigint,
    (l.created_by = current_user_id or private.has_workspace_role(l.workspace_id, array['owner'::text, 'admin'::text])),
    (
      (l.created_by = current_user_id or private.has_workspace_role(l.workspace_id, array['owner'::text, 'admin'::text]))
      and not exists (select 1 from public.assessments a where a.source_lesson_id = l.id)
    )
  from public.lessons l
  where l.workspace_id = target_workspace_id
    and l.status = 'archived'
    and (leadership_view or l.created_by = current_user_id)

  union all

  select
    'assessment'::text,
    a.id,
    a.title,
    a.updated_at,
    (
      (select count(*) from public.student_evidence se where se.assessment_id = a.id)
      +
      (select count(*) from public.diagnoses d where d.assessment_id = a.id)
    )::bigint,
    (a.created_by = current_user_id or private.has_workspace_role(a.workspace_id, array['owner'::text, 'admin'::text])),
    (
      (a.created_by = current_user_id or private.has_workspace_role(a.workspace_id, array['owner'::text, 'admin'::text]))
      and not exists (select 1 from public.student_evidence se where se.assessment_id = a.id)
      and not exists (select 1 from public.diagnoses d where d.assessment_id = a.id)
    )
  from public.assessments a
  where a.workspace_id = target_workspace_id
    and a.status = 'archived'
    and (leadership_view or a.created_by = current_user_id)

  order by updated_at desc;
end;
$$;

revoke all on function public.list_archived_saved_work(uuid) from public, anon;
grant execute on function public.list_archived_saved_work(uuid) to authenticated;

comment on function private.can_view_teacher_artifact(uuid, text, uuid) is
  'KSI artifact visibility: creator-only for teachers; school-wide for active owner/admin/leader.';
comment on function public.list_archived_saved_work(uuid) is
  'Lists archived lessons/assessments using KSI teacher isolation and leadership oversight rules.';
