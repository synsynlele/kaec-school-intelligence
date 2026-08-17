-- KSI Stage 15 — staff invite redemption hardening.
-- An access code may activate a newly invited staff account, but it must never
-- silently reactivate a membership that a school owner/admin has suspended.

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
  v_email text;
  v_existing public.workspace_members;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if raw_code is null or length(trim(raw_code)) < 12 then raise exception 'Enter a valid KSI Staff Access Code.'; end if;

  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
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

  update public.profiles p
  set default_workspace_id = v_invite.workspace_id, updated_at = now()
  where p.id = auth.uid();

  update public.staff_access_invites i
  set redeemed_at = now(), redeemed_by = auth.uid()
  where i.id = v_invite.id;

  return query select v_workspace.id, v_workspace.name, v_invite.invited_role;
end;
$$;

revoke all on function public.redeem_staff_access_code(text) from public, anon;
grant execute on function public.redeem_staff_access_code(text) to authenticated;
