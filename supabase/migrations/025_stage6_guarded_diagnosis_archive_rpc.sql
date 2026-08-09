-- KAEC School Intelligence — Stage 6 governed diagnosis archive RPC
-- Preserve the Stage 4 decision that authenticated clients do not receive direct
-- UPDATE privilege on diagnoses. Archival is exposed only through this narrow,
-- audited function with explicit actor, role and dependency checks.

create or replace function public.archive_diagnosis(target_diagnosis_id uuid)
returns public.diagnoses
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id uuid;
  target public.diagnoses%rowtype;
begin
  actor_id := (select auth.uid());
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  select d.*
  into target
  from public.diagnoses d
  where d.id = target_diagnosis_id;

  if target.id is null then
    raise exception 'Diagnosis not found in the active workspace';
  end if;

  if not private.is_workspace_member(target.workspace_id) then
    raise exception 'Diagnosis not found in the active workspace';
  end if;

  if not private.has_workspace_role(target.workspace_id, array['owner','admin']) then
    raise exception 'Only a workspace Owner or Admin can archive diagnoses';
  end if;

  if target.status = 'archived' then
    return target;
  end if;

  if exists (
    select 1
    from public.intervention_handoffs h
    where h.diagnosis_id = target.id
      and h.status <> 'archived'
  ) then
    raise exception 'Archive the linked intervention first. KSI will not hide a diagnosis while its intervention remains active';
  end if;

  update public.diagnoses
  set status = 'archived'
  where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.archive_diagnosis(uuid) from public, anon;
grant execute on function public.archive_diagnosis(uuid) to authenticated;
