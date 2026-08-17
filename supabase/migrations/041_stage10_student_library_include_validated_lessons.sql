create or replace function public.get_my_learning_resources()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  account_row public.student_accounts;
  student_row public.students;
  workspace_row public.workspaces;
  resources_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into account_row from public.student_accounts sa
  where sa.user_id = auth.uid() and sa.active = true;
  if not found then raise exception 'This account is not linked to an active KSI student profile.'; end if;

  select * into workspace_row from public.workspaces w
  where w.id = account_row.workspace_id and w.workspace_type = 'school';
  if not found or workspace_row.access_status <> 'active' then
    raise exception 'Your school does not currently have active KSI access.';
  end if;

  select * into student_row from public.students s
  where s.id = account_row.student_id and s.workspace_id = account_row.workspace_id and s.active = true;
  if not found then raise exception 'Your KSI student profile is not active.'; end if;

  if student_row.class_id is null then
    return jsonb_build_object('student_id', student_row.id, 'class_id', null, 'resources', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(resource_row order by (resource_row->>'updated_at') desc), '[]'::jsonb)
  into resources_json
  from (
    select jsonb_build_object(
      'delivery_id', d.id,
      'lesson_id', l.id,
      'title', l.title,
      'topic', l.topic,
      'objective', l.objective,
      'subject', coalesce(sub.name, 'Learning'),
      'teacher_name', case when d.id is not null then coalesce(p.display_name, 'Your teacher') else '' end,
      'duration_minutes', l.duration_minutes,
      'delivered_at', d.delivered_at,
      'updated_at', l.updated_at,
      'is_taught', d.id is not null,
      'warm_up', coalesce(awakening.content->>'experience', ''),
      'explanation', coalesce(full_light.content->>'teachingContent', ''),
      'practice', coalesce(second_trial.content->>'experience', ''),
      'practice_actions', coalesce(second_trial.content->'learnerActions', '[]'::jsonb),
      'transfer_task', case when d.id is not null then coalesce(d.real_life_assignment, '') else '' end,
      'reflection_prompt', case when d.id is not null then coalesce(d.reflection_prompt, '') else '' end,
      'work_status', coalesce(slw.status, 'not_assigned'),
      'reflection_response', coalesce(slw.reflection_response, ''),
      'assignment_response', coalesce(slw.assignment_response, ''),
      'submitted_at', slw.submitted_at,
      'teacher_feedback', coalesce(slw.teacher_feedback, '')
    ) as resource_row
    from public.lessons l
    left join public.subjects sub on sub.id = l.subject_id
    left join public.lesson_deliveries d on d.lesson_id = l.id
    left join public.student_lesson_work slw
      on slw.delivery_id = d.id
      and slw.student_id = student_row.id
      and slw.workspace_id = account_row.workspace_id
    left join public.profiles p on p.id = d.teacher_id
    left join public.lesson_stages awakening on awakening.lesson_id = l.id and awakening.stage_key = 'awakening'
    left join public.lesson_stages full_light on full_light.lesson_id = l.id and full_light.stage_key = 'full_illumination'
    left join public.lesson_stages second_trial on second_trial.lesson_id = l.id and second_trial.stage_key = 'trial_second'
    where l.workspace_id = account_row.workspace_id
      and l.class_id = student_row.class_id
      and l.status = 'validated'
    order by l.updated_at desc
    limit 100
  ) q;

  return jsonb_build_object('student_id', student_row.id, 'class_id', student_row.class_id, 'resources', resources_json);
end;
$$;

revoke execute on function public.get_my_learning_resources() from public, anon;
grant execute on function public.get_my_learning_resources() to authenticated;
