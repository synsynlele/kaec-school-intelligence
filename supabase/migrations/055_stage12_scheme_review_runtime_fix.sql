drop function if exists public.review_scheme_entry(uuid,text,text);

create function public.review_scheme_entry(target_entry_id uuid, target_status text, target_review_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare entry_row public.scheme_entries%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then raise exception 'Platform curriculum admin permission required.'; end if;
  if target_status not in ('approved','rejected') then raise exception 'Review status must be approved or rejected.'; end if;
  update public.scheme_entries
  set review_status=target_status,
      review_note=nullif(btrim(target_review_note),''),
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      updated_at=now()
  where id=target_entry_id
  returning * into entry_row;
  if not found then raise exception 'Scheme entry not found.'; end if;
  update public.scheme_documents d
  set extraction_status=case when target_status='approved' then 'reviewed' else d.extraction_status end,
      updated_at=now()
  where d.id=entry_row.document_id;
  return jsonb_build_object('entry_id',entry_row.id,'status',target_status);
end;
$$;

revoke all on function public.review_scheme_entry(uuid,text,text) from public, anon;
grant execute on function public.review_scheme_entry(uuid,text,text) to authenticated;
