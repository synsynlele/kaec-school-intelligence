-- KAEC School Intelligence — Stage 1 school workspace bootstrap
-- Authenticated users may create school workspaces they own. The database,
-- not the client, establishes the creator's owner membership.

create or replace function private.handle_school_workspace_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_type <> 'school' then
    return new;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_school_workspace_created()
from public, anon, authenticated;

create trigger on_school_workspace_created
after insert on public.workspaces
for each row
when (new.workspace_type = 'school')
execute function private.handle_school_workspace_created();

create policy workspaces_insert_school_self on public.workspaces
for insert to authenticated
with check (
  workspace_type = 'school'
  and created_by = (select auth.uid())
);
