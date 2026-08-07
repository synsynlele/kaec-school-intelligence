-- KAEC School Intelligence — atomic artifact version append
-- One database primitive allocates version numbers for Lesson, Assessment and
-- Diagnosis artifacts. This prevents each future engine from inventing its own
-- audit/version numbering behaviour.

create or replace function public.append_artifact_version(
  target_workspace_id uuid,
  target_artifact_type text,
  target_artifact_id uuid,
  target_snapshot jsonb,
  target_origin text,
  target_engine_version text default null,
  target_prompt_version text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_version integer;
  created_version_id uuid;
begin
  if target_artifact_type not in ('lesson', 'assessment', 'diagnosis') then
    raise exception 'Unsupported artifact type';
  end if;

  if target_origin not in (
    'generated',
    'manual_edit',
    'regeneration',
    'review',
    'finalisation'
  ) then
    raise exception 'Unsupported artifact version origin';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize version allocation for this one artifact without locking unrelated
  -- artifacts or workspaces.
  perform pg_advisory_xact_lock(
    hashtextextended(target_artifact_type || ':' || target_artifact_id::text, 0)
  );

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.artifact_versions
  where artifact_type = target_artifact_type
    and artifact_id = target_artifact_id;

  insert into public.artifact_versions (
    workspace_id,
    artifact_type,
    artifact_id,
    version_number,
    snapshot,
    origin,
    engine_version,
    prompt_version,
    created_by
  )
  values (
    target_workspace_id,
    target_artifact_type,
    target_artifact_id,
    next_version,
    target_snapshot,
    target_origin,
    target_engine_version,
    target_prompt_version,
    auth.uid()
  )
  returning id into created_version_id;

  return created_version_id;
end;
$$;

revoke all on function public.append_artifact_version(
  uuid, text, uuid, jsonb, text, text, text
) from public, anon;

grant execute on function public.append_artifact_version(
  uuid, text, uuid, jsonb, text, text, text
) to authenticated;
