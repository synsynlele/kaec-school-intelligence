create or replace function public.get_teaching_map(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  assignments_json jsonb;
  teachers_json jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  select wm.role into caller_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = target_workspace_id
    and wm.user_id = caller_id
    and wm.status = 'active'
    and w.workspace_type = 'school'
    and w.access_status = 'active';

  if caller_role is null or caller_role not in ('owner','admin','leader','teacher') then
    raise exception 'This school teaching map is not available to this account.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ta.id,
    'class_id', ta.class_id,
    'class_name', c.name,
    'subject_id', ta.subject_id,
    'subject_name', s.name,
    'teacher_id', ta.teacher_id,
    'teacher_name', coalesce(p.display_name, 'Teacher'),
    'active', ta.active
  ) order by c.name, s.name, coalesce(p.display_name, 'Teacher')), '[]'::jsonb)
  into assignments_json
  from public.teaching_assignments ta
  join public.classes c on c.id = ta.class_id and c.workspace_id = ta.workspace_id
  join public.subjects s on s.id = ta.subject_id and s.workspace_id = ta.workspace_id
  left join public.profiles p on p.id = ta.teacher_id
  where ta.workspace_id = target_workspace_id
    and (caller_role in ('owner','admin','leader') or ta.teacher_id = caller_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', wm.user_id,
    'name', coalesce(p.display_name, 'Teacher'),
    'role', wm.role
  ) order by coalesce(p.display_name, 'Teacher')), '[]'::jsonb)
  into teachers_json
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = target_workspace_id
    and wm.status = 'active'
    and wm.role in ('owner','admin','leader','teacher');

  return jsonb_build_object(
    'workspace_id', target_workspace_id,
    'role', caller_role,
    'assignments', assignments_json,
    'teachers', teachers_json
  );
end;
$$;

revoke execute on function public.get_teaching_map(uuid) from public, anon;
grant execute on function public.get_teaching_map(uuid) to authenticated;

create or replace function public.set_teaching_assignment(
  target_workspace_id uuid,
  target_class_id uuid,
  target_subject_id uuid,
  target_teacher_id uuid,
  target_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  teacher_role text;
  assignment_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  select wm.role into caller_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = target_workspace_id
    and wm.user_id = caller_id
    and wm.status = 'active'
    and w.workspace_type = 'school'
    and w.access_status = 'active';

  if caller_role is null or caller_role not in ('owner','admin') then
    raise exception 'Only a school owner or admin can change teaching assignments.';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.workspace_id = target_workspace_id and c.active = true
  ) then raise exception 'The selected class is not active in this school.'; end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = target_subject_id and s.workspace_id = target_workspace_id and s.active = true
  ) then raise exception 'The selected subject is not active in this school.'; end if;

  select wm.role into teacher_role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = target_teacher_id
    and wm.status = 'active';

  if teacher_role is null or teacher_role not in ('owner','admin','leader','teacher') then
    raise exception 'The selected teacher must be an active school staff member.';
  end if;

  insert into public.teaching_assignments(
    workspace_id,class_id,subject_id,teacher_id,active,created_by
  ) values (
    target_workspace_id,target_class_id,target_subject_id,target_teacher_id,target_active,caller_id
  )
  on conflict (workspace_id,class_id,subject_id,teacher_id)
  do update set active = excluded.active, updated_at = now()
  returning id into assignment_id;

  return jsonb_build_object(
    'assignment_id', assignment_id,
    'workspace_id', target_workspace_id,
    'class_id', target_class_id,
    'subject_id', target_subject_id,
    'teacher_id', target_teacher_id,
    'active', target_active
  );
end;
$$;

revoke execute on function public.set_teaching_assignment(uuid,uuid,uuid,uuid,boolean) from public, anon;
grant execute on function public.set_teaching_assignment(uuid,uuid,uuid,uuid,boolean) to authenticated;

