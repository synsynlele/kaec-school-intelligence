-- KAEC School Intelligence — Stage 1 HQLS lesson structure
-- The seven-stage order is constitutional and must not drift in persistence.

alter table public.lesson_stages
add constraint lesson_stage_number_key_match
check (
  (stage_number = 1 and stage_key = 'awakening')
  or (stage_number = 2 and stage_key = 'exploration')
  or (stage_number = 3 and stage_key = 'micro_illumination')
  or (stage_number = 4 and stage_key = 'trial_first')
  or (stage_number = 5 and stage_key = 'full_illumination')
  or (stage_number = 6 and stage_key = 'trial_second')
  or (stage_number = 7 and stage_key = 'integration')
);

create or replace function public.create_hqls_lesson_draft(
  target_workspace_id uuid,
  target_title text,
  target_topic text,
  target_objective text,
  target_age_range text default null,
  target_duration_minutes integer default null,
  target_class_id uuid default null,
  target_subject_id uuid default null,
  target_source_context jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_lesson_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(target_title), '') is null then
    raise exception 'Lesson title is required';
  end if;

  if nullif(btrim(target_topic), '') is null then
    raise exception 'Lesson topic is required';
  end if;

  if nullif(btrim(target_objective), '') is null then
    raise exception 'Lesson objective is required';
  end if;

  insert into public.lessons (
    workspace_id,
    created_by,
    class_id,
    subject_id,
    title,
    topic,
    age_range,
    duration_minutes,
    objective,
    status,
    source_context
  )
  values (
    target_workspace_id,
    auth.uid(),
    target_class_id,
    target_subject_id,
    btrim(target_title),
    btrim(target_topic),
    nullif(btrim(target_age_range), ''),
    target_duration_minutes,
    btrim(target_objective),
    'draft',
    coalesce(target_source_context, '[]'::jsonb)
  )
  returning id into created_lesson_id;

  insert into public.lesson_stages (lesson_id, stage_number, stage_key, content, validation)
  values
    (created_lesson_id, 1, 'awakening', '{}'::jsonb, '{}'::jsonb),
    (created_lesson_id, 2, 'exploration', '{}'::jsonb, '{}'::jsonb),
    (created_lesson_id, 3, 'micro_illumination', '{}'::jsonb, '{}'::jsonb),
    (created_lesson_id, 4, 'trial_first', '{}'::jsonb, '{}'::jsonb),
    (created_lesson_id, 5, 'full_illumination', '{}'::jsonb, '{}'::jsonb),
    (created_lesson_id, 6, 'trial_second', '{}'::jsonb, '{}'::jsonb),
    (created_lesson_id, 7, 'integration', '{}'::jsonb, '{}'::jsonb);

  return created_lesson_id;
end;
$$;

revoke all on function public.create_hqls_lesson_draft(
  uuid, text, text, text, text, integer, uuid, uuid, jsonb
) from public, anon;

grant execute on function public.create_hqls_lesson_draft(
  uuid, text, text, text, text, integer, uuid, uuid, jsonb
) to authenticated;
