create table private.learning_result_reviews (
  cbt_id uuid not null references private.learning_cbts(id) on delete restrict,
  revision integer not null check (revision > 0),
  action text not null check (action in ('submitted','returned','published')),
  actor uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  note text,
  snapshot jsonb not null,
  primary key (cbt_id, revision)
);
alter table private.learning_result_reviews enable row level security;

create function private.guard_learning_score_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  latest text;
begin
  perform 1 from private.learning_cbts where id = new.cbt_id for update;
  select action into latest from private.learning_result_reviews
    where cbt_id = new.cbt_id order by revision desc limit 1;
  if latest in ('submitted', 'published') then
    raise exception 'Scores are locked while in review or after publication.';
  end if;
  return new;
end;
$$;

create trigger learning_scores_review_lock before insert or update on private.learning_paper_scores
for each row execute function private.guard_learning_score_review();

create function public.get_learning_result_review(source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  sheet jsonb := public.get_learning_score_sheet(source_id);
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
  latest private.learning_result_reviews;
begin
  select * into latest from private.learning_result_reviews where cbt_id = assignment.id
    order by revision desc limit 1;

  if latest.action in ('submitted','published') then
    sheet := latest.snapshot || jsonb_build_object('writable', false);
  end if;
  return sheet || jsonb_build_object(
    'status', coalesce(latest.action, 'draft'),
    'revision', coalesce(latest.revision, 0),
    'note', latest.note,
    'recorded_at', latest.recorded_at,
    'can_review', private.has_workspace_role(assignment.workspace_id, array['owner','admin','leader'])
  );
end;
$$;

create function public.change_learning_result_review(
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

create function public.get_my_published_learning_results()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner public.students := private.learning_cbt_student();
  results jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', r.snapshot->>'title', 'published_at', r.recorded_at,
    'maxima', r.snapshot->'maxima',
    'scores', scores.value - 'id' - 'name' - 'revision' - 'editable'
  ) order by r.recorded_at desc, c.id), '[]'::jsonb) into results
  from private.learning_result_reviews r
  join private.learning_cbts c on c.id = r.cbt_id
  cross join lateral jsonb_array_elements(r.snapshot->'roster') scores
  where c.workspace_id = learner.workspace_id and r.action = 'published'
    and scores.value->>'id' = learner.id::text;
  return results;
end;
$$;

revoke all on function private.guard_learning_score_review() from public, anon, authenticated;
revoke all on function public.get_learning_result_review(uuid),
  public.change_learning_result_review(uuid, integer, text, text),
  public.get_my_published_learning_results() from public, anon;
grant execute on function public.get_learning_result_review(uuid),
  public.change_learning_result_review(uuid, integer, text, text),
  public.get_my_published_learning_results() to authenticated;
