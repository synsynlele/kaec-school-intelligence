-- Keep the order and answer-release policy for existing assignments.
alter table private.learning_cbts add column shuffle_questions boolean not null default false;
alter table private.learning_cbts alter column shuffle_questions set default true;

create or replace function public.get_learning_cbts(target_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  learner public.students := private.learning_cbt_student();
  result jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'feedback', private.learning_visible_feedback(s.feedback, case when not c.shuffle_questions then c.closes_at end),
    'opensAt', c.opens_at, 'closesAt', c.closes_at,
    'availability', case when c.opens_at > statement_timestamp() then 'scheduled'
      when c.closes_at <= statement_timestamp() then 'closed' else 'open' end,
    'questions', case when target_id is not null and s.cbt_id is null
      and (c.opens_at is null or (c.opens_at <= statement_timestamp() and c.closes_at > statement_timestamp())) then (
      select jsonb_agg(q.value - 'correct' order by case when c.shuffle_questions then md5(concat_ws(':', c.id, learner.id, q.value->>'id')) end, q.ordinality)
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

  select private.learning_visible_feedback(s.feedback, case when not c.shuffle_questions then c.closes_at end) into result from private.learning_cbt_submissions s
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
    'review', jsonb_agg(question || jsonb_build_object('answer', answer, 'earned', earned) order by case when assignment.shuffle_questions then md5(concat_ws(':', assignment.id, learner.id, question->>'id')) end, position)
  ) into result from scored;

  insert into private.learning_cbt_submissions(cbt_id, student_id, answers, feedback)
    values (target_id, learner.id, responses, result)
    on conflict (cbt_id, student_id) do nothing;
  return (select private.learning_visible_feedback(s.feedback, case when not assignment.shuffle_questions then assignment.closes_at end) from private.learning_cbt_submissions s
          where s.cbt_id = target_id and s.student_id = learner.id);
end;
$$;

