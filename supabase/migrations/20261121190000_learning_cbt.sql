create table private.learning_cbts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  questions jsonb not null,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now()
);

create table private.learning_cbt_submissions (
  cbt_id uuid not null references private.learning_cbts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers jsonb not null,
  feedback jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (cbt_id, student_id)
);

alter table private.learning_cbts enable row level security;
alter table private.learning_cbt_submissions enable row level security;
create index learning_cbts_class_idx on private.learning_cbts(workspace_id, class_id);

create function public.assign_learning_cbt(source_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  source public.assessments;
  snapshot jsonb;
  assigned_id uuid;
begin
  select * into source from public.assessments where id = source_id for share;
  if not found
    or not private.can_view_teacher_artifact(source.workspace_id, 'assessment', source_id)
    or not private.has_workspace_role(source.workspace_id, array['owner','admin','leader','teacher'])
    or not exists (select 1 from public.workspaces w where w.id = source.workspace_id
                   and w.workspace_type = 'school' and w.access_status = 'active')
  then raise exception 'Assessment unavailable.'; end if;

  select id into assigned_id from private.learning_cbts where assessment_id = source_id;
  if found then return assigned_id; end if;
  if source.status <> 'validated' or source.class_id is null then
    raise exception 'Validate the assessment and select a class before assigning it.';
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
      or (q->>'type' = 'objective' and (
        jsonb_typeof(q->'options') is distinct from 'array'
        or nullif(q->>'correct', '') is null
        or not coalesce((q->'options') ? (q->>'correct'), false)
      ))
  ) then raise exception 'Check the assessment prompts, marks and objective answer keys.'; end if;

  insert into private.learning_cbts as c (assessment_id, workspace_id, class_id, title, questions, assigned_by)
    values (source_id, source.workspace_id, source.class_id, source.title, snapshot, auth.uid())
    on conflict (assessment_id) do nothing returning c.id into assigned_id;
  return coalesce(assigned_id, (select id from private.learning_cbts where assessment_id = source_id));
end;
$$;

create function private.learning_cbt_student()
returns public.students language sql stable security definer set search_path = ''
as $$
  select s.*
  from public.student_accounts sa
  join public.students s on s.id = sa.student_id and s.workspace_id = sa.workspace_id
  join public.workspaces w on w.id = sa.workspace_id
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = sa.user_id
  where sa.user_id = auth.uid() and sa.active and s.active
    and w.workspace_type = 'school' and w.access_status = 'active'
    and m.status = 'active' and m.role = 'student';
$$;

create function public.get_learning_cbts(target_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  learner public.students := private.learning_cbt_student();
  result jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'feedback', s.feedback,
    'questions', case when target_id is not null and s.cbt_id is null then (
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

create function public.submit_learning_cbt(target_id uuid, responses jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  learner public.students := private.learning_cbt_student();
  assignment private.learning_cbts;
  result jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;

  select s.feedback into result from private.learning_cbt_submissions s
    join private.learning_cbts c on c.id = s.cbt_id
    where s.cbt_id = target_id and s.student_id = learner.id and c.workspace_id = learner.workspace_id;
  if found then return result; end if;

  select * into assignment from private.learning_cbts
    where id = target_id and workspace_id = learner.workspace_id and class_id = learner.class_id;
  if not found then raise exception 'CBT unavailable.'; end if;

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
  return (select s.feedback from private.learning_cbt_submissions s
          where s.cbt_id = target_id and s.student_id = learner.id);
end;
$$;

revoke all on function private.learning_cbt_student() from public, anon, authenticated;
revoke all on function public.assign_learning_cbt(uuid), public.get_learning_cbts(uuid),
  public.submit_learning_cbt(uuid, jsonb) from public, anon;
grant execute on function public.assign_learning_cbt(uuid), public.get_learning_cbts(uuid),
  public.submit_learning_cbt(uuid, jsonb) to authenticated;
