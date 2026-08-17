-- KSI 2.0 Stage 7 — allow authenticated platform admins to pass the self-only RLS policy.
-- Applied to dedicated KSI Supabase project as stage7_platform_admin_select_grant.

grant select on public.platform_access_admins to authenticated;
