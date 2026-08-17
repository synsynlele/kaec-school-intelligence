-- KSI 2.0 Stage 9 — Leadership Learning Intelligence read model
-- Aggregates the same governed learning records used by Teacher and Student KSI.

create or replace function public.get_leadership_learning_intelligence(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  workspace_name text;
  total_students integer;
  final_diagnoses integer;
  confirmed_interventions integer;
  students_needing_attention integer;
  class_health jsonb;
  subject_health jsonb;
  attention_students jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not private.has_workspace_role(target_workspace_id, array['owner','admin','leader']) then
    raise exception 'Leadership KSI permission required.';
  end if;

  select w.name into workspace_name
  from public.workspaces w
  where w.id = target_workspace_id
    and w.workspace_type = 'school'
    and w.access_status = 'active';

  if not found then
    raise exception 'Active school workspace not found.';
  end if;

  select count(*) into total_students
  from public.students s
  where s.workspace_id = target_workspace_id and s.active = true;

  select count(*) into final_diagnoses
  from public.diagnoses d
  where d.workspace_id = target_workspace_id and d.status = 'final';

  select count(*) into confirmed_interventions
  from public.intervention_handoffs ih
  where ih.workspace_id = target_workspace_id and ih.status = 'confirmed';

  with latest_final as (
    select distinct on (d.student_id)
      d.student_id,
      d.id as diagnosis_id,
      d.academic_challenges,
      d.builder_growth_direction,
      d.finalised_at,
      d.updated_at
    from public.diagnoses d
    where d.workspace_id = target_workspace_id
      and d.status = 'final'
    order by d.student_id, coalesce(d.finalised_at, d.updated_at) desc
  )
  select count(*) into students_needing_attention
  from latest_final lf
  where not exists (
    select 1
    from public.intervention_handoffs ih
    where ih.workspace_id = target_workspace_id
      and ih.student_id = lf.student_id
      and ih.diagnosis_id = lf.diagnosis_id
      and ih.status = 'confirmed'
  );

  select coalesce(jsonb_agg(row_data order by (row_data->>'students_needing_attention')::int desc, row_data->>'class_name'), '[]'::jsonb)
  into class_health
  from (
    select jsonb_build_object(
      'class_id', c.id,
      'class_name', c.name,
      'students', count(distinct s.id),
      'final_diagnoses', count(distinct d.id) filter (where d.status = 'final'),
      'confirmed_interventions', count(distinct ih.id) filter (where ih.status = 'confirmed'),
      'students_needing_attention', count(distinct d.student_id) filter (
        where d.status = 'final'
          and not exists (
            select 1 from public.intervention_handoffs ih2
            where ih2.workspace_id = target_workspace_id
              and ih2.student_id = d.student_id
              and ih2.diagnosis_id = d.id
              and ih2.status = 'confirmed'
          )
      )
    ) as row_data
    from public.classes c
    left join public.students s
      on s.class_id = c.id and s.workspace_id = c.workspace_id and s.active = true
    left join public.diagnoses d
      on d.student_id = s.id and d.workspace_id = c.workspace_id
    left join public.intervention_handoffs ih
      on ih.student_id = s.id and ih.workspace_id = c.workspace_id
    where c.workspace_id = target_workspace_id and c.active = true
    group by c.id, c.name
  ) class_rows;

  select coalesce(jsonb_agg(row_data order by (row_data->>'final_diagnoses')::int desc, row_data->>'subject_name'), '[]'::jsonb)
  into subject_health
  from (
    select jsonb_build_object(
      'subject_id', sub.id,
      'subject_name', sub.name,
      'lessons', count(distinct l.id),
      'assessments', count(distinct a.id),
      'final_diagnoses', count(distinct d.id) filter (where d.status = 'final'),
      'confirmed_interventions', count(distinct ih.id) filter (where ih.status = 'confirmed')
    ) as row_data
    from public.subjects sub
    left join public.lessons l
      on l.subject_id = sub.id and l.workspace_id = sub.workspace_id
    left join public.assessments a
      on a.subject_id = sub.id and a.workspace_id = sub.workspace_id
    left join public.diagnoses d
      on d.assessment_id = a.id and d.workspace_id = sub.workspace_id
    left join public.intervention_handoffs ih
      on ih.diagnosis_id = d.id and ih.workspace_id = sub.workspace_id
    where sub.workspace_id = target_workspace_id and sub.active = true
    group by sub.id, sub.name
  ) subject_rows;

  with latest_final as (
    select distinct on (d.student_id)
      d.student_id,
      d.id as diagnosis_id,
      d.concise_diagnosis,
      d.builder_growth_direction,
      d.finalised_at,
      d.updated_at
    from public.diagnoses d
    where d.workspace_id = target_workspace_id
      and d.status = 'final'
    order by d.student_id, coalesce(d.finalised_at, d.updated_at) desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', s.id,
    'student_name', s.display_name,
    'class_name', c.name,
    'diagnosis_id', lf.diagnosis_id,
    'concise_diagnosis', lf.concise_diagnosis,
    'growth_direction', lf.builder_growth_direction
  ) order by c.name nulls last, s.display_name), '[]'::jsonb)
  into attention_students
  from latest_final lf
  join public.students s on s.id = lf.student_id and s.workspace_id = target_workspace_id
  left join public.classes c on c.id = s.class_id and c.workspace_id = target_workspace_id
  where not exists (
    select 1
    from public.intervention_handoffs ih
    where ih.workspace_id = target_workspace_id
      and ih.student_id = lf.student_id
      and ih.diagnosis_id = lf.diagnosis_id
      and ih.status = 'confirmed'
  );

  return jsonb_build_object(
    'school', jsonb_build_object('id', target_workspace_id, 'name', workspace_name),
    'summary', jsonb_build_object(
      'students', total_students,
      'final_diagnoses', final_diagnoses,
      'confirmed_interventions', confirmed_interventions,
      'students_needing_attention', students_needing_attention,
      'intervention_coverage_percent', case when final_diagnoses > 0 then round((confirmed_interventions::numeric / final_diagnoses::numeric) * 100) else 0 end
    ),
    'class_health', class_health,
    'subject_health', subject_health,
    'students_needing_attention', attention_students
  );
end;
$$;

revoke all on function public.get_leadership_learning_intelligence(uuid) from public, anon;
grant execute on function public.get_leadership_learning_intelligence(uuid) to authenticated;

comment on function public.get_leadership_learning_intelligence(uuid) is
  'Leadership-safe KSI read model for active school owners, admins and leaders. Aggregates shared learning records without a duplicate reporting store.';
