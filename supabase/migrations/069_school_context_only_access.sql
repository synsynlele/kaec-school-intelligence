-- KSI 2.2 pre-release access hardening
-- Personal/individual workspaces are legacy data containers only.
-- No legacy workspace or artifact is deleted by this migration.

-- 1) New accounts should no longer receive an automatic personal workspace.
--    School Owners are provisioned by the KAEC platform flow and staff join
--    an existing school with governed access codes.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1),
    'KSI User'
  );

  insert into public.profiles(id, display_name, email)
  values(new.id, resolved_name, new.email)
  on conflict (id) do update
    set display_name = excluded.display_name,
        email = excluded.email,
        updated_at = now();

  return new;
end;
$function$;

-- 2) Operational membership in KSI is school-only. These three helpers sit
--    beneath the product RLS policies, so adding the workspace-type condition
--    closes the personal-workspace Owner/Admin ambiguity at the database edge.
create or replace function private.has_active_workspace_membership(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and w.workspace_type = 'school'
      and w.access_status = 'active'
  );
$function$;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner','admin','leader','teacher')
      and w.workspace_type = 'school'
      and w.access_status = 'active'
  );
$function$;

create or replace function private.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
      and w.workspace_type = 'school'
      and w.access_status = 'active'
  );
$function$;

-- 3) Freeze existing individual workspaces without deleting their historical
--    content. They remain preserved for audit/migration purposes but are no
--    longer an operational KSI context.
update public.workspaces
set access_status = 'disabled',
    updated_at = now()
where workspace_type = 'individual'
  and access_status <> 'disabled';

-- 4) Move profiles off a legacy personal default. Prefer an active school
--    membership where one exists; otherwise leave the account with no active
--    default so the governed Owner/Staff access flow can establish one.
update public.profiles p
set default_workspace_id = (
      select wm.workspace_id
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      where wm.user_id = p.id
        and wm.status = 'active'
        and w.workspace_type = 'school'
        and w.access_status = 'active'
      order by
        case wm.role
          when 'owner' then 1
          when 'admin' then 2
          when 'leader' then 3
          when 'teacher' then 4
          else 5
        end,
        wm.created_at asc
      limit 1
    ),
    updated_at = now()
where p.default_workspace_id in (
  select w.id from public.workspaces w where w.workspace_type = 'individual'
);

-- 5) Assertions: migration must never destroy legacy containers or grant a
--    non-school context operational access.
do $assert$
begin
  if exists (
    select 1
    from public.workspaces w
    where w.workspace_type = 'individual'
      and w.access_status <> 'disabled'
  ) then
    raise exception 'Individual workspace freeze failed.';
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.workspaces w on w.id = p.default_workspace_id
    where w.workspace_type = 'individual'
  ) then
    raise exception 'A profile still defaults to an individual workspace.';
  end if;
end;
$assert$;
