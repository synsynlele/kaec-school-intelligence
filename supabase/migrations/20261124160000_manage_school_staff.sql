alter table public.workspace_members add column staff_removed_at timestamptz,
  add constraint removed_staff_suspended check (staff_removed_at is null or status = 'suspended');

create or replace function public.get_school_staff_directory(school_id uuid)
returns table (user_id uuid, display_name text, role text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_learning_families(school_id) then
    raise exception 'School administrator access is required.';
  end if;

  return query
  select m.user_id, coalesce(nullif(btrim(p.display_name), ''), 'Unnamed staff member'),
    m.role, case when m.staff_removed_at is not null then 'removed' else m.status end
  from public.workspace_members m
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = school_id and m.role in ('owner', 'admin', 'leader', 'teacher')
  order by 2, 1;
end;
$$;



create function public.manage_school_staff(
  school_id uuid, staff_id uuid, expected_role text, expected_status text, action text, new_role text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_role text;
begin
  if staff_id = auth.uid() or expected_role not in ('admin','leader','teacher')
    or not coalesce(
      (action = 'role' and expected_status in ('active','suspended') and new_role in ('admin','leader','teacher'))
      or (action = 'remove' and expected_status in ('active','suspended') and new_role is null)
      or (action = 'return' and expected_status = 'removed' and new_role is null), false)
  then raise exception 'Invalid staff change.'; end if;

  select m.role into caller_role from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = school_id and m.user_id = auth.uid() and m.status = 'active'
      and w.workspace_type = 'school' and w.access_status = 'active'
    for share of m;
  if not coalesce(caller_role = 'owner' or (
    caller_role = 'admin' and expected_role <> 'admin' and new_role is distinct from 'admin'
  ), false) then raise exception 'You do not have permission to make this staff change.'; end if;

  update public.workspace_members m
    set role = case when action = 'role' then new_role else m.role end,
      status = case when action = 'remove' then 'suspended' else m.status end,
      staff_removed_at = case when action = 'remove' then now() when action = 'return' then null else m.staff_removed_at end
    where m.workspace_id = school_id and m.user_id = staff_id and m.role = expected_role
      and (case when m.staff_removed_at is not null then 'removed' else m.status end) = expected_status;
  if not found then raise exception 'Staff details changed. Refresh and try again.'; end if;
end;
$$;

revoke all on function public.manage_school_staff(uuid,uuid,text,text,text,text) from public, anon;
grant execute on function public.manage_school_staff(uuid,uuid,text,text,text,text) to authenticated;

alter policy workspace_members_update_admin on public.workspace_members
using (
  staff_removed_at is null and (
    private.has_workspace_role(workspace_id, array['owner'])
    or (role not in ('owner','admin') and private.has_workspace_role(workspace_id, array['admin']))
  )
)
with check (
  staff_removed_at is null and (
    private.has_workspace_role(workspace_id, array['owner'])
    or (role not in ('owner','admin') and private.has_workspace_role(workspace_id, array['admin']))
  )
);
