-- Fix PL/pgSQL output-column shadowing in student access code issuance.

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
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

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
    encode(digest(upper(raw_code), 'sha256'), 'hex'),
    expiry,
    auth.uid()
  );

  return query
  select raw_code, student_row.id, student_row.display_name, student_row.workspace_id, expiry;
end;
$$;

revoke all on function public.issue_student_access_code(uuid,integer) from public, anon;
grant execute on function public.issue_student_access_code(uuid,integer) to authenticated;