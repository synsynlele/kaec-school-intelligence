create or replace function public.get_learning_family_setup(school_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_learning_families(school_id) then raise exception 'School administrator access is required.'; end if;
  return jsonb_build_object(
    'learners', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.display_name, 'class_name', c.name, 'has_photo', photo.learner_id is not null)
      order by s.display_name, s.id)
      from public.students s left join public.classes c on c.id = s.class_id and c.workspace_id = s.workspace_id
      left join private.learning_passport_photos photo on photo.learner_id = s.id
      where s.workspace_id = school_id and s.active), '[]'::jsonb),
    'parents', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name,
      'username', p.username, 'status', case
        when p.revoked_at is not null then 'Revoked'
        when p.activated_at is not null then 'Active'
        when p.expires_at <= now() then 'Expired'
        else 'Awaiting activation' end,
      'learner_ids', coalesce((select jsonb_agg(s.id)
        from private.learning_parent_links l join public.students s on s.id = l.learner_id
        where l.parent_id = p.id and s.workspace_id = school_id and s.active), '[]'::jsonb),
      'learners', coalesce((select jsonb_agg(s.display_name order by s.display_name)
        from private.learning_parent_links l join public.students s on s.id=l.learner_id
        where l.parent_id = p.id and s.workspace_id = school_id), '[]'::jsonb))
      order by p.display_name, p.id)
      from private.learning_parent_accounts p where p.workspace_id = school_id), '[]'::jsonb)
  );
end;
$$;

create function public.update_learning_parent(
  school_id uuid, account_id uuid, parent_name text, learner_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_learning_families(school_id) then
    raise exception 'School administrator access is required.';
  end if;

  if coalesce(cardinality(learner_ids), 0) not between 1 and 30
    or length(btrim(coalesce(parent_name, ''))) not between 1 and 120 then
    raise exception 'Enter a parent name and select 1 to 30 active learners.';
  end if;

  perform s.id from public.students s
    where s.workspace_id = school_id and s.active and s.id = any(learner_ids)
    order by s.id for share;
  if exists (select 1 from unnest(learner_ids) as selected(id) where not exists (
    select 1 from public.students s where s.id = selected.id and s.workspace_id = school_id and s.active
  )) then
    raise exception 'Choose active learners registered in this school.';
  end if;

  update private.learning_parent_accounts p set display_name = btrim(parent_name)
    where p.id = account_id and p.workspace_id = school_id and p.revoked_at is null;
  if not found then raise exception 'Parent account unavailable.'; end if;

  delete from private.learning_parent_links l
    where l.parent_id = account_id and not (l.learner_id = any(learner_ids))
      and exists (select 1 from public.students s
        where s.id = l.learner_id and s.workspace_id = school_id and s.active);
  insert into private.learning_parent_links (parent_id, learner_id)
    select distinct account_id, id from unnest(learner_ids) as selected(id)
    on conflict do nothing;
end;
$$;

revoke all on function public.update_learning_parent(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.update_learning_parent(uuid, uuid, text, uuid[]) to authenticated;
