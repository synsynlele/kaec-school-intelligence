-- KAEC School Intelligence — Stage 2 HQLS system fidelity recording
-- System-origin fidelity records must not be forgeable by normal browser table inserts.
-- A public SECURITY INVOKER wrapper calls a private SECURITY DEFINER function that
-- derives the actor from auth.uid(), verifies workspace access, and writes the
-- system check without weakening the existing RLS policy for direct inserts.

create or replace function private.record_hqls_system_fidelity_check_internal(
  target_lesson_id uuid,
  target_passed boolean,
  target_score numeric,
  target_violations jsonb,
  target_evidence jsonb,
  target_engine_version text
)
returns public.hqls_fidelity_checks
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_lesson public.lessons;
  inserted_row public.hqls_fidelity_checks;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_lesson
  from public.lessons
  where id = target_lesson_id;

  if target_lesson.id is null then
    raise exception 'Lesson not found';
  end if;

  if not private.is_workspace_member(target_lesson.workspace_id) then
    raise exception 'Lesson not found';
  end if;

  if target_score is not null and (target_score < 0 or target_score > 100) then
    raise exception 'Fidelity score must be between 0 and 100';
  end if;

  insert into public.hqls_fidelity_checks (
    workspace_id,
    lesson_id,
    checked_by,
    check_origin,
    passed,
    score,
    violations,
    evidence,
    engine_version
  ) values (
    target_lesson.workspace_id,
    target_lesson.id,
    auth.uid(),
    'system',
    target_passed,
    target_score,
    coalesce(target_violations, '[]'::jsonb),
    coalesce(target_evidence, '[]'::jsonb),
    nullif(trim(target_engine_version), '')
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;

revoke all on function private.record_hqls_system_fidelity_check_internal(uuid, boolean, numeric, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function private.record_hqls_system_fidelity_check_internal(uuid, boolean, numeric, jsonb, jsonb, text)
  to authenticated;

create or replace function public.record_hqls_system_fidelity_check(
  target_lesson_id uuid,
  target_passed boolean,
  target_score numeric,
  target_violations jsonb,
  target_evidence jsonb,
  target_engine_version text
)
returns public.hqls_fidelity_checks
language sql
security invoker
set search_path = public, private
as $$
  select private.record_hqls_system_fidelity_check_internal(
    target_lesson_id,
    target_passed,
    target_score,
    target_violations,
    target_evidence,
    target_engine_version
  );
$$;

revoke all on function public.record_hqls_system_fidelity_check(uuid, boolean, numeric, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.record_hqls_system_fidelity_check(uuid, boolean, numeric, jsonb, jsonb, text)
  to authenticated;
