-- KSI 2.0 Stage 8 — Student Learning Intelligence read model
-- Exposes only the authenticated student's own finalised/confirmed learning intelligence.

create or replace function public.get_my_learning_intelligence()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_row public.student_accounts;
  student_row public.students;
  workspace_row public.workspaces;
  class_name text;
  latest_diagnosis jsonb;
  latest_intervention jsonb;
  final_diagnosis_count integer;
  confirmed_intervention_count integer;
  today_priority jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.access_status = 'active'
  limit 1;

  if not found then
    raise exception 'No active KSI student account is available.';
  end if;

  select s.* into student_row
  from public.students s
  where s.id = account_row.student_id
    and s.workspace_id = account_row.workspace_id
    and s.active = true;

  if not found then
    raise exception 'Student learning record is unavailable.';
  end if;

  select w.* into workspace_row
  from public.workspaces w
  where w.id = account_row.workspace_id;

  if student_row.class_id is not null then
    select c.name into class_name
    from public.classes c
    where c.id = student_row.class_id
      and c.workspace_id = account_row.workspace_id
      and c.active = true;
  end if;

  select jsonb_build_object(
    'id', d.id,
    'assessment_id', d.assessment_id,
    'assessment_title', a.title,
    'concise_diagnosis', d.concise_diagnosis,
    'academic_strengths', coalesce(d.academic_strengths, '[]'::jsonb),
    'academic_challenges', coalesce(d.academic_challenges, '[]'::jsonb),
    'builder_growth_direction', d.builder_growth_direction,
    'encouragement_note', d.encouragement_note,
    'academic_session', d.academic_session,
    'term', d.term,
    'finalised_at', d.finalised_at
  ) into latest_diagnosis
  from public.diagnoses d
  left join public.assessments a
    on a.id = d.assessment_id and a.workspace_id = d.workspace_id
  where d.workspace_id = account_row.workspace_id
    and d.student_id = account_row.student_id
    and d.status = 'final'
  order by coalesce(d.finalised_at, d.updated_at) desc
  limit 1;

  select jsonb_build_object(
    'id', ih.id,
    'diagnosis_id', ih.diagnosis_id,
    'priority_growth_target', ih.priority_growth_target,
    'timeframe', ih.timeframe,
    'success_indicator', ih.success_indicator,
    'review_date', ih.review_date,
    'next_learning_adjustment', ih.next_learning_adjustment,
    'confirmed_at', ih.confirmed_at
  ) into latest_intervention
  from public.intervention_handoffs ih
  where ih.workspace_id = account_row.workspace_id
    and ih.student_id = account_row.student_id
    and ih.status = 'confirmed'
  order by coalesce(ih.confirmed_at, ih.updated_at) desc
  limit 1;

  select count(*) into final_diagnosis_count
  from public.diagnoses d
  where d.workspace_id = account_row.workspace_id
    and d.student_id = account_row.student_id
    and d.status = 'final';

  select count(*) into confirmed_intervention_count
  from public.intervention_handoffs ih
  where ih.workspace_id = account_row.workspace_id
    and ih.student_id = account_row.student_id
    and ih.status = 'confirmed';

  if latest_intervention is not null then
    today_priority := jsonb_build_object(
      'source', 'intervention',
      'title', coalesce(latest_intervention->>'priority_growth_target', 'Continue your current improvement plan'),
      'action', coalesce(latest_intervention->>'next_learning_adjustment', latest_intervention->>'success_indicator', 'Continue the agreed learning action.'),
      'why', 'This is your current confirmed KSI intervention priority.'
    );
  elsif latest_diagnosis is not null then
    today_priority := jsonb_build_object(
      'source', 'diagnosis',
      'title', coalesce(latest_diagnosis->>'builder_growth_direction', 'Work on your latest growth area'),
      'action', 'Review your latest diagnosis and practise the area that needs the most attention.',
      'why', 'KSI selected this from your latest finalised learning diagnosis.'
    );
  else
    today_priority := jsonb_build_object(
      'source', 'baseline',
      'title', 'Build your learning evidence',
      'action', 'Complete your next class learning activity or assessment so KSI can personalise your priorities.',
      'why', 'KSI needs learning evidence before it can personalise your next move.'
    );
  end if;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', student_row.id,
      'name', student_row.display_name,
      'class_id', student_row.class_id,
      'class_name', class_name
    ),
    'school', jsonb_build_object(
      'id', workspace_row.id,
      'name', workspace_row.name
    ),
    'today_priority', today_priority,
    'latest_diagnosis', latest_diagnosis,
    'latest_intervention', latest_intervention,
    'learning_health', jsonb_build_object(
      'final_diagnoses', final_diagnosis_count,
      'confirmed_interventions', confirmed_intervention_count,
      'has_current_diagnosis', latest_diagnosis is not null,
      'has_current_intervention', latest_intervention is not null
    )
  );
end;
$$;

revoke all on function public.get_my_learning_intelligence() from public, anon;
grant execute on function public.get_my_learning_intelligence() to authenticated;

comment on function public.get_my_learning_intelligence() is
  'Student-safe KSI read model exposing only the authenticated student own finalised diagnosis, confirmed intervention, learning health and deterministic next learning priority.';
