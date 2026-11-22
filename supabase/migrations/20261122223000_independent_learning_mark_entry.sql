alter table private.learning_cbts add column cbt_enabled boolean not null default true;

create function private.prepare_learning_assessment(source_id uuid, enable_cbt boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  source public.assessments;
  snapshot jsonb;
  existing private.learning_cbts;
  maxima jsonb;
  objective_questions jsonb;
begin
  select * into source from public.assessments where id = source_id for update;
  if not found
    or not private.can_view_teacher_artifact(source.workspace_id, 'assessment', source_id)
    or not private.has_workspace_role(source.workspace_id, case when enable_cbt then array['owner','admin','leader','teacher'] else array['owner','admin','teacher'] end)
    or not exists (select 1 from public.workspaces w where w.id = source.workspace_id
                   and w.workspace_type = 'school' and w.access_status = 'active')
  then raise exception 'Assessment unavailable.'; end if;

  select * into existing from private.learning_cbts where assessment_id = source_id;
  if existing.id is not null and (existing.cbt_enabled or not enable_cbt) then return existing.id; end if;
  if source.status <> 'validated' or source.class_id is null then
    raise exception 'Validate the assessment and select a class before entering marks or assigning CBT.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', i.id, 'prompt', i.content->>'prompt', 'type', i.item_type, 'marks', i.marks,
    'options', case when i.item_type = 'objective' then i.content->'options' end,
    'correct', case when i.item_type = 'objective' then i.answer_key->>'correctAnswer' end
  ) order by i.position) into snapshot
  from public.assessment_items i where i.assessment_id = source_id;

  if snapshot is null or exists (
    select 1 from jsonb_array_elements(snapshot) q
    where nullif(trim(q->>'prompt'), '') is null or q->>'marks' is null
      or (enable_cbt and q->>'type' = 'objective' and (
        jsonb_typeof(q->'options') is distinct from 'array'
        or nullif(q->>'correct', '') is null
        or not coalesce((q->'options') ? (q->>'correct'), false)
      ))
  ) then raise exception 'Check the assessment prompts, marks and objective answer keys.'; end if;

  select jsonb_agg(q.value order by q.ordinality) into objective_questions
  from jsonb_array_elements(snapshot) with ordinality q
  where q.value->>'type' = 'objective';
  if enable_cbt and objective_questions is null then
    raise exception 'Add objective questions before assigning a CBT.';
  end if;
  maxima := private.learning_section_maxima(snapshot);
  if existing.id is not null then
    if existing.class_id is distinct from source.class_id or existing.section_maxima is distinct from maxima then
      raise exception 'The class or section mark limits changed after the score sheet was opened.';
    end if;
    update private.learning_cbts set questions = objective_questions, cbt_enabled = true where id = existing.id;
    return existing.id;
  end if;

  insert into private.learning_cbts as c
    (assessment_id, workspace_id, class_id, title, questions, assigned_by, section_maxima, cbt_enabled)
  values (source_id, source.workspace_id, source.class_id, source.title,
          case when enable_cbt then objective_questions else '[]'::jsonb end, auth.uid(), maxima, enable_cbt)
  returning c.id into existing.id;
  return existing.id;
end;
$$;

create or replace function public.assign_learning_cbt(source_id uuid)
returns uuid language sql security definer set search_path = '' as $$
  select private.prepare_learning_assessment(source_id, true);
$$;

create function public.open_learning_score_sheet(source_id uuid)
returns uuid language sql security definer set search_path = '' as $$
  select private.prepare_learning_assessment(source_id, false);
$$;

revoke all on function private.prepare_learning_assessment(uuid, boolean), public.open_learning_score_sheet(uuid)
  from public, anon, authenticated;
grant execute on function public.open_learning_score_sheet(uuid) to authenticated;

