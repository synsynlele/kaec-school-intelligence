-- KSI Stage 14 — school provisioning access lock.
-- Ordinary authenticated users may keep an individual workspace, but they may not
-- self-create an active school workspace. A KSI platform access administrator
-- provisions the school in PAUSED state, then explicitly activates it through the
-- existing Active / Paused / Blocked / Disabled control plane.

-- Close the self-service school creation hole.
drop policy if exists workspaces_insert_school_self on public.workspaces;
drop policy if exists workspaces_insert_platform_admin_only on public.workspaces;

-- Platform admins may still perform a direct self-owned school insert if needed,
-- but normal users have no INSERT policy on school workspaces. The provisioning
-- RPC below is the normal route for assigning a school to another authenticated owner.
create policy workspaces_insert_platform_admin_only
on public.workspaces
for insert
to authenticated
with check (
  workspace_type = 'school'
  and created_by = auth.uid()
  and private.is_platform_access_admin()
);

create or replace function public.provision_school_workspace(
  target_owner_email text,
  target_school_name text
)
returns table(
  workspace_id uuid,
  workspace_name text,
  owner_user_id uuid,
  owner_email text,
  access_status text
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_owner_id uuid;
  v_owner_email text;
  v_workspace_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not private.is_platform_access_admin() then
    raise exception 'Only an authorised KSI platform administrator may provision a school.';
  end if;

  v_name := nullif(btrim(target_school_name), '');
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception 'Enter a valid school name between 2 and 160 characters.';
  end if;
  if target_owner_email is null or position('@' in target_owner_email) < 2 then
    raise exception 'Enter the school owner''s existing KSI sign-in email.';
  end if;

  select u.id, u.email
    into v_owner_id, v_owner_email
  from auth.users u
  where lower(u.email) = lower(btrim(target_owner_email))
  limit 1;

  if v_owner_id is null then
    raise exception 'No KSI account exists for that owner email. Ask the owner to sign in once, then provision the school.';
  end if;

  if exists (
    select 1
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id
    where w.workspace_type = 'school'
      and wm.user_id = v_owner_id
      and wm.role = 'owner'
      and lower(w.name) = lower(v_name)
  ) then
    raise exception 'That owner already has a school workspace with this name.';
  end if;

  insert into public.workspaces(
    name,
    workspace_type,
    created_by,
    access_status,
    access_status_changed_at,
    access_status_changed_by,
    access_status_note
  ) values (
    v_name,
    'school',
    v_owner_id,
    'paused',
    now(),
    auth.uid(),
    'Provisioned by KAEC. Awaiting explicit platform activation.'
  )
  returning id into v_workspace_id;

  -- handle_school_workspace_created() creates the owner membership atomically.
  -- Keep the owner on their current workspace until they deliberately switch.

  return query
  select v_workspace_id, v_name, v_owner_id, v_owner_email, 'paused'::text;
end;
$$;

revoke all on function public.provision_school_workspace(text, text) from public, anon;
grant execute on function public.provision_school_workspace(text, text) to authenticated;

comment on function public.provision_school_workspace(text, text) is
'Platform-admin-only school provisioning. Creates a school in paused state for an existing KSI account; activation remains a separate explicit platform action.';
