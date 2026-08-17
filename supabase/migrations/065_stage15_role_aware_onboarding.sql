-- KSI Stage 15 — role-aware onboarding.
-- Role selection is an entry intent only. School authority is still granted by
-- governed platform approval or a school-issued, email-bound access code.

create table if not exists public.school_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  school_name text not null,
  school_location text not null,
  contact_phone text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  workspace_id uuid references public.workspaces(id) on delete set null
);

create unique index if not exists school_access_requests_one_pending_per_user_idx
on public.school_access_requests(requester_user_id)
where status = 'pending';

create index if not exists school_access_requests_status_requested_idx
on public.school_access_requests(status, requested_at desc);

alter table public.school_access_requests enable row level security;
revoke all on table public.school_access_requests from anon, authenticated;

create table if not exists public.staff_access_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  invited_role text not null check (invited_role in ('admin','leader','teacher')),
  code_hash text not null unique,
  expires_at timestamptz not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists staff_access_invites_workspace_created_idx
on public.staff_access_invites(workspace_id, created_at desc);
create index if not exists staff_access_invites_email_idx
on public.staff_access_invites(lower(invited_email), workspace_id);
create index if not exists staff_access_invites_active_expiry_idx
on public.staff_access_invites(expires_at)
where redeemed_at is null and revoked_at is null;

alter table public.staff_access_invites enable row level security;
revoke all on table public.staff_access_invites from anon, authenticated;