create or replace function public.schedule_learning_cbt(source_id uuid, opens_at timestamptz, closes_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing private.learning_cbts;
  assignment_id uuid;
begin
  if opens_at is null or closes_at is null or opens_at <= statement_timestamp() or closes_at <= opens_at
    or not isfinite(opens_at) or not isfinite(closes_at) then
    raise exception 'Choose a future opening time and a later closing time.';
  end if;
  -- Serialise first assignment against both the existing and scheduled entry points.
  perform 1 from public.assessments where id = source_id for update;
  select * into existing from private.learning_cbts where assessment_id = source_id;
  assignment_id := public.assign_learning_cbt(source_id);
  if existing.cbt_enabled then
    if existing.opens_at = opens_at and existing.closes_at = closes_at then return assignment_id; end if;
    raise exception 'This assessment is already assigned.';
  end if;
  update private.learning_cbts c set opens_at = schedule_learning_cbt.opens_at,
    closes_at = schedule_learning_cbt.closes_at where c.id = assignment_id;
  return assignment_id;
end;
$$;

create or replace function public.get_learning_cbt_staff_status(source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
begin
  if assignment.id is null then return null; end if;
  return jsonb_build_object('enabled', assignment.cbt_enabled, 'opensAt', assignment.opens_at, 'closesAt', assignment.closes_at);
end;
$$;

create or replace function public.get_learning_cbts(target_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  learner public.students := private.learning_cbt_student();
  result jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'feedback', private.learning_visible_feedback(s.feedback, c.closes_at),
    'opensAt', c.opens_at, 'closesAt', c.closes_at,
    'availability', case when c.opens_at > statement_timestamp() then 'scheduled'
      when c.closes_at <= statement_timestamp() then 'closed' else 'open' end,
    'questions', case when target_id is not null and s.cbt_id is null
      and (c.opens_at is null or (c.opens_at <= statement_timestamp() and c.closes_at > statement_timestamp())) then (
      select jsonb_agg(q.value - 'correct' order by q.ordinality)
      from jsonb_array_elements(c.questions) with ordinality q
    ) end
  ) order by c.assigned_at desc), '[]'::jsonb) into result
  from private.learning_cbts c
  left join private.learning_cbt_submissions s on s.cbt_id = c.id and s.student_id = learner.id
  where c.cbt_enabled and c.workspace_id = learner.workspace_id
    and (c.class_id = learner.class_id or s.cbt_id is not null)
    and (target_id is null or c.id = target_id);
  return result;
end;
$$;

