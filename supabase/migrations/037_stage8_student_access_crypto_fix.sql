-- Supabase installs pgcrypto in the extensions schema. Keep SECURITY DEFINER
-- search_path locked to public and qualify crypto functions explicitly.

create or replace function public.issue_student_access_code(
  target_student_id uuid,
  ttl_hours integer default 168
)
returns table (
  access_code text,
  student_id uuid,
  student_name text,
  workspace_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  student_row public.students;
  raw_code text;
  expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.* into student_row
  from public.students s
  where s.id = target_student_id
  for update;

  if not found then raise exception 'Student not found.'; end if;
  if not private.has_workspace_role(student_row.workspace_id, array['owner','admin']) then
    raise exception 'Only a school owner or admin may issue student access.';
  end if;
  if ttl_hours < 1 or ttl_hours > 720 then
    raise exception 'Access code lifetime must be between 1 and 720 hours.';
  end if;
  if exists (
    select 1 from public.student_accounts sa
    where sa.student_id = student_row.id and sa.active = true
  ) then
    raise exception 'This student already has an active KSI account.';
  end if;

  update public.student_access_invites sai
  set revoked_at = now()
  where sai.student_id = student_row.id
    and sai.redeemed_at is null
    and sai.revoked_at is null;

  raw_code := 'KSI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  expiry := now() + make_interval(hours => ttl_hours);

  insert into public.student_access_invites(
    workspace_id, student_id, code_hash, expires_at, issued_by
  ) values (
    student_row.workspace_id,
    student_row.id,
    encode(extensions.digest(upper(raw_code), 'sha256'), 'hex'),
    expiry,
    auth.uid()
  );

  return query
  select raw_code, student_row.id, student_row.display_name, student_row.workspace_id, expiry;
end;
$$;

revoke all on function public.issue_student_access_code(uuid,integer) from public, anon;
grant execute on function public.issue_student_access_code(uuid,integer) to authenticated;

create or replace function public.redeem_student_access_code(raw_code text)
returns table (
  workspace_id uuid,
  student_id uuid,
  student_name text,
  workspace_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.student_access_invites;
  student_row public.students;
  workspace_row public.workspaces;
  existing_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if raw_code is null or length(trim(raw_code)) < 8 then
    raise exception 'Enter a valid KSI Student Access Code.';
  end if;

  select sai.* into invite_row
  from public.student_access_invites sai
  where sai.code_hash = encode(extensions.digest(upper(trim(raw_code)), 'sha256'), 'hex')
  for update;

  if not found then raise exception 'That Student Access Code is invalid.'; end if;
  if invite_row.revoked_at is not null then raise exception 'That Student Access Code has been revoked.'; end if;
  if invite_row.redeemed_at is not null then raise exception 'That Student Access Code has already been used.'; end if;
  if invite_row.expires_at <= now() then raise exception 'That Student Access Code has expired. Ask your school for a new one.'; end if;

  select w.* into workspace_row from public.workspaces w where w.id = invite_row.workspace_id;
  if not found or workspace_row.workspace_type <> 'school' then raise exception 'School workspace not found.'; end if;
  if workspace_row.access_status <> 'active' then raise exception 'This school does not currently have active KSI access.'; end if;

  select s.* into student_row
  from public.students s
  where s.id = invite_row.student_id
    and s.workspace_id = invite_row.workspace_id
    and s.active = true;
  if not found then raise exception 'This student record is not active.'; end if;

  if exists (
    select 1 from public.student_accounts sa
    where sa.user_id = auth.uid()
      and sa.student_id <> student_row.id
      and sa.active = true
  ) then raise exception 'This account is already linked to another student profile.'; end if;

  if exists (
    select 1 from public.student_accounts sa
    where sa.student_id = student_row.id
      and sa.user_id <> auth.uid()
      and sa.active = true
  ) then raise exception 'This student profile is already linked to another account.'; end if;

  select wm.role into existing_role
  from public.workspace_members wm
  where wm.workspace_id = invite_row.workspace_id
    and wm.user_id = auth.uid();

  if existing_role is not null and existing_role <> 'student' then
    raise exception 'Use a separate learner account; this account already has a staff role in the school.';
  end if;

  insert into public.workspace_members(workspace_id, user_id, role, status)
  values (invite_row.workspace_id, auth.uid(), 'student', 'active')
  on conflict (workspace_id, user_id)
  do update set role = 'student', status = 'active', updated_at = now();

  insert into public.student_accounts(user_id, student_id, workspace_id, active, created_by)
  values (auth.uid(), student_row.id, invite_row.workspace_id, true, invite_row.issued_by)
  on conflict (user_id)
  do update set student_id = excluded.student_id,
                workspace_id = excluded.workspace_id,
                active = true,
                updated_at = now();

  update public.profiles
  set default_workspace_id = invite_row.workspace_id,
      updated_at = now()
  where id = auth.uid();

  update public.student_access_invites sai
  set redeemed_at = now(), redeemed_by = auth.uid()
  where sai.id = invite_row.id;

  return query
  select student_row.workspace_id, student_row.id, student_row.display_name, workspace_row.name;
end;
$$;

revoke all on function public.redeem_student_access_code(text) from public, anon;
grant execute on function public.redeem_student_access_code(text) to authenticated;