alter table private.learning_paper_scores add column excused text[] not null default '{}';

create or replace function public.save_learning_marks(
  source_id uuid, learner_id uuid, expected_revision integer,
  subjective_score numeric, critical_thinking_score numeric, project_score numeric, excused_sections text[]
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

  if excused_sections is null or array_position(excused_sections, null) is not null
    or cardinality(excused_sections) > 4 or exists (
      select 1 from unnest(excused_sections) kind
      where coalesce((limits->>kind)::numeric, 0) <= 0
    ) then raise exception 'Choose only applicable sections to excuse.'; end if;

  if expected_revision = 0 then
    insert into private.learning_paper_scores
      (cbt_id, student_id, subjective, critical_thinking, project, excused, revision, updated_by)
    values (assignment.id, learner_id, subjective_score, critical_thinking_score, project_score, excused_sections, 1, auth.uid())
    on conflict (cbt_id, student_id) do nothing returning revision into saved_revision;
  else
    update private.learning_paper_scores
    set subjective = subjective_score, critical_thinking = critical_thinking_score,
      project = project_score, excused = excused_sections, revision = revision + 1, updated_by = auth.uid(), updated_at = now()
    where cbt_id = assignment.id and student_id = learner_id and revision = expected_revision
    returning revision into saved_revision;
  end if;
  if saved_revision is null then raise exception 'Scores changed. Reload the score sheet before saving again.'; end if;
  return saved_revision;
end;
$$;

revoke all on function public.save_learning_marks(uuid, uuid, integer, numeric, numeric, numeric, text[]) from public, anon;
grant execute on function public.save_learning_marks(uuid, uuid, integer, numeric, numeric, numeric, text[]) to authenticated;

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
    'project', p.project, 'excused', coalesce(to_jsonb(p.excused), '[]'::jsonb), 'revision', coalesce(p.revision, 0),
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

create or replace function public.change_learning_result_review(
  source_id uuid, expected_revision integer, next_action text, correction_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, next_action = 'submitted');
  latest private.learning_result_reviews;
  snapshot jsonb;
begin
  if assignment.id is null then raise exception 'Score sheet unavailable.'; end if;
  if next_action is null or next_action not in ('submitted','returned','published') then
    raise exception 'Unknown review action.';
  end if;
  if next_action <> 'submitted' and not coalesce(
    private.has_workspace_role(assignment.workspace_id, array['owner','admin','leader']), false
  ) then raise exception 'School leadership approval is required.'; end if;

  perform 1 from private.learning_cbts where id = assignment.id for update;
  select * into latest from private.learning_result_reviews where cbt_id = assignment.id
    order by revision desc limit 1;
  if expected_revision is distinct from coalesce(latest.revision, 0) then
    raise exception 'The review changed. Reload the score sheet and try again.';
  end if;

  if next_action = 'submitted' then
    if latest.action is not null and latest.action <> 'returned' then
      raise exception 'Only draft or returned scores can be submitted.';
    end if;
    snapshot := public.get_learning_score_sheet(source_id) - 'writable';
    if jsonb_array_length(snapshot->'roster') = 0 or exists (
      select 1
      from jsonb_array_elements(snapshot->'roster') learner
      cross join jsonb_each_text(snapshot->'maxima') section(key, maximum)
      where section.maximum::numeric > 0 and learner->>section.key is null
        and not coalesce((learner->'excused') ? section.key, false)
    ) then raise exception 'Save all required marks and wait for outstanding CBT submissions before submitting.'; end if;
  else
    if latest.action is distinct from 'submitted' then raise exception 'Only submitted scores can be reviewed.'; end if;
    snapshot := latest.snapshot;
    if next_action = 'returned' and (nullif(btrim(correction_note), '') is null or length(correction_note) > 1000) then
      raise exception 'Enter a correction note of 1 to 1000 characters.';
    end if;
  end if;

  insert into private.learning_result_reviews(cbt_id, revision, action, actor, note, snapshot)
  values (assignment.id, coalesce(latest.revision, 0) + 1, next_action, auth.uid(),
    case when next_action = 'returned' then btrim(correction_note) end, snapshot);
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
          then (coalesce((b.section_maxima->>'subjective')::numeric,0) = 0 or p.subjective is not null or 'subjective' = any(p.excused))
            and (coalesce((b.section_maxima->>'critical_thinking')::numeric,0) = 0 or p.critical_thinking is not null or 'critical_thinking' = any(p.excused))
            and (coalesce((b.section_maxima->>'project')::numeric,0) = 0 or p.project is not null or 'project' = any(p.excused))
          else sub.student_id is not null or 'objective' = any(p.excused)
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
