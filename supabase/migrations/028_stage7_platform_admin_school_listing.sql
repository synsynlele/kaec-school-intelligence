-- KSI 2.0 Stage 7 — platform administrator school listing
-- Applied to dedicated KSI Supabase project as stage7_platform_admin_school_listing.

create policy workspaces_select_platform_admin_schools
on public.workspaces
for select
to authenticated
using (
  workspace_type = 'school'
  and private.is_platform_access_admin()
);

insert into public.platform_access_admins (user_id, active, created_by)
select wm.user_id, true, wm.user_id
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
where w.workspace_type = 'school'
  and w.name = 'KAEC Nigerian Schools'
  and wm.role = 'owner'
  and wm.status = 'active'
on conflict (user_id) do update
set active = excluded.active;
