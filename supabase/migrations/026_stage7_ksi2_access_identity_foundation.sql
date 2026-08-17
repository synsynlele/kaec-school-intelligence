-- KSI 2.0 Stage 7 — School Access Control, roles and student identity foundation
-- Applied to dedicated KSI Supabase project as stage7_ksi2_access_identity_foundation.

alter table public.workspaces
  add column access_status text not null default 'active'
    check (access_status in ('active','paused','blocked','disabled')),
  add column access_status_changed_at timestamptz,
  add column access_status_changed_by uuid references auth.users(id) on delete set null,
  add column access_status_note text;

alter table public.workspace_members drop constraint workspace_members_role_check;
alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner','admin','leader','teacher','student'));

create table public.platform_access_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.platform_access_admins enable row level security;
revoke all on public.platform_access_admins from anon, authenticated;

create table public.school_access_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  previous_status text not null check (previous_status in ('active','paused','blocked','disabled')),
  new_status text not null check (new_status in ('active','paused','blocked','disabled')),
  changed_by uuid not null references auth.users(id) on delete restrict,
  note text,
  changed_at timestamptz not null default now()
);
create index school_access_audit_workspace_changed_idx
  on public.school_access_audit(workspace_id, changed_at desc);
alter table public.school_access_audit enable row level security;
revoke all on public.school_access_audit from anon, authenticated;

create table public.student_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, workspace_id),
  constraint student_accounts_student_workspace_fk
    foreign key (student_id, workspace_id)
    references public.students(id, workspace_id)
    on delete cascade
);
create index student_accounts_workspace_idx on public.student_accounts(workspace_id);
alter table public.student_accounts enable row level security;

create or replace function private.is_platform_access_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_access_admins paa
    where paa.user_id = auth.uid() and paa.active = true
  );
$$;

create or replace function private.workspace_access_is_active(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.access_status = 'active'
  );
$$;

create or replace function private.has_active_workspace_membership(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and w.access_status = 'active'
  );
$$;

-- Preserve accepted V1 operational access for owner/admin/teacher only.
-- Leader and student receive purpose-specific policies in later stages.
create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner','admin','teacher')
      and w.access_status = 'active'
  );
$$;

create or replace function private.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
      and w.access_status = 'active'
  );
$$;

create or replace function private.is_own_student_account(target_workspace_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.student_accounts sa
    join public.workspaces w on w.id = sa.workspace_id
    where sa.user_id = auth.uid()
      and sa.student_id = target_student_id
      and sa.workspace_id = target_workspace_id
      and sa.active = true
      and w.access_status = 'active'
  );
$$;

create policy student_accounts_select_self_or_admin
on public.student_accounts for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['owner','admin'])
);

create policy student_accounts_insert_admin
on public.student_accounts for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = student_accounts.workspace_id
      and wm.user_id = student_accounts.user_id
      and wm.role = 'student'
      and wm.status = 'active'
  )
);

create policy student_accounts_update_admin
on public.student_accounts for update to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']))
with check (private.has_workspace_role(workspace_id, array['owner','admin']));

create policy student_accounts_delete_admin
on public.student_accounts for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']));

create policy workspaces_select_active_membership
on public.workspaces for select to authenticated
using (private.has_active_workspace_membership(id));

create policy workspace_members_select_self_active
on public.workspace_members for select to authenticated
using (
  user_id = (select auth.uid())
  and private.has_active_workspace_membership(workspace_id)
);

create or replace function private.guard_school_access_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (
    new.access_status is distinct from old.access_status
    or new.access_status_changed_at is distinct from old.access_status_changed_at
    or new.access_status_changed_by is distinct from old.access_status_changed_by
    or new.access_status_note is distinct from old.access_status_note
  ) and not private.is_platform_access_admin() then
    raise exception 'Only an authorised KSI platform access administrator may change school access state.';
  end if;
  return new;
end;
$$;

create trigger guard_school_access_fields_trigger
before update on public.workspaces
for each row execute function private.guard_school_access_fields();

create or replace function public.set_school_access_status(
  target_workspace_id uuid,
  target_status text,
  change_note text default null
)
returns public.workspaces
language plpgsql security definer set search_path = public
as $$
declare
  current_row public.workspaces;
  updated_row public.workspaces;
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Not authorised to manage KSI school access.';
  end if;
  if target_status not in ('active','paused','blocked','disabled') then
    raise exception 'Invalid school access status.';
  end if;
  select * into current_row from public.workspaces
  where id = target_workspace_id and workspace_type = 'school' for update;
  if not found then raise exception 'School workspace not found.'; end if;
  if current_row.access_status = target_status
     and coalesce(current_row.access_status_note,'') = coalesce(change_note,'') then
    return current_row;
  end if;
  update public.workspaces
  set access_status = target_status,
      access_status_changed_at = now(),
      access_status_changed_by = auth.uid(),
      access_status_note = change_note,
      updated_at = now()
  where id = target_workspace_id
  returning * into updated_row;
  insert into public.school_access_audit(
    workspace_id, previous_status, new_status, changed_by, note
  ) values (
    target_workspace_id, current_row.access_status, target_status, auth.uid(), change_note
  );
  return updated_row;
end;
$$;

revoke all on function public.set_school_access_status(uuid,text,text) from public, anon;
grant execute on function public.set_school_access_status(uuid,text,text) to authenticated;

create policy school_access_audit_select_platform_admin
on public.school_access_audit for select to authenticated
using (private.is_platform_access_admin());

grant select on public.school_access_audit to authenticated;
grant select, insert, update, delete on public.student_accounts to authenticated;

comment on column public.workspaces.access_status is
  'KSI platform access gate: active, paused, blocked, or disabled.';
comment on table public.platform_access_admins is
  'Explicit KAEC platform administrators authorised to manage school-level KSI access.';
comment on table public.student_accounts is
  'One-to-one binding between an authenticated student user and the existing KSI student learning record.';
