-- Platform-only, aggregate read model. No learner names, content or staff identifiers.
-- Student-related counts are withheld for schools with fewer than five active learners.
create or replace function public.get_platform_school_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  overview jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_platform_access_admin()) then
    raise exception 'Platform administrator permission required.';
  end if;

  with school_metrics as (
    select
      w.id, w.name, w.access_status, w.created_at,
      coalesce(st.active_students, 0) as active_students,
      coalesce(l.total, 0) as lessons,
      coalesce(a.total, 0) as assessments,
      coalesce(l.recent, 0) + coalesce(a.recent, 0)
        + case when coalesce(st.active_students, 0) >= 5
          then coalesce(d.recent, 0) + coalesce(i.recent, 0) else 0 end as records_updated_30d,
      greatest(l.last_at, a.last_at,
        case when coalesce(st.active_students, 0) >= 5 then d.last_at end,
        case when coalesce(st.active_students, 0) >= 5 then i.last_at end) as last_learning_update_at,
      (coalesce(st.active_students, 0) < 5) as limited_metrics,
      case when coalesce(st.active_students, 0) >= 5 then d.final_total else null end as final_diagnoses,
      case when coalesce(st.active_students, 0) >= 5 then d.draft_total else null end as draft_diagnoses,
      case when coalesce(st.active_students, 0) >= 5 then i.confirmed_total else null end as confirmed_interventions,
      case when coalesce(st.active_students, 0) >= 5 then gap.outstanding else null end as latest_final_without_intervention
    from public.workspaces w
    left join lateral (
      select count(*)::int as active_students from public.students s
      where s.workspace_id = w.id and s.active
    ) st on true
    left join lateral (
      select count(*) filter (where status <> 'archived')::int as total,
             count(*) filter (where status <> 'archived' and updated_at >= now() - interval '30 days')::int as recent,
             max(updated_at) filter (where status <> 'archived') as last_at
      from public.lessons where workspace_id = w.id
    ) l on true
    left join lateral (
      select count(*) filter (where status <> 'archived')::int as total,
             count(*) filter (where status <> 'archived' and updated_at >= now() - interval '30 days')::int as recent,
             max(updated_at) filter (where status <> 'archived') as last_at
      from public.assessments where workspace_id = w.id
    ) a on true
    left join lateral (
      select count(*) filter (where status <> 'archived' and updated_at >= now() - interval '30 days')::int as recent,
             count(*) filter (where status = 'final')::int as final_total,
             count(*) filter (where status = 'draft')::int as draft_total,
             max(updated_at) filter (where status <> 'archived') as last_at
      from public.diagnoses where workspace_id = w.id
    ) d on true
    left join lateral (
      select count(*) filter (where status <> 'archived' and updated_at >= now() - interval '30 days')::int as recent,
             count(*) filter (where status = 'confirmed')::int as confirmed_total,
             max(updated_at) filter (where status <> 'archived') as last_at
      from public.intervention_handoffs where workspace_id = w.id
    ) i on true
    left join lateral (
      select count(*)::int as outstanding
      from (
        select distinct on (student_id) id, student_id
        from public.diagnoses
        where workspace_id = w.id and status = 'final'
        order by student_id, coalesce(finalised_at, updated_at) desc, id desc
      ) latest
      where not exists (
        select 1 from public.intervention_handoffs ih
        where ih.workspace_id = w.id
          and ih.diagnosis_id = latest.id
          and ih.status = 'confirmed'
      )
    ) gap on true
    where w.workspace_type = 'school'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'access_status', access_status, 'created_at', created_at,
    'limited_metrics', limited_metrics,
    'lessons', lessons, 'assessments', assessments,
    'records_updated_30d', records_updated_30d,
    'last_learning_update_at', last_learning_update_at,
    'final_diagnoses', final_diagnoses, 'draft_diagnoses', draft_diagnoses,
    'confirmed_interventions', confirmed_interventions,
    'latest_final_without_intervention', latest_final_without_intervention
  ) order by name), '[]'::jsonb)
  into overview
  from school_metrics;
  return overview;
end;
$$;

revoke all on function public.get_platform_school_overview() from public, anon;
grant execute on function public.get_platform_school_overview() to authenticated;

comment on function public.get_platform_school_overview() is
  'Platform-admin-only, school-level learning workflow counts; student-related figures suppressed under five active learners. No learner-level records returned.';
