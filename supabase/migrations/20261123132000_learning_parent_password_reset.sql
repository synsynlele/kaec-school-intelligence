create function public.restart_learning_parent_activation(school_id uuid, account_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update private.learning_parent_accounts
  set activated_at = null, expires_at = now() + interval '7 days'
  where id = account_id and workspace_id = school_id and revoked_at is null
    and exists (select 1 from public.workspaces w where w.id = school_id
      and w.workspace_type = 'school' and w.access_status = 'active');
  return found;
end;
$$;

revoke all on function public.restart_learning_parent_activation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.restart_learning_parent_activation(uuid, uuid) to service_role;
