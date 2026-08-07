-- KAEC School Intelligence — Stage 1 private resource storage
-- Path contract: <workspace_id>/<creator_user_id>/<unique-file-name>
-- Resource metadata in public.resources remains the authority for whether a
-- stored object is private to its creator or visible to the whole workspace.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ksi-resources',
  'ksi-resources',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.valid_resource_storage_path(
  target_workspace_id uuid,
  target_creator_id uuid,
  target_path text
)
returns boolean
language sql
immutable
security invoker
set search_path = public
as $$
  select
    target_path is not null
    and split_part(target_path, '/', 1) = target_workspace_id::text
    and split_part(target_path, '/', 2) = target_creator_id::text
    and split_part(target_path, '/', 3) <> '';
$$;

revoke all on function private.valid_resource_storage_path(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function private.valid_resource_storage_path(uuid, uuid, text)
to authenticated;

alter table public.resources
add constraint resources_storage_path_shape
check (
  storage_path is null
  or private.valid_resource_storage_path(workspace_id, created_by, storage_path)
);

-- Uploaders may only write into their own folder inside a workspace they belong to.
create policy ksi_resources_insert_member_own_folder
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ksi-resources'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

-- Downloads and listings are granted only when a matching resource metadata row
-- authorises the current user. Private resources remain creator-only.
create policy ksi_resources_select_authorised
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ksi-resources'
  and exists (
    select 1
    from public.resources r
    where r.storage_path = name
      and r.workspace_id::text = (storage.foldername(name))[1]
      and private.is_workspace_member(r.workspace_id)
      and (r.visibility = 'workspace' or r.created_by = (select auth.uid()))
  )
);

-- Files are immutable in place. Replacing content requires a new object/path so
-- provenance and artifact links cannot silently point to changed bytes.
-- Deletion is allowed to the creator or workspace administrators.
create policy ksi_resources_delete_authorised
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ksi-resources'
  and exists (
    select 1
    from public.resources r
    where r.storage_path = name
      and r.workspace_id::text = (storage.foldername(name))[1]
      and (
        r.created_by = (select auth.uid())
        or private.has_workspace_role(r.workspace_id, array['owner','admin'])
      )
  )
);
