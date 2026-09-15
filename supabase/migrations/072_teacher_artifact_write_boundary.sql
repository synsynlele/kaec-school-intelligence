-- KSI teacher artifact write boundary.
-- 071 establishes creator-scoped teacher visibility and school-wide leadership
-- oversight. This migration makes the write boundary explicit: Teacher = own;
-- Leader = read oversight; Owner/Admin = school governance.

create or replace function private.can_manage_teacher_artifact(
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
        array['owner'::text, 'admin'::text]
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

revoke all on function private.can_manage_teacher_artifact(uuid, text, uuid)
from public, anon;
grant execute on function private.can_manage_teacher_artifact(uuid, text, uuid)
to authenticated;

-- Parent artifacts: leaders retain SELECT through 071 but cannot mutate another
-- teacher's artifact. Owner/Admin retain governed school-wide management.
drop policy if exists lessons_update_creator_or_leadership on public.lessons;
create policy lessons_update_creator_or_admin
on public.lessons
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

drop policy if exists assessments_update_creator_or_leadership on public.assessments;
create policy assessments_update_creator_or_admin
on public.assessments
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

drop policy if exists diagnoses_update_creator_or_leadership on public.diagnoses;
create policy diagnoses_update_creator_or_admin
on public.diagnoses
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
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
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
  and (
    status in ('draft','reviewed')
    or (
      status in ('final','archived')
      and private.has_workspace_role(workspace_id, array['owner','admin'])
    )
  )
);

drop policy if exists intervention_handoffs_update_creator_or_leadership
on public.intervention_handoffs;
create policy intervention_handoffs_update_creator_or_admin
on public.intervention_handoffs
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
  and (
    status in ('draft','confirmed')
    or (
      status = 'archived'
      and private.has_workspace_role(workspace_id, array['owner','admin'])
    )
  )
);

-- Child rows inherit manage permission, not merely read visibility.
drop policy if exists lesson_stages_insert_parent_visible on public.lesson_stages;
drop policy if exists lesson_stages_update_parent_visible on public.lesson_stages;
create policy lesson_stages_insert_parent_manageable
on public.lesson_stages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_manage_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
);
create policy lesson_stages_update_parent_manageable
on public.lesson_stages
for update
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_manage_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and private.can_manage_teacher_artifact(l.workspace_id, 'lesson', l.id)
  )
);

drop policy if exists fidelity_insert_human_parent_visible on public.hqls_fidelity_checks;
create policy fidelity_insert_human_parent_manageable
on public.hqls_fidelity_checks
for insert
to authenticated
with check (
  private.can_manage_teacher_artifact(workspace_id, 'lesson', lesson_id)
  and check_origin = 'human'
  and checked_by = (select auth.uid())
);

drop policy if exists assessment_items_insert_parent_visible on public.assessment_items;
drop policy if exists assessment_items_update_parent_visible on public.assessment_items;
drop policy if exists assessment_items_delete_parent_visible on public.assessment_items;
create policy assessment_items_insert_parent_manageable
on public.assessment_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_manage_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);
create policy assessment_items_update_parent_manageable
on public.assessment_items
for update
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_manage_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
)
with check (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_manage_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);
create policy assessment_items_delete_parent_manageable
on public.assessment_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_id
      and private.can_manage_teacher_artifact(a.workspace_id, 'assessment', a.id)
  )
);

drop policy if exists evidence_update_recorder_or_leadership on public.student_evidence;
create policy evidence_update_recorder_or_admin
on public.student_evidence
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    recorded_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    recorded_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

-- Provenance writes cannot be attached to another teacher's artifact merely
-- because the caller has Leader read visibility.
drop policy if exists artifact_versions_insert_parent_visible on public.artifact_versions;
create policy artifact_versions_insert_parent_manageable
on public.artifact_versions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_manage_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

drop policy if exists artifact_resources_insert_parent_visible on public.artifact_resource_links;
create policy artifact_resources_insert_parent_manageable
on public.artifact_resource_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_manage_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

drop policy if exists ai_runs_insert_self_visible_artifact on public.ai_runs;
create policy ai_runs_insert_self_manageable_artifact
on public.ai_runs
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and initiated_by = (select auth.uid())
  and (
    artifact_id is null
    or private.can_manage_teacher_artifact(workspace_id, artifact_type, artifact_id)
  )
);

drop policy if exists generation_feedback_insert_self_visible_artifact
on public.generation_feedback;
create policy generation_feedback_insert_self_manageable_artifact
on public.generation_feedback
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_manage_teacher_artifact(workspace_id, artifact_type, artifact_id)
);

comment on function private.can_manage_teacher_artifact(uuid, text, uuid) is
  'KSI artifact write boundary: creator for teachers; school-wide governance for active owner/admin; leader remains read-only oversight.';
