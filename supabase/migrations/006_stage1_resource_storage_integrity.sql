-- KAEC School Intelligence — resource/object integrity hardening
-- Storage objects cannot be uploaded as untracked orphan files. A matching
-- authorised public.resources row must exist first.

drop policy if exists ksi_resources_insert_member_own_folder on storage.objects;
create policy ksi_resources_insert_tracked_resource
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ksi-resources'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and exists (
    select 1
    from public.resources r
    where r.storage_path = name
      and r.workspace_id::text = (storage.foldername(name))[1]
      and r.created_by = (select auth.uid())
      and r.status in ('processing', 'uploaded')
      and private.is_workspace_member(r.workspace_id)
  )
);

drop policy if exists ksi_resources_select_authorised on storage.objects;
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
      and r.status in ('uploaded', 'ready')
      and private.is_workspace_member(r.workspace_id)
      and (r.visibility = 'workspace' or r.created_by = (select auth.uid()))
  )
);
