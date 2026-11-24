create function public.approve_learning_subject_gradebook_with_resumption(
  school_id uuid, target_class uuid, school_session text, school_term text, report_period text,
  reviewed_sheet jsonb, next_resumption_date date
) returns integer language plpgsql security definer set search_path = ''
as $$
declare published_count integer; saved_date date;
begin
  perform private.check_learning_enrolment_scope(school_id,target_class,school_session);
  perform 1 from public.classes c where c.id = target_class and c.workspace_id = school_id for update;

  select (r.snapshot->>'resumption_date')::date into saved_date
  from private.learning_term_reports r
  where r.workspace_id = school_id and r.released_class_id = target_class
    and r.academic_session = school_session and r.term = school_term and r.report_kind = report_period
  order by r.published_at desc, r.id desc limit 1;

  published_count := public.approve_learning_subject_gradebook(
    school_id,target_class,school_session,school_term,report_period,reviewed_sheet
  );

  saved_date := coalesce(next_resumption_date, saved_date);
  update private.learning_term_reports r
  set snapshot = r.snapshot || jsonb_strip_nulls(jsonb_build_object(
    'resumption_date', saved_date, 'admission_reference', nullif(btrim(s.external_reference), '')
  ))
  from public.students s
  where r.workspace_id = school_id and r.released_class_id = target_class
    and r.academic_session = school_session and r.term = school_term and r.report_kind = report_period
    and r.withdrawn_at is null and r.published_at = now() and r.published_by = auth.uid()
    and s.workspace_id = r.workspace_id and s.id = r.student_id;
  return published_count;
end;
$$;

revoke all on function public.approve_learning_subject_gradebook_with_resumption(uuid,uuid,text,text,text,jsonb,date) from public, anon;
grant execute on function public.approve_learning_subject_gradebook_with_resumption(uuid,uuid,text,text,text,jsonb,date) to authenticated;
