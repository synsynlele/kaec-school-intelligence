create function public.get_learning_timetable_audience()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'workspace',s.workspace_id,'classId',c.id,'session',c.academic_session,
    'subjects',coalesce((
      select jsonb_agg(subject.name order by subject.name)
      from private.learning_subject_enrolments e
      join public.subjects subject on subject.id=any(e.subject_ids) and subject.workspace_id=s.workspace_id and subject.active
      where e.workspace_id=s.workspace_id and e.class_id=c.id and e.student_id=s.id
        and e.academic_session=c.academic_session
    ),'[]'::jsonb))
  from public.student_accounts a
  join public.students s on s.id=a.student_id and s.workspace_id=a.workspace_id and s.active
  join public.classes c on c.id=s.class_id and c.workspace_id=s.workspace_id and c.active
  join public.workspaces w on w.id=s.workspace_id and w.workspace_type='school' and w.access_status='active'
  where a.user_id=auth.uid() and a.active
$$;
revoke all on function public.get_learning_timetable_audience() from public,anon;
grant execute on function public.get_learning_timetable_audience() to authenticated;
