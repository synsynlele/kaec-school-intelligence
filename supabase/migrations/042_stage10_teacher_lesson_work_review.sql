create or replace function public.get_lesson_delivery_review(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  deliveries_json jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  select wm.role into caller_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = target_workspace_id
    and wm.user_id = caller_id
    and wm.status = 'active'
    and w.workspace_type = 'school'
    and w.access_status = 'active';

  if caller_role is null or caller_role not in ('owner','admin','teacher') then
    raise exception 'Only active teachers and school administrators can review lesson work.';
  end if;

  select coalesce(jsonb_agg(delivery_row order by (delivery_row->>'delivered_at') desc), '[]'::jsonb)
  into deliveries_json
  from (
    select jsonb_build_object(
      'delivery_id', d.id,
      'lesson_id', d.lesson_id,
      'lesson_title', l.title,
      'lesson_topic', l.topic,
      'class_id', d.class_id,
      'class_name', c.name,
      'subject_id', d.subject_id,
      'subject_name', s.name,
      'teacher_id', d.teacher_id,
      'teacher_name', coalesce(p.display_name, 'Teacher'),
      'delivered_at', d.delivered_at,
      'reflection_prompt', coalesce(d.reflection_prompt, ''),
      'real_life_assignment', coalesce(d.real_life_assignment, ''),
      'assigned_count', (select count(*) from public.student_lesson_work w where w.delivery_id = d.id),
      'submitted_count', (select count(*) from public.student_lesson_work w where w.delivery_id = d.id and w.status in ('submitted','reviewed')),
      'reviewed_count', (select count(*) from public.student_lesson_work w where w.delivery_id = d.id and w.status = 'reviewed'),
      'students', coalesce((
        select jsonb_agg(jsonb_build_object(
          'work_id', w.id,
          'student_id', w.student_id,
          'student_name', st.display_name,
          'status', w.status,
          'reflection_response', coalesce(w.reflection_response, ''),
          'assignment_response', coalesce(w.assignment_response, ''),
          'submitted_at', w.submitted_at,
          'teacher_feedback', coalesce(w.teacher_feedback, ''),
          'reviewed_at', w.reviewed_at,
          'reviewed_by', w.reviewed_by
        ) order by st.display_name)
        from public.student_lesson_work w
        join public.students st on st.id = w.student_id and st.workspace_id = w.workspace_id
        where w.delivery_id = d.id
      ), '[]'::jsonb)
    ) as delivery_row
    from public.lesson_deliveries d
    join public.lessons l on l.id = d.lesson_id
    join public.classes c on c.id = d.class_id
    join public.subjects s on s.id = d.subject_id
    left join public.profiles p on p.id = d.teacher_id
    where d.workspace_id = target_workspace_id
      and (caller_role in ('owner','admin') or d.teacher_id = caller_id)
  ) q;

  return jsonb_build_object(
    'workspace_id', target_workspace_id,
    'role', caller_role,
    'deliveries', deliveries_json
  );
end;
$$;

revoke execute on function public.get_lesson_delivery_review(uuid) from public, anon;
grant execute on function public.get_lesson_delivery_review(uuid) to authenticated;

create or replace function public.review_student_lesson_work(target_work_id uuid, feedback_text text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  work_row public.student_lesson_work;
  caller_role text;
  cleaned_feedback text := nullif(btrim(coalesce(feedback_text,'')), '');
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if cleaned_feedback is null then raise exception 'Feedback is required before marking work reviewed.'; end if;

  select * into work_row from public.student_lesson_work where id = target_work_id;
  if not found then raise exception 'Student lesson work not found.'; end if;
  if work_row.status not in ('submitted','reviewed') then
    raise exception 'The student must submit lesson work before it can be reviewed.';
  end if;

  select wm.role into caller_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = work_row.workspace_id
    and wm.user_id = caller_id
    and wm.status = 'active'
    and w.access_status = 'active';

  if caller_role is null
     or (caller_role = 'teacher' and work_row.teacher_id <> caller_id)
     or caller_role not in ('owner','admin','teacher') then
    raise exception 'You are not authorised to review this student lesson work.';
  end if;

  update public.student_lesson_work
  set teacher_feedback = cleaned_feedback,
      status = 'reviewed',
      reviewed_at = now(),
      reviewed_by = caller_id,
      updated_at = now()
  where id = target_work_id;

  return jsonb_build_object(
    'work_id', target_work_id,
    'status', 'reviewed',
    'teacher_feedback', cleaned_feedback,
    'reviewed_at', now(),
    'reviewed_by', caller_id
  );
end;
$$;

revoke execute on function public.review_student_lesson_work(uuid,text) from public, anon;
grant execute on function public.review_student_lesson_work(uuid,text) to authenticated;
