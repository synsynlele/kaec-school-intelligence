-- KSI 2.0 Stage 7 — student may read only their own class identity
-- Applied to dedicated KSI Supabase project as stage7_student_class_read_boundary.

create policy classes_select_student_own
on public.classes
for select
to authenticated
using (
  exists (
    select 1
    from public.student_accounts sa
    join public.students s on s.id = sa.student_id and s.workspace_id = sa.workspace_id
    join public.workspaces w on w.id = sa.workspace_id
    where sa.user_id = (select auth.uid())
      and sa.active = true
      and s.class_id = classes.id
      and classes.workspace_id = sa.workspace_id
      and w.access_status = 'active'
  )
);
