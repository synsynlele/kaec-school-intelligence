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
    and wm.role in ('owner','admin','teacher');

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

  if teacher_role is null or teacher_role not in ('owner','admin','teacher') then
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

drop function if exists public.deliver_lesson_to_class(uuid);
create function public.deliver_lesson_to_class(target_lesson_id uuid, target_teacher_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  lesson_row public.lessons;
  integration_content jsonb;
  v_assignment_id uuid;
  v_delivery_id uuid;
  learner_count integer;
  caller_role text;
  delivery_teacher_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  select * into lesson_row from public.lessons where id = target_lesson_id;
  if not found then raise exception 'Lesson not found.'; end if;
  if lesson_row.status <> 'validated' then raise exception 'Only validated lessons can be delivered.'; end if;
  if lesson_row.class_id is null or lesson_row.subject_id is null then
    raise exception 'This lesson must be linked to an existing class and subject before it can be delivered.';
  end if;

  select wm.role into caller_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = lesson_row.workspace_id
    and wm.user_id = caller_id
    and wm.status = 'active'
    and w.access_status = 'active';

  if caller_role is null or caller_role not in ('owner','admin','teacher') then
    raise exception 'Only an active teacher, school admin or owner can deliver this lesson.';
  end if;

  delivery_teacher_id := coalesce(target_teacher_id, caller_id);
  if caller_role = 'teacher' and delivery_teacher_id <> caller_id then
    raise exception 'A teacher can only deliver a lesson under their own teaching assignment.';
  end if;

  select ta.id into v_assignment_id
  from public.teaching_assignments ta
  where ta.workspace_id = lesson_row.workspace_id
    and ta.class_id = lesson_row.class_id
    and ta.subject_id = lesson_row.subject_id
    and ta.teacher_id = delivery_teacher_id
    and ta.active = true
  limit 1;

  if v_assignment_id is null then
    raise exception 'No active teaching assignment links this teacher to the lesson class and subject.';
  end if;

  select ls.content into integration_content
  from public.lesson_stages ls
  where ls.lesson_id = lesson_row.id and ls.stage_key = 'integration'
  limit 1;

  insert into public.lesson_deliveries(
    workspace_id,lesson_id,teaching_assignment_id,class_id,subject_id,teacher_id,
    reflection_prompt,real_life_assignment
  ) values (
    lesson_row.workspace_id,lesson_row.id,v_assignment_id,lesson_row.class_id,lesson_row.subject_id,delivery_teacher_id,
    nullif(btrim(coalesce(integration_content->>'reflectionPrompt','')),''),
    nullif(btrim(coalesce(integration_content->>'transferTask','')),'')
  )
  on conflict (lesson_id) do update set
    teaching_assignment_id = excluded.teaching_assignment_id,
    teacher_id = excluded.teacher_id,
    delivered_at = now(),
    reflection_prompt = excluded.reflection_prompt,
    real_life_assignment = excluded.real_life_assignment,
    updated_at = now()
  returning id into v_delivery_id;

  insert into public.student_lesson_work(
    workspace_id,delivery_id,lesson_id,class_id,subject_id,teacher_id,student_id
  )
  select lesson_row.workspace_id, v_delivery_id, lesson_row.id, lesson_row.class_id,
         lesson_row.subject_id, delivery_teacher_id, s.id
  from public.students s
  where s.workspace_id = lesson_row.workspace_id
    and s.class_id = lesson_row.class_id
    and s.active = true
  on conflict (delivery_id, student_id) do update set
    teacher_id = excluded.teacher_id,
    updated_at = now();

  select count(*)::int into learner_count
  from public.student_lesson_work slw
  where slw.delivery_id = v_delivery_id;

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'lesson_id', lesson_row.id,
    'workspace_id', lesson_row.workspace_id,
    'class_id', lesson_row.class_id,
    'subject_id', lesson_row.subject_id,
    'teacher_id', delivery_teacher_id,
    'teaching_assignment_id', v_assignment_id,
    'student_count', learner_count,
    'reflection_prompt', nullif(btrim(coalesce(integration_content->>'reflectionPrompt','')),''),
    'real_life_assignment', nullif(btrim(coalesce(integration_content->>'transferTask','')),'')
  );
end;
$$;

revoke execute on function public.deliver_lesson_to_class(uuid,uuid) from public, anon;
grant execute on function public.deliver_lesson_to_class(uuid,uuid) to authenticated;
