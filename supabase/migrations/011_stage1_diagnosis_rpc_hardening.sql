-- KAEC School Intelligence — Stage 1 diagnosis RPC hardening
-- Privileged mutation lives in the non-exposed private schema. Public RPCs are
-- SECURITY INVOKER wrappers, preserving the API contract without exposing a
-- SECURITY DEFINER function through PostgREST.

create or replace function private.review_diagnosis_internal(target_diagnosis_id uuid)
returns public.diagnoses
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_row public.diagnoses;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into target_row from public.diagnoses where id = target_diagnosis_id;
  if target_row.id is null then raise exception 'Diagnosis not found'; end if;
  if not private.is_workspace_member(target_row.workspace_id) then raise exception 'Diagnosis not found'; end if;
  if target_row.status not in ('draft','reviewed') then raise exception 'Only draft or reviewed diagnoses may be reviewed'; end if;

  update public.diagnoses
  set status='reviewed', reviewed_by=auth.uid(), reviewed_at=now()
  where id=target_diagnosis_id
  returning * into target_row;

  return target_row;
end; $$;

create or replace function private.finalise_diagnosis_internal(target_diagnosis_id uuid)
returns public.diagnoses
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_row public.diagnoses;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into target_row from public.diagnoses where id = target_diagnosis_id;
  if target_row.id is null then raise exception 'Diagnosis not found'; end if;
  if not private.has_workspace_role(target_row.workspace_id,array['owner','admin']) then raise exception 'Owner or admin role required to finalise diagnosis'; end if;
  if target_row.status <> 'reviewed' or target_row.reviewed_by is null or target_row.reviewed_at is null then raise exception 'Diagnosis must be human-reviewed before finalisation'; end if;

  update public.diagnoses
  set status='final', finalised_by=auth.uid(), finalised_at=now()
  where id=target_diagnosis_id
  returning * into target_row;

  return target_row;
end; $$;

revoke all on function private.review_diagnosis_internal(uuid) from public, anon, authenticated;
revoke all on function private.finalise_diagnosis_internal(uuid) from public, anon, authenticated;
grant execute on function private.review_diagnosis_internal(uuid) to authenticated;
grant execute on function private.finalise_diagnosis_internal(uuid) to authenticated;

drop function public.review_diagnosis(uuid);
drop function public.finalise_diagnosis(uuid);

create function public.review_diagnosis(target_diagnosis_id uuid)
returns public.diagnoses
language sql
security invoker
set search_path = public, private
as $$
  select private.review_diagnosis_internal(target_diagnosis_id);
$$;

create function public.finalise_diagnosis(target_diagnosis_id uuid)
returns public.diagnoses
language sql
security invoker
set search_path = public, private
as $$
  select private.finalise_diagnosis_internal(target_diagnosis_id);
$$;

revoke all on function public.review_diagnosis(uuid) from public, anon;
revoke all on function public.finalise_diagnosis(uuid) from public, anon;
grant execute on function public.review_diagnosis(uuid) to authenticated;
grant execute on function public.finalise_diagnosis(uuid) to authenticated;
