create table private.learning_subject_enrolments (
  workspace_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  academic_session text not null,
  subject_ids uuid[] not null check (cardinality(subject_ids) > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id, class_id, academic_session, student_id),
  foreign key (student_id, workspace_id) references public.students(id, workspace_id),
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id)
);

alter table private.learning_subject_enrolments enable row level security;

create function private.check_learning_enrolment_scope(school_id uuid, target_class uuid, school_session text)
returns void language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not coalesce(private.has_workspace_role(school_id, array['owner','admin','leader']), false)
    or not exists (select from public.workspaces w where w.id = school_id and w.workspace_type = 'school' and w.access_status = 'active')
  then raise exception 'School leadership access is required.'; end if;
  if school_session is null or school_session !~ '^[0-9]{4}/[0-9]{4}$'
    or not exists (select from public.classes c where c.id = target_class and c.workspace_id = school_id and c.academic_session = school_session)
  then raise exception 'Choose a class in its academic session.'; end if;
end;
$$;

create function public.get_learning_subject_enrolments(school_id uuid, target_class uuid, school_session text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.check_learning_enrolment_scope(school_id, target_class, school_session);
  return jsonb_build_object(
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name, s.id)
      from public.subjects s
      where s.workspace_id = school_id and exists (
        select from public.teaching_assignments a
        where a.workspace_id = school_id and a.class_id = target_class and a.subject_id = s.id and a.active
      )
    ), '[]'::jsonb),
    'learners', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.display_name, 'subjects', e.subject_ids) order by s.display_name, s.id)
      from public.students s
      left join private.learning_subject_enrolments e
        on e.workspace_id = s.workspace_id and e.student_id = s.id and e.class_id = target_class and e.academic_session = school_session
      where s.workspace_id = school_id and s.class_id = target_class and s.active
    ), '[]'::jsonb)
  );
end;
$$;

create function public.save_learning_subject_enrolment(
  school_id uuid, target_class uuid, school_session text, learner_ids uuid[], selected_subject_ids uuid[]
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.check_learning_enrolment_scope(school_id, target_class, school_session);
  if coalesce(cardinality(learner_ids), 0) not between 1 and 500
    or coalesce(cardinality(selected_subject_ids), 0) not between 1 and 100
  then raise exception 'Select learners and at least one subject.'; end if;

  if (select count(*) from public.students s where s.id = any(learner_ids)
      and s.workspace_id = school_id and s.class_id = target_class and s.active) <> cardinality(learner_ids)
    or (select count(distinct a.subject_id) from public.teaching_assignments a
      where a.subject_id = any(selected_subject_ids) and a.workspace_id = school_id and a.class_id = target_class and a.active)
      <> cardinality(selected_subject_ids)
  then raise exception 'The class roster or teaching assignments have changed. Reload and try again.'; end if;

  insert into private.learning_subject_enrolments (workspace_id, class_id, student_id, academic_session, subject_ids, updated_by)
  select school_id, target_class, learner_id, school_session, selected_subject_ids, auth.uid()
  from unnest(learner_ids) ids(learner_id)
  on conflict (workspace_id, class_id, academic_session, student_id)
  do update set subject_ids = excluded.subject_ids, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

revoke all on function private.check_learning_enrolment_scope(uuid,uuid,text),
  public.get_learning_subject_enrolments(uuid,uuid,text),
  public.save_learning_subject_enrolment(uuid,uuid,text,uuid[],uuid[]) from public, anon;
grant execute on function public.get_learning_subject_enrolments(uuid,uuid,text),
  public.save_learning_subject_enrolment(uuid,uuid,text,uuid[],uuid[]) to authenticated;