create or replace function public.get_my_school_memberships()
returns table(
  workspace_id uuid,
  workspace_name text,
  access_status text,
  member_role text,
  member_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name, w.access_status, wm.role, wm.status
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = auth.uid()
    and w.workspace_type = 'school'
  order by w.name;
$$;

revoke all on function public.get_my_school_memberships() from public, anon;
grant execute on function public.get_my_school_memberships() to authenticated;

create or replace function public.request_school_access(
  target_school_name text,
  target_school_location text,
  target_contact_phone text
)
returns table(
  request_id uuid,
  school_name text,
  status text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_name text;
  v_location text;
  v_phone text;
  v_request public.school_access_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then raise exception 'Your KSI account does not have a usable email address.'; end if;

  v_name := nullif(btrim(target_school_name), '');
  v_location := nullif(btrim(target_school_location), '');
  v_phone := nullif(btrim(target_contact_phone), '');

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception 'Enter a valid school name between 2 and 160 characters.';
  end if;
  if v_location is null or char_length(v_location) < 2 or char_length(v_location) > 240 then
    raise exception 'Enter the school location.';
  end if;
  if v_phone is null or char_length(v_phone) < 7 or char_length(v_phone) > 40 then
    raise exception 'Enter a valid school contact phone number.';
  end if;

  if exists (
    select 1 from public.school_access_requests r
    where r.requester_user_id = auth.uid() and r.status = 'pending'
  ) then
    raise exception 'You already have a school access request awaiting KAEC review.';
  end if;

  insert into public.school_access_requests(
    requester_user_id, requester_email, school_name, school_location, contact_phone
  ) values (
    auth.uid(), lower(v_email), v_name, v_location, v_phone
  ) returning * into v_request;

  return query select v_request.id, v_request.school_name, v_request.status, v_request.requested_at;
end;
$$;

revoke all on function public.request_school_access(text,text,text) from public, anon;
grant execute on function public.request_school_access(text,text,text) to authenticated;

create or replace function public.get_my_school_access_requests()
returns table(
  request_id uuid,
  school_name text,
  school_location text,
  contact_phone text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  workspace_id uuid,
  workspace_access_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.school_name, r.school_location, r.contact_phone, r.status,
         r.requested_at, r.reviewed_at, r.review_note, r.workspace_id,
         w.access_status
  from public.school_access_requests r
  left join public.workspaces w on w.id = r.workspace_id
  where r.requester_user_id = auth.uid()
  order by r.requested_at desc;
$$;

revoke all on function public.get_my_school_access_requests() from public, anon;
grant execute on function public.get_my_school_access_requests() to authenticated;

create or replace function public.get_school_access_requests()
returns table(
  request_id uuid,
  requester_email text,
  school_name text,
  school_location text,
  contact_phone text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  workspace_id uuid
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then
    raise exception 'Only an authorised KSI platform administrator may review school access requests.';
  end if;

  return query
  select r.id, r.requester_email, r.school_name, r.school_location, r.contact_phone,
         r.status, r.requested_at, r.reviewed_at, r.review_note, r.workspace_id
  from public.school_access_requests r
  order by case when r.status = 'pending' then 0 else 1 end, r.requested_at desc;
end;
$$;

revoke all on function public.get_school_access_requests() from public, anon;
grant execute on function public.get_school_access_requests() to authenticated;

create or replace function public.approve_school_access_request(
  target_request_id uuid,
  target_review_note text default null
)
returns table(
  request_id uuid,
  workspace_id uuid,
  workspace_name text,
  access_status text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_request public.school_access_requests;
  v_provision record;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then
    raise exception 'Only an authorised KSI platform administrator may approve school access.';
  end if;

  select * into v_request
  from public.school_access_requests r
  where r.id = target_request_id
  for update;

  if not found then raise exception 'School access request not found.'; end if;
  if v_request.status <> 'pending' then raise exception 'Only a pending school access request can be approved.'; end if;

  select * into v_provision
  from public.provision_school_workspace(v_request.requester_email, v_request.school_name);

  update public.school_access_requests r
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
      review_note = nullif(btrim(target_review_note), ''), workspace_id = v_provision.workspace_id
  where r.id = v_request.id;

  return query select v_request.id, v_provision.workspace_id, v_provision.workspace_name, v_provision.access_status;
end;
$$;

revoke all on function public.approve_school_access_request(uuid,text) from public, anon;
grant execute on function public.approve_school_access_request(uuid,text) to authenticated;

create or replace function public.reject_school_access_request(
  target_request_id uuid,
  target_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then
    raise exception 'Only an authorised KSI platform administrator may reject school access.';
  end if;

  update public.school_access_requests r
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      review_note = nullif(btrim(target_review_note), '')
  where r.id = target_request_id and r.status = 'pending';

  if not found then raise exception 'Pending school access request not found.'; end if;
end;
$$;

revoke all on function public.reject_school_access_request(uuid,text) from public, anon;
grant execute on function public.reject_school_access_request(uuid,text) to authenticated;

create or replace function public.issue_staff_access_code(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'teacher',
  ttl_hours integer default 168
)
returns table(
  access_code text,
  workspace_id uuid,
  workspace_name text,
  invited_email text,
  invited_role text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_workspace public.workspaces;
  v_email text;
  v_code text;
  v_expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id, array['owner','admin']) then
    raise exception 'Only an active school owner or admin may issue staff access.';
  end if;
  if target_role not in ('admin','leader','teacher') then
    raise exception 'Staff access role must be Admin, Leader or Teacher.';
  end if;
  if ttl_hours < 1 or ttl_hours > 720 then
    raise exception 'Access code lifetime must be between 1 and 720 hours.';
  end if;

  v_email := lower(nullif(btrim(target_email), ''));
  if v_email is null or position('@' in v_email) < 2 then raise exception 'Enter a valid staff email address.'; end if;

  select * into v_workspace from public.workspaces w
  where w.id = target_workspace_id and w.workspace_type = 'school' and w.access_status = 'active';
  if not found then raise exception 'This school does not currently have active KSI access.'; end if;

  update public.staff_access_invites i set revoked_at = now()
  where i.workspace_id = target_workspace_id
    and lower(i.invited_email) = v_email
    and i.redeemed_at is null and i.revoked_at is null;

  v_code := 'KSI-STAFF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_expiry := now() + make_interval(hours => ttl_hours);

  insert into public.staff_access_invites(
    workspace_id, invited_email, invited_role, code_hash, expires_at, issued_by
  ) values (
    target_workspace_id, v_email, target_role,
    encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
    v_expiry, auth.uid()
  );

  return query select v_workspace.id, v_workspace.id, v_workspace.name, v_email, target_role, v_expiry;
end;
$$;

-- Correct the first returned field to be the one-time raw code.
create or replace function public.issue_staff_access_code(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'teacher',
  ttl_hours integer default 168
)
returns table(
  access_code text,
  workspace_id uuid,
  workspace_name text,
  invited_email text,
  invited_role text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_workspace public.workspaces;
  v_email text;
  v_code text;
  v_expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id, array['owner','admin']) then
    raise exception 'Only an active school owner or admin may issue staff access.';
  end if;
  if target_role not in ('admin','leader','teacher') then
    raise exception 'Staff access role must be Admin, Leader or Teacher.';
  end if;
  if ttl_hours < 1 or ttl_hours > 720 then
    raise exception 'Access code lifetime must be between 1 and 720 hours.';
  end if;

  v_email := lower(nullif(btrim(target_email), ''));
  if v_email is null or position('@' in v_email) < 2 then raise exception 'Enter a valid staff email address.'; end if;

  select * into v_workspace from public.workspaces w
  where w.id = target_workspace_id and w.workspace_type = 'school' and w.access_status = 'active';
  if not found then raise exception 'This school does not currently have active KSI access.'; end if;

  update public.staff_access_invites i set revoked_at = now()
  where i.workspace_id = target_workspace_id
    and lower(i.invited_email) = v_email
    and i.redeemed_at is null and i.revoked_at is null;

  v_code := 'KSI-STAFF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_expiry := now() + make_interval(hours => ttl_hours);

  insert into public.staff_access_invites(
    workspace_id, invited_email, invited_role, code_hash, expires_at, issued_by
  ) values (
    target_workspace_id, v_email, target_role,
    encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
    v_expiry, auth.uid()
  );

  return query select v_code, v_workspace.id, v_workspace.name, v_email, target_role, v_expiry;
end;
$$;

revoke all on function public.issue_staff_access_code(uuid,text,text,integer) from public, anon;
grant execute on function public.issue_staff_access_code(uuid,text,text,integer) to authenticated;

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

create or replace function public.get_staff_access_invites(target_workspace_id uuid)
returns table(
  invite_id uuid,
  invited_email text,
  invited_role text,
  created_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_workspace_role(target_workspace_id, array['owner','admin']) then
    raise exception 'Only an active school owner or admin may view staff access.';
  end if;

  return query
  select i.id, i.invited_email, i.invited_role, i.created_at, i.expires_at, i.redeemed_at, i.revoked_at
  from public.staff_access_invites i
  where i.workspace_id = target_workspace_id
  order by i.created_at desc
  limit 100;
end;
$$;

revoke all on function public.get_staff_access_invites(uuid) from public, anon;
grant execute on function public.get_staff_access_invites(uuid) to authenticated;

create or replace function public.revoke_staff_access_invite(target_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_workspace_id uuid;
begin
  select i.workspace_id into v_workspace_id from public.staff_access_invites i where i.id = target_invite_id;
  if not found then raise exception 'Staff access invite not found.'; end if;
  if not private.has_workspace_role(v_workspace_id, array['owner','admin']) then
    raise exception 'Only an active school owner or admin may revoke staff access.';
  end if;

  update public.staff_access_invites i
  set revoked_at = now()
  where i.id = target_invite_id and i.redeemed_at is null and i.revoked_at is null;

  if not found then raise exception 'This Staff Access Code is already used or revoked.'; end if;
end;
$$;

revoke all on function public.revoke_staff_access_invite(uuid) from public, anon;
grant execute on function public.revoke_staff_access_invite(uuid) to authenticated;
