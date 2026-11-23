create function public.get_school_staff_directory(school_id uuid)
returns table (user_id uuid, display_name text, role text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_learning_families(school_id) then
    raise exception 'School administrator access is required.';
  end if;

  return query
  select m.user_id, coalesce(nullif(btrim(p.display_name), ''), 'Unnamed staff member'),
    m.role, m.status
  from public.workspace_members m
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = school_id and m.role in ('owner', 'admin', 'leader', 'teacher')
  order by 2, 1;
end;
$$;

revoke all on function public.get_school_staff_directory(uuid) from public, anon;
grant execute on function public.get_school_staff_directory(uuid) to authenticated;

create function public.set_school_staff_status(
  school_id uuid, staff_id uuid, expected_status text, new_status text
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if staff_id = auth.uid() or not (
    (expected_status = 'active' and new_status = 'suspended')
    or (expected_status = 'suspended' and new_status = 'active')
  ) then
    raise exception 'Invalid staff status change.';
  end if;

  update public.workspace_members m set status = new_status
    where m.workspace_id = school_id and m.user_id = staff_id
      and m.status = expected_status
      and m.role in ('admin', 'leader', 'teacher')
      and exists (select 1 from public.workspaces w
        where w.id = school_id and w.workspace_type = 'school' and w.access_status = 'active')
      and exists (select 1 from public.workspace_members caller
        where caller.workspace_id = school_id and caller.user_id = auth.uid()
          and caller.status = 'active'
          and (caller.role = 'owner' or (caller.role = 'admin' and m.role <> 'admin')));
  if not found then raise exception 'Staff access could not be changed. Refresh and check your permissions.'; end if;
end;
$$;

revoke all on function public.set_school_staff_status(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_school_staff_status(uuid, uuid, text, text) to authenticated;
