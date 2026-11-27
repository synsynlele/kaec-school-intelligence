create table private.khpos_roster_shares (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table private.khpos_roster_shares enable row level security;
revoke all on private.khpos_roster_shares from public,anon,authenticated;

create function public.manage_khpos_roster_share(p_workspace uuid,p_enabled boolean default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce(private.has_workspace_role(p_workspace,array['owner','admin']),false)
    or not exists(select 1 from public.workspaces w
      where w.id=p_workspace and w.workspace_type='school' and w.access_status='active') then
    raise exception 'School Owner or Admin access is required.' using errcode='42501';
  end if;
  if p_enabled is not null then
    insert into private.khpos_roster_shares(workspace_id,enabled,updated_by)
    values(p_workspace,p_enabled,auth.uid())
    on conflict(workspace_id) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
  end if;
  return coalesce((select enabled from private.khpos_roster_shares s where s.workspace_id=p_workspace),false);
end
$$;
revoke all on function public.manage_khpos_roster_share(uuid,boolean) from public,anon;
grant execute on function public.manage_khpos_roster_share(uuid,boolean) to authenticated;

create function public.export_khpos_roster(p_workspace uuid,p_class uuid,p_after uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from private.khpos_roster_shares s
    join public.workspaces w on w.id=s.workspace_id and w.workspace_type='school' and w.access_status='active'
    where s.workspace_id=p_workspace and s.enabled) then
    raise exception 'The KSI school owner must enable roster sharing.' using errcode='42501';
  end if;
  if p_class is null then
    return coalesce((select jsonb_agg(to_jsonb(c) order by c.session desc,c.name,c.id)
      from (select id,name,academic_session as session from public.classes
        where workspace_id=p_workspace and active order by academic_session desc,name,id limit 500) c),'[]'::jsonb);
  end if;
  if not exists(select 1 from public.classes c where c.id=p_class and c.workspace_id=p_workspace and c.active) then
    raise exception 'Choose an active class in this workspace.' using errcode='22023';
  end if;
  return jsonb_build_object('session',(select c.academic_session from public.classes c where c.id=p_class),
    'learners',coalesce((select jsonb_agg(to_jsonb(learner) order by learner.id) from (
    select id,display_name as name,external_reference as admission from public.students
    where workspace_id=p_workspace and class_id=p_class and active and (p_after is null or id>p_after)
    order by id limit 50
  ) learner),'[]'::jsonb));
end
$$;
revoke all on function public.export_khpos_roster(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.export_khpos_roster(uuid,uuid,uuid) to service_role;
