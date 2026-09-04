-- KSI staff onboarding integrity recovery.
-- A Staff Access Code must not be consumed unless the authenticated account has
-- both an active governed membership and a profile defaulting to that school.

-- Recover legacy auth identities that pre-date the school-only profile bootstrap.
-- This restores only the profile invariant; it does not create personal workspaces
-- or grant any school membership.
insert into public.profiles as p(id, display_name, email)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1),
    'KSI User'
  ),
  u.email
from auth.users u
where not exists (
  select 1 from public.profiles existing where existing.id = u.id
)
on conflict (id) do nothing;

-- Recover an active school default for any profile whose membership already
-- grants operational KSI access. Existing valid defaults remain untouched.
update public.profiles p
set default_workspace_id = (
  select wm.workspace_id
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = p.id
    and wm.status = 'active'
    and wm.role in ('owner', 'admin', 'leader', 'teacher')
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
where p.default_workspace_id is null
  and exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.user_id = p.id
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'leader', 'teacher')
      and w.workspace_type = 'school'
      and w.access_status = 'active'
  );

create or replace function public.redeem_staff_access_code(raw_code text)
returns table(
  workspace_id uuid,
  workspace_name text,
  member_role text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.staff_access_invites;
  v_workspace public.workspaces;
  v_user auth.users;
  v_email text;
  v_existing public.workspace_members;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if raw_code is null or length(trim(raw_code)) < 12 then raise exception 'Enter a valid KSI Staff Access Code.'; end if;

  select u.* into v_user from auth.users u where u.id = auth.uid();
  v_email := lower(v_user.email);
  if v_email is null then raise exception 'Your KSI account does not have a usable email address.'; end if;

  select i.* into v_invite
  from public.staff_access_invites i
  where i.code_hash = encode(extensions.digest(upper(trim(raw_code)), 'sha256'), 'hex')
  for update;

  if not found then raise exception 'That Staff Access Code is invalid.'; end if;
  if v_invite.revoked_at is not null then raise exception 'That Staff Access Code has been revoked.'; end if;
  if v_invite.redeemed_at is not null then raise exception 'That Staff Access Code has already been used.'; end if;
  if v_invite.expires_at <= now() then raise exception 'That Staff Access Code has expired. Ask your school for a new one.'; end if;
  if lower(v_invite.invited_email) <> v_email then
    raise exception 'This Staff Access Code was issued to a different email address. Sign in with the invited school email.';
  end if;

  select * into v_workspace from public.workspaces w where w.id = v_invite.workspace_id;
  if not found or v_workspace.workspace_type <> 'school' then raise exception 'School workspace not found.'; end if;
  if v_workspace.access_status <> 'active' then raise exception 'This school does not currently have active KSI access.'; end if;

  select wm.* into v_existing from public.workspace_members wm
  where wm.workspace_id = v_invite.workspace_id and wm.user_id = auth.uid();

  if found and v_existing.role <> v_invite.invited_role then
    raise exception 'This account already has the % role in this school. Ask the school owner/admin to manage the role directly.', v_existing.role;
  end if;
  if found and v_existing.status = 'suspended' then
    raise exception 'This school membership is suspended. A school owner/admin must restore it directly; an old access code cannot reactivate it.';
  end if;

  if found then
    update public.workspace_members wm
    set status = 'active', updated_at = now()
    where wm.workspace_id = v_invite.workspace_id and wm.user_id = auth.uid();
  else
    insert into public.workspace_members(workspace_id, user_id, role, status)
    values (v_invite.workspace_id, auth.uid(), v_invite.invited_role, 'active');
  end if;

  -- Upsert instead of UPDATE-only: older authenticated identities may not have
  -- a profile row. The code remains unconsumed if this invariant cannot be made.
  insert into public.profiles as p(id, display_name, email, default_workspace_id)
  values (
    auth.uid(),
    coalesce(
      nullif(v_user.raw_user_meta_data ->> 'full_name', ''),
      split_part(v_user.email, '@', 1),
      'KSI User'
    ),
    v_user.email,
    v_invite.workspace_id
  )
  on conflict (id) do update
  set display_name = coalesce(nullif(p.display_name, ''), excluded.display_name),
      email = coalesce(p.email, excluded.email),
      default_workspace_id = excluded.default_workspace_id,
      updated_at = now();

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.default_workspace_id = v_invite.workspace_id
  ) then
    raise exception 'KSI could not establish the staff account profile. The access code was not consumed.';
  end if;

  update public.staff_access_invites i
  set redeemed_at = now(), redeemed_by = auth.uid()
  where i.id = v_invite.id;

  return query select v_workspace.id, v_workspace.name, v_invite.invited_role;
end;
$$;

revoke all on function public.redeem_staff_access_code(text) from public, anon;
grant execute on function public.redeem_staff_access_code(text) to authenticated;

comment on function public.redeem_staff_access_code(text) is
  'Atomically redeems an email-bound Staff Access Code only after active membership and the school-default profile invariant are established.';

do $assert$
begin
  if exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    left join public.profiles p on p.id = wm.user_id
    where wm.status = 'active'
      and wm.role in ('owner', 'admin', 'leader', 'teacher')
      and w.workspace_type = 'school'
      and w.access_status = 'active'
      and (p.id is null or p.default_workspace_id is null)
  ) then
    raise exception 'An active operational school member still lacks a usable KSI profile default.';
  end if;
end;
$assert$;