create or replace function public.submit_learning_cbt(target_id uuid, responses jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  learner public.students := private.learning_cbt_student();
  assignment private.learning_cbts;
  result jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;

  select private.learning_visible_feedback(s.feedback, c.closes_at) into result from private.learning_cbt_submissions s
    join private.learning_cbts c on c.id = s.cbt_id
    where s.cbt_id = target_id and s.student_id = learner.id and c.workspace_id = learner.workspace_id;
  if found then return result; end if;

  select * into assignment from private.learning_cbts
    where id = target_id and cbt_enabled and workspace_id = learner.workspace_id and class_id = learner.class_id for share;
  if not found then raise exception 'CBT unavailable.'; end if;

  if assignment.opens_at > statement_timestamp() then raise exception 'This CBT has not opened yet.'; end if;
  if assignment.closes_at <= statement_timestamp() then raise exception 'This CBT has closed.'; end if;

  if jsonb_typeof(responses) is distinct from 'object' or octet_length(responses::text) > 262144 then
    raise exception 'Invalid or oversized response.';
  end if;
  if exists (
    select 1 from jsonb_each(responses) r
    left join jsonb_array_elements(assignment.questions) q on q->>'id' = r.key
    where q is null or jsonb_typeof(r.value) <> 'string'
      or (q->>'type' = 'objective' and not ((q->'options') ? (r.value #>> '{}')))
  ) then raise exception 'Invalid answer.'; end if;

  with questions as (
    select q.value as question, q.ordinality as position, responses->>(q.value->>'id') as answer
    from jsonb_array_elements(assignment.questions) with ordinality q
  ), scored as (
    select *, case when question->>'type' = 'objective' then
      case when answer = question->>'correct' then (question->>'marks')::numeric else 0 end
    end as earned
    from questions
  )
  select jsonb_build_object(
    'earned', coalesce(sum(earned), 0),
    'possible', coalesce(sum((question->>'marks')::numeric) filter (where earned is not null), 0),
    'awaitingMarking', count(*) filter (where earned is null),
    'review', jsonb_agg(question || jsonb_build_object('answer', answer, 'earned', earned) order by position)
  ) into result from scored;

  insert into private.learning_cbt_submissions(cbt_id, student_id, answers, feedback)
    values (target_id, learner.id, responses, result)
    on conflict (cbt_id, student_id) do nothing;
  return (select private.learning_visible_feedback(s.feedback, assignment.closes_at) from private.learning_cbt_submissions s
          where s.cbt_id = target_id and s.student_id = learner.id);
end;
$$;

create or replace function public.get_learning_score_sheet(source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
  roster jsonb;
  writable private.learning_cbts;
begin
  if assignment.id is null then raise exception 'Score sheet has not been opened.'; end if;
  writable := private.learning_score_sheet_assignment(source_id, true);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.display_name, 'objective', (b.feedback->>'earned')::numeric,
    'subjective', p.subjective, 'critical_thinking', p.critical_thinking,
    'project', p.project, 'revision', coalesce(p.revision, 0),
    'editable', s.active and s.class_id is not distinct from assignment.class_id
  ) order by s.display_name, s.id), '[]'::jsonb) into roster
  from public.students s
  left join private.learning_cbt_submissions b on b.cbt_id = assignment.id and b.student_id = s.id
  left join private.learning_paper_scores p on p.cbt_id = assignment.id and p.student_id = s.id
  where s.workspace_id = assignment.workspace_id
    and ((s.class_id = assignment.class_id and s.active) or b.cbt_id is not null or p.cbt_id is not null);

  return jsonb_build_object('title', assignment.title,
    'maxima', coalesce(assignment.section_maxima, private.learning_section_maxima(assignment.questions)),
    'cbt_enabled', assignment.cbt_enabled, 'writable', writable.id is not null, 'roster', roster);
end;
$$;

create or replace function public.list_learning_assessments(school_id uuid, search_text text, page_offset integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc, row_data.id), '[]'::jsonb)
  from (
    select a.id, a.title, a.status, a.class_id, c.name as class_name, a.updated_at,
      coalesce(b.cbt_enabled, false) as assigned, b.opens_at, b.closes_at, r.action as review_status,
      s.name as subject_name, progress.learners, progress.marked
    from public.assessments a
    join public.workspaces w on w.id = a.workspace_id
    left join public.classes c on c.id = a.class_id and c.workspace_id = a.workspace_id
    left join public.subjects s on s.id = a.subject_id and s.workspace_id = a.workspace_id
    left join private.learning_cbts b on b.assessment_id = a.id
    left join lateral (
      select action from private.learning_result_reviews where cbt_id = b.id order by revision desc limit 1
    ) r on true
    left join lateral (
      select count(*) as learners, count(*) filter (where
        case when coalesce((b.section_maxima->>'subjective')::numeric,0)
                + coalesce((b.section_maxima->>'critical_thinking')::numeric,0)
                + coalesce((b.section_maxima->>'project')::numeric,0) > 0
          then (coalesce((b.section_maxima->>'subjective')::numeric,0) = 0 or p.subjective is not null)
            and (coalesce((b.section_maxima->>'critical_thinking')::numeric,0) = 0 or p.critical_thinking is not null)
            and (coalesce((b.section_maxima->>'project')::numeric,0) = 0 or p.project is not null)
          else sub.student_id is not null
        end) as marked
      from public.students l
      left join private.learning_paper_scores p on p.cbt_id = b.id and p.student_id = l.id
      left join private.learning_cbt_submissions sub on sub.cbt_id = b.id and sub.student_id = l.id
      where l.workspace_id = a.workspace_id and l.class_id = a.class_id and l.active
    ) progress on true
    where a.workspace_id = school_id and w.workspace_type = 'school' and w.access_status = 'active'
      and a.status <> 'archived'
      and private.has_workspace_role(a.workspace_id, array['owner','admin','leader','teacher'])
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
      and (coalesce(search_text, '') = '' or strpos(lower(a.title), lower(search_text)) > 0
        or strpos(lower(c.name), lower(search_text)) > 0 or strpos(lower(s.name), lower(search_text)) > 0)
    order by a.updated_at desc, a.id
    limit 21 offset greatest(coalesce(page_offset, 0), 0)
  ) row_data;
$$;
