alter table private.learning_term_reports
  add column withdrawn_at timestamptz,
  add column withdrawn_by uuid references auth.users(id) on delete set null,
  add column withdrawal_reason text;

-- Keep prior versions while permitting only one currently published version.
do $$
declare
  constraint_name name;
begin
  select conname into strict constraint_name
  from pg_catalog.pg_constraint
  where conrelid = 'private.learning_term_reports'::regclass and contype = 'u';
  execute format('alter table private.learning_term_reports drop constraint %I', constraint_name);
end;
$$;

create unique index learning_term_reports_one_published
  on private.learning_term_reports (workspace_id, student_id, academic_session, term, report_kind)
  where withdrawn_at is null;

create or replace function public.learning_term_report_preview(
  school_id uuid, target_learner uuid, school_session text, school_term text
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  learner public.students;
  result jsonb;
  enrolled_subjects uuid[];
begin
  if not coalesce(private.has_workspace_role(school_id, array['owner','admin','leader']), false)
    or not exists (select from public.workspaces w where w.id = school_id and w.workspace_type = 'school' and w.access_status = 'active')
  then raise exception 'School leadership access is required.'; end if;

  select * into learner from public.students s where s.id = target_learner and s.workspace_id = school_id and s.active;
  if not found then raise exception 'Choose an active learner in your school.'; end if;

  select e.subject_ids into enrolled_subjects
  from private.learning_subject_enrolments e
  where e.workspace_id = school_id and e.class_id = learner.class_id
    and e.student_id = learner.id and e.academic_session = school_session;

  select jsonb_build_object(
    'learner_name', learner.display_name, 'school_name', w.name, 'school_logo', w.logo_url,
    'class_name', (select cl.name from public.classes cl where cl.id = learner.class_id and cl.workspace_id = school_id),
    'academic_session', school_session, 'term', school_term,
    'enrolled_subject_ids', enrolled_subjects,
    'published_reports', coalesce((
      select jsonb_object_agg(r.report_kind, r.id)
      from private.learning_term_reports r
      where r.workspace_id = school_id and r.student_id = learner.id
        and r.academic_session = school_session and r.term = school_term and r.withdrawn_at is null
    ), '{}'::jsonb),
    'withdrawal_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.report_kind, 'withdrawn_at', r.withdrawn_at, 'reason', r.withdrawal_reason
      ) order by r.withdrawn_at desc, r.id)
      from private.learning_term_reports r
      where r.workspace_id = school_id and r.student_id = learner.id
        and r.academic_session = school_session and r.term = school_term and r.withdrawn_at is not null
    ), '[]'::jsonb),
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', r.snapshot->>'title', 'subject', subj.name, 'subject_id', a.subject_id,
        'scores', entry.value - 'id' - 'name' - 'revision' - 'editable', 'maxima', r.snapshot->'maxima'
      ) order by subj.name, r.recorded_at, c.id)
      from private.learning_cbts c
      join private.learning_result_reviews r on r.cbt_id = c.id and r.action = 'published'
      join public.assessments a on a.id = c.assessment_id and a.workspace_id = c.workspace_id
      left join public.subjects subj on subj.id = a.subject_id and subj.workspace_id = c.workspace_id
      left join public.classes cl on cl.id = c.class_id and cl.workspace_id = c.workspace_id
      cross join lateral jsonb_array_elements(r.snapshot->'roster') entry
      where c.workspace_id = school_id and entry.value->>'id' = learner.id::text
        and coalesce(nullif(a.blueprint->>'academicSession',''), cl.academic_session) = school_session
        and (enrolled_subjects is null or (c.class_id = learner.class_id and a.subject_id = any(enrolled_subjects)))
        and lower(btrim(a.blueprint->>'term')) = lower(btrim(school_term))
    ), '[]'::jsonb)
  ) into result from public.workspaces w where w.id = school_id;
  return result;
end;
$$;

create or replace function public.get_my_parent_term_reports(report_id uuid default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('id', r.id, 'learner_id', r.student_id, 'learner_name', r.snapshot->>'learner_name',
      'academic_session', r.academic_session, 'term', r.term, 'kind', r.report_kind, 'published_at', r.published_at)
      || case when report_id is not null then r.snapshot else '{}'::jsonb end
    order by r.published_at desc, r.id
  ), '[]'::jsonb)
  from private.learning_parent_links l
  join private.learning_term_reports r on r.student_id = l.learner_id
  join public.students s on s.id = r.student_id and s.workspace_id = r.workspace_id and s.active
  where l.parent_id = auth.uid()
    and private.learning_report_parent_can_read(r.student_id, r.workspace_id)
    and r.withdrawn_at is null
    and (report_id is null or r.id = report_id);
$$;

create function public.withdraw_learning_term_report(school_id uuid, report_id uuid, reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce(private.has_workspace_role(school_id, array['owner','admin','leader']), false)
    or not exists (select from public.workspaces w where w.id = school_id and w.workspace_type = 'school' and w.access_status = 'active')
  then raise exception 'School leadership access is required.'; end if;

  if reason is null or char_length(btrim(reason)) not between 1 and 500 then
    raise exception 'Enter a withdrawal reason of up to 500 characters.';
  end if;

  update private.learning_term_reports r
  set withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawal_reason = btrim(reason)
  where r.id = report_id and r.workspace_id = school_id and r.withdrawn_at is null;
  if not found then raise exception 'The published report is no longer available. Preview again.'; end if;
end;
$$;

revoke all on function public.withdraw_learning_term_report(uuid,uuid,text) from public, anon;
grant execute on function public.withdraw_learning_term_report(uuid,uuid,text) to authenticated;

create or replace function public.publish_learning_term_report(
  school_id uuid, target_learner uuid, school_session text, school_term text, report_kind text, selected_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  report jsonb;
  selected jsonb;
  report_id uuid;
begin
  if school_session is null or school_session !~ '^[0-9]{4}/[0-9]{4}$'
    or school_term is null or school_term not in ('First Term','Second Term','Third Term')
    or report_kind is null or report_kind not in ('midterm','term')
    or coalesce(cardinality(selected_ids), 0) not between 1 and 100
  then raise exception 'Choose a term, report type and up to 100 published assessments.'; end if;

  report := public.learning_term_report_preview(school_id, target_learner, school_session, school_term);
  select coalesce(jsonb_agg(item order by position), '[]'::jsonb) into selected
  from jsonb_array_elements(report->'assessments') with ordinality rows(item, position)
  where (item->>'id')::uuid = any(selected_ids);
  if jsonb_array_length(selected) <> cardinality(selected_ids) then
    raise exception 'The selected assessments changed. Preview the report again.';
  end if;

  if jsonb_typeof(report->'enrolled_subject_ids') = 'array' and
    (select count(distinct item->>'subject_id') from jsonb_array_elements(selected) entries(item))
      <> jsonb_array_length(report->'enrolled_subject_ids')
  then raise exception 'Select a result for every enrolled subject.'; end if;

  insert into private.learning_term_reports (workspace_id, student_id, academic_session, term, report_kind, published_by, snapshot)
  values (school_id, target_learner, school_session, school_term, report_kind, auth.uid(), jsonb_set(report - 'published_reports' - 'withdrawal_history' - 'enrolled_subject_ids', '{assessments}', selected))
  on conflict do nothing returning id into report_id;
  if report_id is null then raise exception 'This report is already published.'; end if;
  return report_id;
end;
$$;
