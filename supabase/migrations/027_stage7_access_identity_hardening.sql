-- KSI 2.0 Stage 7 — access identity hardening
-- Applied to dedicated KSI Supabase project as stage7_access_identity_hardening.

create index if not exists workspaces_access_status_changed_by_idx
  on public.workspaces(access_status_changed_by);
create index if not exists platform_access_admins_created_by_idx
  on public.platform_access_admins(created_by);
create index if not exists school_access_audit_changed_by_idx
  on public.school_access_audit(changed_by);
create index if not exists student_accounts_created_by_idx
  on public.student_accounts(created_by);

drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_select_active_membership on public.workspaces;
create policy workspaces_select_active_membership
on public.workspaces for select
to authenticated
using (private.has_active_workspace_membership(id));

drop policy if exists workspace_members_select_member on public.workspace_members;
drop policy if exists workspace_members_select_self_active on public.workspace_members;
create policy workspace_members_select_governed
on public.workspace_members for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  or (
    user_id = (select auth.uid())
    and private.has_active_workspace_membership(workspace_id)
  )
);

create policy platform_access_admins_select_self
on public.platform_access_admins for select
to authenticated
using (user_id = (select auth.uid()));
