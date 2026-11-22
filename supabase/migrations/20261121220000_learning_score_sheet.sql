alter table private.learning_cbts add column section_maxima jsonb;

create function private.learning_section_maxima(questions jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'objective', coalesce(sum(marks) filter (where kind = 'objective'), 0),
    'subjective', coalesce(sum(marks) filter (where kind = 'subjective'), 0),
    'critical_thinking', coalesce(sum(marks) filter (where kind = 'critical_thinking'), 0),
    'project', coalesce(sum(marks) filter (where kind = 'project'), 0)
  )
  from (
    select q->>'type' as kind, (q->>'marks')::numeric as marks
    from jsonb_array_elements(questions) q
  ) items;
$$;

create table private.learning_paper_scores (
  cbt_id uuid not null references private.learning_cbts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subjective numeric,
  critical_thinking numeric,
  project numeric,
  revision integer not null check (revision > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (cbt_id, student_id)
);
alter table private.learning_paper_scores enable row level security;

create or replace function public.assign_learning_cbt(source_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  source public.assessments;
  snapshot jsonb;
  assigned_id uuid;
  objective_questions jsonb;
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

  select jsonb_agg(q.value order by q.ordinality) into objective_questions
  from jsonb_array_elements(snapshot) with ordinality q
  where q.value->>'type' = 'objective';
  if objective_questions is null then
    raise exception 'Add objective questions before assigning a CBT.';
  end if;

  insert into private.learning_cbts as c
    (assessment_id, workspace_id, class_id, title, questions, assigned_by, section_maxima)
  values (source_id, source.workspace_id, source.class_id, source.title,
          objective_questions, auth.uid(), private.learning_section_maxima(snapshot))
  on conflict (assessment_id) do nothing returning c.id into assigned_id;
  return coalesce(assigned_id, (select id from private.learning_cbts where assessment_id = source_id));
end;
$$;

create function private.learning_score_sheet_assignment(source_id uuid, writing boolean)
returns private.learning_cbts language sql stable set search_path = '' as $$
  select c.*
  from private.learning_cbts c
  join public.assessments a on a.id = c.assessment_id and a.workspace_id = c.workspace_id
  join public.workspaces w on w.id = c.workspace_id
  where a.id = source_id and c.class_id is not null and a.status = 'validated'
    and w.workspace_type = 'school' and w.access_status = 'active'
    and private.can_view_teacher_artifact(c.workspace_id, 'assessment', source_id)
    and private.has_workspace_role(c.workspace_id,
      case when writing then array['owner','admin','teacher'] else array['owner','admin','leader','teacher'] end);
$$;

create function public.get_learning_score_sheet(source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
  roster jsonb;
  writable private.learning_cbts;
begin
  if assignment.id is null then raise exception 'Score sheet unavailable. Assign the validated assessment as CBT first.'; end if;
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
    'writable', writable.id is not null, 'roster', roster);
end;
$$;

create function public.save_learning_paper_scores(
  source_id uuid, learner_id uuid, expected_revision integer,
  subjective_score numeric, critical_thinking_score numeric, project_score numeric
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, true);
  limits jsonb;
  saved_revision integer;
begin
  if assignment.id is null then raise exception 'Score sheet unavailable.'; end if;
  perform 1 from public.students s where s.id = learner_id and s.active
    and s.workspace_id = assignment.workspace_id and s.class_id = assignment.class_id for share;
  if not found then raise exception 'Learner unavailable in this class.'; end if;

  limits := coalesce(assignment.section_maxima, private.learning_section_maxima(assignment.questions));
  if exists (
    select 1 from (values ('subjective', subjective_score),
      ('critical_thinking', critical_thinking_score), ('project', project_score)) as entry(kind, score)
    where score is not null and (score < 0 or score > (limits->>kind)::numeric
      or (limits->>kind)::numeric = 0)
  ) then raise exception 'Enter scores within the assessment section maximums.'; end if;

  if expected_revision = 0 then
    insert into private.learning_paper_scores
      (cbt_id, student_id, subjective, critical_thinking, project, revision, updated_by)
    values (assignment.id, learner_id, subjective_score, critical_thinking_score, project_score, 1, auth.uid())
    on conflict (cbt_id, student_id) do nothing returning revision into saved_revision;
  else
    update private.learning_paper_scores
    set subjective = subjective_score, critical_thinking = critical_thinking_score,
      project = project_score, revision = revision + 1, updated_by = auth.uid(), updated_at = now()
    where cbt_id = assignment.id and student_id = learner_id and revision = expected_revision
    returning revision into saved_revision;
  end if;
  if saved_revision is null then raise exception 'Scores changed. Reload the score sheet before saving again.'; end if;
  return saved_revision;
end;
$$;

revoke all on function private.learning_section_maxima(jsonb),
  private.learning_score_sheet_assignment(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_learning_score_sheet(uuid),
  public.save_learning_paper_scores(uuid, uuid, integer, numeric, numeric, numeric) from public, anon;
grant execute on function public.get_learning_score_sheet(uuid),
  public.save_learning_paper_scores(uuid, uuid, integer, numeric, numeric, numeric) to authenticated;
