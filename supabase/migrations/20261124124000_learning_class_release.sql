alter table private.learning_term_reports add column released_class_id uuid references public.classes(id);

create table private.learning_broadsheet_sources (
  workspace_id uuid not null,
  class_id uuid not null,
  academic_session text not null,
  term text not null,
  report_kind text not null check (report_kind in ('midterm', 'term')),
  sources jsonb not null,
  primary key (workspace_id, class_id, academic_session, term, report_kind)
);
alter table private.learning_broadsheet_sources enable row level security;

create function public.get_learning_broadsheet_period(
  school_id uuid, target_class uuid, school_session text, school_term text, report_kind text
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare sheet jsonb;
begin
  if report_kind is null or report_kind not in ('midterm', 'term') then
    raise exception 'Choose Mid-Term or Terminal.';
  end if;
  sheet := public.preview_learning_class_broadsheet(school_id, target_class, school_session, school_term);
  return sheet || jsonb_build_object(
    'selected', coalesce((select s.sources from private.learning_broadsheet_sources s
      where (s.workspace_id,s.class_id,s.academic_session,s.term,s.report_kind) =
        (school_id,target_class,school_session,school_term,get_learning_broadsheet_period.report_kind)), '{}'),
    'reserved', coalesce((select jsonb_agg(source.value) from private.learning_broadsheet_sources s
      cross join lateral jsonb_each_text(s.sources) source
      where (s.workspace_id,s.class_id,s.academic_session,s.term) = (school_id,target_class,school_session,school_term)
        and s.report_kind <> get_learning_broadsheet_period.report_kind), '[]')
  );
end;
$$;

create function public.save_learning_broadsheet_period(
  school_id uuid, target_class uuid, school_session text, school_term text, report_kind text,
  selected_sources jsonb, previous_sources jsonb
) returns void language plpgsql security definer set search_path = ''
as $$
declare sheet jsonb;
begin
  perform private.check_learning_enrolment_scope(school_id,target_class,school_session);
  perform 1 from public.classes c where c.id = target_class and c.workspace_id = school_id for update;
  sheet := public.get_learning_broadsheet_period(school_id,target_class,school_session,school_term,report_kind);
  if previous_sources is distinct from sheet->'selected' then raise exception 'Reload the broadsheet. Selections have changed.'; end if;
  if jsonb_typeof(selected_sources) is distinct from 'object' then raise exception 'Choose assessments by subject.'; end if;
  if exists (
    select from jsonb_each_text(selected_sources) chosen
    where (sheet->'reserved') ? chosen.value
      or not exists (select from jsonb_array_elements(sheet->'subjects') s where s->>'id' = chosen.key)
      or not exists (select from jsonb_array_elements(sheet->'learners') l
        cross join lateral jsonb_array_elements(l->'assessments') a
        where a->>'id' = chosen.value and a->>'subject_id' = chosen.key)
  ) then raise exception 'An assessment is unavailable or assigned to the other period.'; end if;
  insert into private.learning_broadsheet_sources values (school_id,target_class,school_session,school_term,report_kind,selected_sources)
  on conflict on constraint learning_broadsheet_sources_pkey do update set sources = excluded.sources;
end;
$$;

create function public.publish_learning_class_reports(
  school_id uuid, target_class uuid, school_session text, school_term text, report_kind text, expected_sources jsonb, mastery_cutoff integer default 60
) returns integer language plpgsql security definer set search_path = ''
as $$
declare
  sheet jsonb;
  learner jsonb;
  sources uuid[];
  new_report uuid;
  published_count integer := 0;
begin
  perform private.check_learning_enrolment_scope(school_id,target_class,school_session);
  perform 1 from public.classes c where c.id = target_class and c.workspace_id = school_id for update;
  sheet := public.get_learning_broadsheet_period(school_id,target_class,school_session,school_term,report_kind);
  if mastery_cutoff is null or mastery_cutoff not between 1 and 99 then raise exception 'Choose a mastery threshold from 1 to 99.'; end if;
  if expected_sources is distinct from sheet->'selected' then raise exception 'Reload the broadsheet. Selections have changed.'; end if;
  if jsonb_array_length(sheet->'learners') = 0 then raise exception 'There are no active learners in this class.'; end if;
  for learner in select value from jsonb_array_elements(sheet->'learners') loop
    if jsonb_typeof(learner->'subjects') is distinct from 'array' then raise exception 'Confirm subject enrolment for %.', learner->>'name'; end if;
    select array_agg((a->>'id')::uuid order by a->>'subject_id') into sources
    from jsonb_array_elements(learner->'assessments') a
    where a->>'id' = sheet->'selected'->>(a->>'subject_id')
      and exists (select from jsonb_each_text(a->'maxima') m where m.value::numeric > 0)
      and not exists (select from jsonb_each_text(a->'maxima') m where m.value::numeric > 0
        and a->'scores'->>m.key is null and not coalesce((a->'scores'->'excused') ? m.key,false));
    if coalesce(cardinality(sources),0) <> jsonb_array_length(learner->'subjects') then
      raise exception 'Complete every enrolled subject result for %.', learner->>'name';
    end if;
    new_report := public.publish_learning_term_report(school_id,(learner->>'id')::uuid,school_session,school_term,report_kind,sources);
    update private.learning_term_reports r
    set released_class_id = target_class,
      snapshot = r.snapshot || jsonb_build_object('mastery_progressing_at', mastery_cutoff, 'passport_photo',
        (select photo.jpeg from private.learning_passport_photos photo where photo.learner_id = r.student_id))
    where r.id = new_report;
    published_count := published_count + 1;
  end loop;
  return published_count;
end;
$$;

create function public.withdraw_learning_class_reports(
  school_id uuid, target_class uuid, school_session text, school_term text, report_kind text, reason text
) returns integer language plpgsql security definer set search_path = ''
as $$
declare withdrawn_count integer;
begin
  perform private.check_learning_enrolment_scope(school_id,target_class,school_session);
  perform 1 from public.classes c where c.id = target_class and c.workspace_id = school_id for update;
  if reason is null or char_length(btrim(reason)) not between 1 and 500 then raise exception 'Enter a withdrawal reason.'; end if;
  update private.learning_term_reports r
  set withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawal_reason = btrim(reason)
  where (r.workspace_id,r.released_class_id,r.academic_session,r.term,r.report_kind) =
    (school_id,target_class,school_session,school_term,withdraw_learning_class_reports.report_kind)
    and r.withdrawn_at is null;
  get diagnostics withdrawn_count = row_count;
  return withdrawn_count;
end;
$$;

create function public.get_published_learning_class_reports(
  school_id uuid, target_class uuid, school_session text, school_term text, report_kind text
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.check_learning_enrolment_scope(school_id,target_class,school_session);
  return (select coalesce(jsonb_agg(r.snapshot || jsonb_build_object(
    'id',r.id,'kind',r.report_kind,'learner_id',r.student_id,'published_at',r.published_at
  ) order by r.snapshot->>'learner_name',r.id),'[]')
  from private.learning_term_reports r
  where (r.workspace_id,r.released_class_id,r.academic_session,r.term,r.report_kind) =
    (school_id,target_class,school_session,school_term,get_published_learning_class_reports.report_kind)
    and r.withdrawn_at is null);
end;
$$;

create function public.get_my_learner_term_reports(report_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare learner public.students := private.learning_cbt_student();
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  return (select coalesce(jsonb_agg(
    jsonb_build_object('id',r.id,'kind',r.report_kind,'learner_id',r.student_id,'learner_name',r.snapshot->>'learner_name',
      'academic_session',r.academic_session,'term',r.term,'published_at',r.published_at)
    || case when report_id is null then '{}'::jsonb else r.snapshot end
    order by r.published_at desc,r.id),'[]')
  from private.learning_term_reports r
  where r.workspace_id = learner.workspace_id and r.student_id = learner.id and r.withdrawn_at is null
    and (report_id is null or r.id = report_id));
end;
$$;

revoke all on function public.get_learning_broadsheet_period(uuid,uuid,text,text,text),
  public.save_learning_broadsheet_period(uuid,uuid,text,text,text,jsonb,jsonb),
  public.publish_learning_class_reports(uuid,uuid,text,text,text,jsonb,integer),
  public.withdraw_learning_class_reports(uuid,uuid,text,text,text,text),
  public.get_published_learning_class_reports(uuid,uuid,text,text,text),
  public.get_my_learner_term_reports(uuid) from public, anon;
grant execute on function public.get_learning_broadsheet_period(uuid,uuid,text,text,text),
  public.save_learning_broadsheet_period(uuid,uuid,text,text,text,jsonb,jsonb),
  public.publish_learning_class_reports(uuid,uuid,text,text,text,jsonb,integer),
  public.withdraw_learning_class_reports(uuid,uuid,text,text,text,text),
  public.get_published_learning_class_reports(uuid,uuid,text,text,text),
  public.get_my_learner_term_reports(uuid) to authenticated;

create function public.publish_learning_class_batch(
  school_id uuid, school_session text, school_term text, report_kind text, reviewed_classes jsonb, mastery_cutoff integer
) returns integer language plpgsql security definer set search_path = ''
as $$
declare
  reviewed record;
  published_count integer := 0;
begin
  if jsonb_typeof(reviewed_classes) is distinct from 'object' or reviewed_classes = '{}'::jsonb then
    raise exception 'Add at least one reviewed class.';
  end if;
  for reviewed in select key, value from jsonb_each(reviewed_classes) order by key loop
    published_count := published_count + public.publish_learning_class_reports(
      school_id, reviewed.key::uuid, school_session, school_term, report_kind, reviewed.value, mastery_cutoff
    );
  end loop;
  return published_count;
end;
$$;

revoke all on function public.publish_learning_class_batch(uuid,text,text,text,jsonb,integer) from public, anon;
grant execute on function public.publish_learning_class_batch(uuid,text,text,text,jsonb,integer) to authenticated;
