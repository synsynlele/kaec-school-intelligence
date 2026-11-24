create table private.learning_class_work (
  assessment_id uuid primary key references public.assessments(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  kind text not null check (kind in ('assignment','project')),
  title text not null,
  subject text,
  instructions text,
  tasks jsonb not null,
  due_on date,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null
);
alter table private.learning_class_work enable row level security;
create index learning_class_work_class_idx on private.learning_class_work(workspace_id,class_id);

create function public.manage_learning_class_work(
  source_id uuid, operation text, deadline date default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare source public.assessments; kind text; task_list jsonb;
begin
  select a.* into source from public.assessments a where a.id = source_id for update;
  if not found
    or not coalesce(private.can_view_teacher_artifact(source.workspace_id,'assessment',source_id),false)
    or not coalesce(private.has_workspace_role(source.workspace_id,array['owner','admin','leader','teacher']),false)
    or not exists (select from public.workspaces w where w.id = source.workspace_id
      and w.workspace_type = 'school' and w.access_status = 'active')
  then raise exception 'Assessment unavailable.'; end if;

  case operation
    when 'publish' then
      kind := coalesce(source.blueprint->>'assessmentKind', case when source.assessment_mode = 'project' then 'project' end);
      if kind is null or kind not in ('assignment','project') or source.status <> 'validated'
        or not exists (select from public.classes c where c.id = source.class_id and c.workspace_id = source.workspace_id and c.active)
      then raise exception 'Validate the assignment or project and link an active class before publishing.'; end if;

      select jsonb_agg(jsonb_build_object(
        'id',i.id,'prompt',i.content->>'prompt','options',
        case when i.item_type = 'objective' and jsonb_typeof(i.content->'options') = 'array' then i.content->'options' end,
        'deliverable',i.content->>'deliverable','constraints',i.content->'constraints','marks',i.marks
      ) order by i.position) into task_list
      from public.assessment_items i
      where i.assessment_id = source_id and nullif(btrim(i.content->>'prompt'),'') is not null;
      if task_list is null then raise exception 'Add learner instructions or questions first.'; end if;

      insert into private.learning_class_work (
        assessment_id,workspace_id,class_id,kind,title,subject,instructions,tasks,due_on,published_by
      ) values (
        source_id,source.workspace_id,source.class_id,kind,source.title,
        coalesce((select s.name from public.subjects s where s.id = source.subject_id and s.workspace_id = source.workspace_id),source.blueprint->>'subject'),
        source.blueprint->>'studentInstructions',task_list,deadline,auth.uid()
      ) on conflict (assessment_id) do update set
        class_id = excluded.class_id, kind = excluded.kind, title = excluded.title, subject = excluded.subject,
        instructions = excluded.instructions, tasks = excluded.tasks, due_on = excluded.due_on,
        published_by = excluded.published_by, published_at = now();
    when 'withdraw' then
      delete from private.learning_class_work w where w.assessment_id = source_id;
    when 'read' then null;
    else raise exception 'Unknown class work operation.';
  end case;
  return (select jsonb_build_object('due_on',w.due_on,'published_at',w.published_at,'class_id',w.class_id)
    from private.learning_class_work w where w.assessment_id = source_id);
end;
$$;

create function public.get_my_learning_class_work(target_id uuid default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',w.assessment_id,'kind',w.kind,'title',w.title,'subject',w.subject,'due_on',w.due_on,
    'instructions',case when target_id is not null then w.instructions end,
    'tasks',case when target_id is not null then w.tasks end
  ) order by w.due_on nulls last,w.published_at desc,w.assessment_id),'[]'::jsonb)
  from private.learning_cbt_student() l
  join private.learning_class_work w on w.workspace_id = l.workspace_id and w.class_id = l.class_id
  join public.classes c on c.id = w.class_id and c.workspace_id = w.workspace_id and c.active
  join public.assessments a on a.id = w.assessment_id and a.workspace_id = w.workspace_id and a.status = 'validated' and a.class_id = w.class_id
  where target_id is null or w.assessment_id = target_id;
$$;

revoke all on function public.manage_learning_class_work(uuid,text,date), public.get_my_learning_class_work(uuid) from public, anon;
grant execute on function public.manage_learning_class_work(uuid,text,date), public.get_my_learning_class_work(uuid) to authenticated;
