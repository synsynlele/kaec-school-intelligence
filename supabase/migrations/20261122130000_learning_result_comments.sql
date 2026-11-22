create function public.publish_learning_result_with_comments(
  source_id uuid, expected_revision integer, comments jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  assignment private.learning_cbts := private.learning_score_sheet_assignment(source_id, false);
  published private.learning_result_reviews;
begin
  if jsonb_typeof(comments) is distinct from 'object' or octet_length(comments::text) > 524288 then
    raise exception 'Invalid or oversized comments.';
  end if;

  perform public.change_learning_result_review(source_id, expected_revision, 'published');
  select * into strict published from private.learning_result_reviews
    where cbt_id = assignment.id and revision = expected_revision + 1;

  if exists (
    select 1 from jsonb_each(comments) entry
    where jsonb_typeof(entry.value) <> 'string'
      or length(entry.value #>> '{}') > 500
      or not exists (
        select 1 from jsonb_array_elements(published.snapshot->'roster') learner
        where learner->>'id' = entry.key
      )
  ) then raise exception 'Use comments of up to 500 characters for learners on this sheet.'; end if;

  update private.learning_result_reviews
    set snapshot = snapshot || jsonb_build_object('administrative_comments', comments)
    where cbt_id = published.cbt_id and revision = published.revision;
end;
$$;

revoke all on function public.publish_learning_result_with_comments(uuid, integer, jsonb) from public, anon;
grant execute on function public.publish_learning_result_with_comments(uuid, integer, jsonb) to authenticated;

create or replace function public.get_my_published_learning_results()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner public.students := private.learning_cbt_student();
  results jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', r.snapshot->>'title', 'published_at', r.recorded_at,
    'maxima', r.snapshot->'maxima',
    'administrative_comment', r.snapshot->'administrative_comments'->>(learner.id::text),
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

