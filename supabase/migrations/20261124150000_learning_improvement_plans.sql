create table private.learning_improvement_plans (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  learner_id uuid not null references public.students(id) on delete cascade,
  progress text not null check (char_length(progress) <= 500),
  priority text not null check (char_length(priority) between 1 and 200),
  learner_action text not null check (char_length(learner_action) between 1 and 500),
  parent_action text not null check (char_length(parent_action) between 1 and 500),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  withdrawn boolean not null default false,
  primary key (workspace_id, learner_id)
);
alter table private.learning_improvement_plans enable row level security;

create function public.manage_learning_improvement_plan(
  school_id uuid, target_class uuid, school_session text, target_learner uuid,
  operation text, plan jsonb default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform private.check_learning_enrolment_scope(school_id, target_class, school_session);
  perform 1 from public.students s where s.id = target_learner and s.workspace_id = school_id
    and s.class_id = target_class and s.active for update;
  if not found then raise exception 'Choose an active learner in this class.'; end if;

  case operation
    when 'publish' then
      insert into private.learning_improvement_plans as p (
        workspace_id, learner_id, progress, priority, learner_action, parent_action, published_by
      ) values (
        school_id, target_learner, btrim(coalesce(plan->>'progress','')), btrim(plan->>'priority'),
        btrim(plan->>'learner_action'), btrim(plan->>'parent_action'), auth.uid()
      )
      on conflict (workspace_id, learner_id) do update set
        progress = excluded.progress, priority = excluded.priority, learner_action = excluded.learner_action,
        parent_action = excluded.parent_action, published_by = excluded.published_by,
        published_at = now(), withdrawn = false;
    when 'withdraw' then
      update private.learning_improvement_plans p set withdrawn = true
      where p.workspace_id = school_id and p.learner_id = target_learner;
    when 'read' then null;
    else raise exception 'Unknown improvement plan operation.';
  end case;

  return (select jsonb_build_object('progress',p.progress,'priority',p.priority,
    'learner_action',p.learner_action,'parent_action',p.parent_action,'withdrawn',p.withdrawn)
    from private.learning_improvement_plans p
    where p.workspace_id = school_id and p.learner_id = target_learner);
end;
$$;

create function public.get_my_learning_improvement_plans()
returns jsonb language sql stable security definer set search_path = ''
as $$
  with learner as (select * from private.learning_cbt_student())
  select coalesce(jsonb_agg(jsonb_build_object(
    'learner_id',s.id,'learner_name',s.display_name,'progress',p.progress,'priority',p.priority,
    'action',case when l.id is null then p.parent_action else p.learner_action end
  ) order by s.display_name,s.id), '[]'::jsonb)
  from private.learning_improvement_plans p
  join public.students s on s.id = p.learner_id and s.workspace_id = p.workspace_id and s.active
  left join learner l on l.id = s.id and l.workspace_id = s.workspace_id
  where not p.withdrawn and (l.id is not null or private.learning_report_parent_can_read(s.id,s.workspace_id));
$$;

revoke all on function public.manage_learning_improvement_plan(uuid,uuid,text,uuid,text,jsonb),
  public.get_my_learning_improvement_plans() from public, anon;
grant execute on function public.manage_learning_improvement_plan(uuid,uuid,text,uuid,text,jsonb),
  public.get_my_learning_improvement_plans() to authenticated;
