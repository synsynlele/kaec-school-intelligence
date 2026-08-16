-- KSI 2.0 Stage 7 — leader staff access and student self-read boundary
-- Applied to dedicated KSI Supabase project as stage7_role_and_student_read_boundary.

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner','admin','leader','teacher')
      and w.access_status = 'active'
  );
$$;

create policy students_select_self_account
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.student_accounts sa
    join public.workspaces w on w.id = sa.workspace_id
    where sa.student_id = students.id
      and sa.workspace_id = students.workspace_id
      and sa.user_id = (select auth.uid())
      and sa.active = true
      and w.access_status = 'active'
  )
);
