-- KSI 2.0 acceptance runtime fix.
--
-- redeem_student_access_code() returns a TABLE containing an output column named
-- workspace_id. In PL/pgSQL that output column is also a variable, so the prior
-- `on conflict (workspace_id, user_id)` inference target was ambiguous at runtime.
-- Use the named primary-key constraint instead. No access, identity or curriculum
-- data is changed by this migration.

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

  select w.* into workspace_row
  from public.workspaces w
  where w.id = invite_row.workspace_id;
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
  on conflict on constraint workspace_members_pkey
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
