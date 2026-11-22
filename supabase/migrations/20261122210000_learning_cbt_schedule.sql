alter table private.learning_cbts
  add column opens_at timestamptz,
  add column closes_at timestamptz,
  add constraint learning_cbt_window check (
    (opens_at is null and closes_at is null) or
    (opens_at is not null and closes_at is not null and opens_at < closes_at)
  );

create function public.schedule_learning_cbt(source_id uuid, opens_at timestamptz, closes_at timestamptz)
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
  if existing.id is not null then
    if existing.opens_at = opens_at and existing.closes_at = closes_at then return assignment_id; end if;
    raise exception 'This assessment is already assigned.';
  end if;
  update private.learning_cbts c set opens_at = schedule_learning_cbt.opens_at,
    closes_at = schedule_learning_cbt.closes_at where c.id = assignment_id;
  return assignment_id;
end;
$$;

create function private.learning_visible_feedback(feedback jsonb, closes_at timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  select case when closes_at > statement_timestamp() then feedback - 'review' else feedback end;
$$;

create function public.get_learning_cbt_staff_status(source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
begin
  if assignment.id is null then return null; end if;
  return jsonb_build_object('opensAt', assignment.opens_at, 'closesAt', assignment.closes_at);
end;
$$;

revoke all on function private.learning_visible_feedback(jsonb, timestamptz),
  public.schedule_learning_cbt(uuid, timestamptz, timestamptz),
  public.get_learning_cbt_staff_status(uuid) from public, anon, authenticated;
grant execute on function public.schedule_learning_cbt(uuid, timestamptz, timestamptz),
  public.get_learning_cbt_staff_status(uuid) to authenticated;

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
  where c.workspace_id = learner.workspace_id
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
    where id = target_id and workspace_id = learner.workspace_id and class_id = learner.class_id for share;
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

create function public.list_learning_assessments(school_id uuid, search_text text, page_offset integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc, row_data.id), '[]'::jsonb)
  from (
    select a.id, a.title, a.status, a.class_id, c.name as class_name, a.updated_at,
      b.id is not null as assigned, b.opens_at, b.closes_at, r.action as review_status
    from public.assessments a
    join public.workspaces w on w.id = a.workspace_id
    left join public.classes c on c.id = a.class_id and c.workspace_id = a.workspace_id
    left join private.learning_cbts b on b.assessment_id = a.id
    left join lateral (
      select action from private.learning_result_reviews where cbt_id = b.id order by revision desc limit 1
    ) r on true
    where a.workspace_id = school_id and w.workspace_type = 'school' and w.access_status = 'active'
      and a.status <> 'archived'
      and private.has_workspace_role(a.workspace_id, array['owner','admin','leader','teacher'])
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
      and (coalesce(search_text, '') = '' or strpos(lower(a.title), lower(search_text)) > 0
        or strpos(lower(c.name), lower(search_text)) > 0)
    order by a.updated_at desc, a.id
    limit 21 offset greatest(coalesce(page_offset, 0), 0)
  ) row_data;
$$;
revoke all on function public.list_learning_assessments(uuid, text, integer) from public, anon;
grant execute on function public.list_learning_assessments(uuid, text, integer) to authenticated;

create function public.get_learning_cbt_item_insights(source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
  insights jsonb;
begin
  if assignment.id is null then raise exception 'Score sheet unavailable.'; end if;
  with responses as (
    select item->>'id' as id, count(*) as submitted,
      count(*) filter (where item->>'answer' = item->>'correct') as correct,
      count(*) filter (where item->>'answer' is null) as blank
    from private.learning_cbt_submissions s
    cross join lateral jsonb_array_elements(s.feedback->'review') item
    where s.cbt_id = assignment.id and item->>'type' = 'objective'
    group by item->>'id'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'position', q.ordinality, 'prompt', q.value->>'prompt', 'submitted', r.submitted,
    'correct', r.correct, 'blank', r.blank
  ) order by r.correct::numeric / r.submitted, q.ordinality), '[]'::jsonb) into insights
  from jsonb_array_elements(assignment.questions) with ordinality q
  join responses r on r.id = q.value->>'id';
  return insights;
end;
$$;
revoke all on function public.get_learning_cbt_item_insights(uuid) from public, anon;
grant execute on function public.get_learning_cbt_item_insights(uuid) to authenticated;
