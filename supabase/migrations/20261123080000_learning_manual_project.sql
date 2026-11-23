create function public.create_learning_project(
  school_id uuid, target_class uuid, target_subject uuid, project_title text,
  academic_session text, school_term text, maximum numeric
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  project_id uuid;
begin
  if auth.uid() is null
    or not coalesce(private.has_workspace_role(school_id, array['owner','admin','teacher']), false)
    or not exists (select from public.workspaces w where w.id = school_id and w.workspace_type = 'school' and w.access_status = 'active')
    or not exists (select from public.classes c where c.id = target_class and c.workspace_id = school_id)
    or not exists (select from public.subjects s where s.id = target_subject and s.workspace_id = school_id)
  then raise exception 'Choose a class and subject in your active school.'; end if;

  if char_length(btrim(coalesce(project_title, ''))) not between 1 and 160
    or academic_session is null or academic_session !~ '^[0-9]{4}/[0-9]{4}$'
    or school_term is null or school_term not in ('First Term','Second Term','Third Term')
    or maximum is null or maximum < 0.01 or maximum > 10000 or round(maximum, 2) <> maximum
  then raise exception 'Enter a title, session, term and a valid maximum mark.'; end if;

  insert into public.assessments (workspace_id, created_by, class_id, subject_id, title, assessment_mode, status, blueprint)
  values (school_id, auth.uid(), target_class, target_subject, btrim(project_title), 'project', 'validated',
          jsonb_build_object('academicSession', academic_session, 'term', school_term, 'origin', 'manual_project'))
  returning id into project_id;

  insert into public.assessment_items (assessment_id, position, item_type, content, marks)
  values (project_id, 1, 'project', jsonb_build_object('prompt', btrim(project_title)), maximum);

  perform public.open_learning_score_sheet(project_id);
  return project_id;
end;
$$;

revoke all on function public.create_learning_project(uuid, uuid, uuid, text, text, text, numeric) from public, anon;
grant execute on function public.create_learning_project(uuid, uuid, uuid, text, text, text, numeric) to authenticated;
