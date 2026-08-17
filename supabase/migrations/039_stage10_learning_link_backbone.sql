create table if not exists public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, class_id, subject_id, teacher_id),
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id) on delete restrict,
  foreign key (subject_id, workspace_id) references public.subjects(id, workspace_id) on delete restrict,
  foreign key (workspace_id, teacher_id) references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index if not exists teaching_assignments_teacher_idx on public.teaching_assignments(teacher_id);
create index if not exists teaching_assignments_class_subject_idx on public.teaching_assignments(workspace_id, class_id, subject_id) where active = true;

create table if not exists public.lesson_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lesson_id uuid not null unique,
  teaching_assignment_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  delivered_at timestamptz not null default now(),
  reflection_prompt text,
  real_life_assignment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (lesson_id, workspace_id) references public.lessons(id, workspace_id) on delete restrict,
  foreign key (teaching_assignment_id, workspace_id) references public.teaching_assignments(id, workspace_id) on delete restrict,
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id) on delete restrict,
  foreign key (subject_id, workspace_id) references public.subjects(id, workspace_id) on delete restrict,
  foreign key (workspace_id, teacher_id) references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index if not exists lesson_deliveries_class_idx on public.lesson_deliveries(workspace_id, class_id, delivered_at desc);
create index if not exists lesson_deliveries_teacher_idx on public.lesson_deliveries(teacher_id, delivered_at desc);
create index if not exists lesson_deliveries_assignment_idx on public.lesson_deliveries(teaching_assignment_id);

create table if not exists public.student_lesson_work (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  delivery_id uuid not null,
  lesson_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null,
  status text not null default 'assigned' check (status in ('assigned','submitted','reviewed')),
  reflection_response text,
  assignment_response text,
  submitted_at timestamptz,
  teacher_feedback text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_id, student_id),
  foreign key (delivery_id, workspace_id) references public.lesson_deliveries(id, workspace_id) on delete cascade,
  foreign key (lesson_id, workspace_id) references public.lessons(id, workspace_id) on delete restrict,
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id) on delete restrict,
  foreign key (subject_id, workspace_id) references public.subjects(id, workspace_id) on delete restrict,
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade,
  foreign key (workspace_id, teacher_id) references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index if not exists student_lesson_work_student_idx on public.student_lesson_work(student_id, created_at desc);
create index if not exists student_lesson_work_teacher_idx on public.student_lesson_work(teacher_id, status, created_at desc);
create index if not exists student_lesson_work_lesson_idx on public.student_lesson_work(lesson_id);

alter table public.teaching_assignments enable row level security;
alter table public.lesson_deliveries enable row level security;
alter table public.student_lesson_work enable row level security;

revoke all on public.teaching_assignments from anon, authenticated;
revoke all on public.lesson_deliveries from anon, authenticated;
revoke all on public.student_lesson_work from anon, authenticated;

drop function if exists public.deliver_lesson_to_class(uuid);
create function public.deliver_lesson_to_class(target_lesson_id uuid)
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

  insert into public.teaching_assignments(workspace_id,class_id,subject_id,teacher_id,created_by)
  values (lesson_row.workspace_id, lesson_row.class_id, lesson_row.subject_id, caller_id, caller_id)
  on conflict (workspace_id,class_id,subject_id,teacher_id)
  do update set active = true, updated_at = now()
  returning id into v_assignment_id;

  select ls.content into integration_content
  from public.lesson_stages ls
  where ls.lesson_id = lesson_row.id and ls.stage_key = 'integration'
  limit 1;

  insert into public.lesson_deliveries(
    workspace_id,lesson_id,teaching_assignment_id,class_id,subject_id,teacher_id,
    reflection_prompt,real_life_assignment
  ) values (
    lesson_row.workspace_id,lesson_row.id,v_assignment_id,lesson_row.class_id,lesson_row.subject_id,caller_id,
    nullif(btrim(coalesce(integration_content->>'reflectionPrompt','')),''),
    nullif(btrim(coalesce(integration_content->>'transferTask','')),'')
  )
  on conflict (lesson_id) do update set updated_at = now()
  returning id into v_delivery_id;

  insert into public.student_lesson_work(
    workspace_id,delivery_id,lesson_id,class_id,subject_id,teacher_id,student_id
  )
  select lesson_row.workspace_id, v_delivery_id, lesson_row.id, lesson_row.class_id,
         lesson_row.subject_id, caller_id, s.id
  from public.students s
  where s.workspace_id = lesson_row.workspace_id
    and s.class_id = lesson_row.class_id
    and s.active = true
  on conflict (delivery_id, student_id) do nothing;

  select count(*)::int into learner_count
  from public.student_lesson_work slw
  where slw.delivery_id = v_delivery_id;

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'lesson_id', lesson_row.id,
    'workspace_id', lesson_row.workspace_id,
    'class_id', lesson_row.class_id,
    'subject_id', lesson_row.subject_id,
    'teacher_id', caller_id,
    'student_count', learner_count,
    'reflection_prompt', nullif(btrim(coalesce(integration_content->>'reflectionPrompt','')),''),
    'real_life_assignment', nullif(btrim(coalesce(integration_content->>'transferTask','')),'')
  );
end;
$$;

revoke execute on function public.deliver_lesson_to_class(uuid) from public, anon;
grant execute on function public.deliver_lesson_to_class(uuid) to authenticated;

drop function if exists public.submit_my_lesson_work(uuid,text,text);
create function public.submit_my_lesson_work(target_delivery_id uuid, reflection_text text, assignment_text text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  account_row public.student_accounts;
  work_row public.student_lesson_work;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = caller_id and sa.active = true and w.access_status = 'active';
  if not found then raise exception 'This account is not linked to an active KSI student profile.'; end if;

  select * into work_row
  from public.student_lesson_work slw
  where slw.delivery_id = target_delivery_id
    and slw.workspace_id = account_row.workspace_id
    and slw.student_id = account_row.student_id;
  if not found then raise exception 'This lesson assignment is not available to this student.'; end if;

  update public.student_lesson_work
  set reflection_response = nullif(btrim(coalesce(reflection_text,'')),''),
      assignment_response = nullif(btrim(coalesce(assignment_text,'')),''),
      status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = work_row.id;

  return jsonb_build_object('delivery_id', target_delivery_id, 'status', 'submitted', 'submitted_at', now());
end;
$$;

revoke execute on function public.submit_my_lesson_work(uuid,text,text) from public, anon;
grant execute on function public.submit_my_lesson_work(uuid,text,text) to authenticated;

create or replace function public.get_my_learning_resources()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  account_row public.student_accounts;
  student_row public.students;
  workspace_row public.workspaces;
  resources_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into account_row from public.student_accounts sa
  where sa.user_id = auth.uid() and sa.active = true;
  if not found then raise exception 'This account is not linked to an active KSI student profile.'; end if;

  select * into workspace_row from public.workspaces w
  where w.id = account_row.workspace_id and w.workspace_type = 'school';
  if not found or workspace_row.access_status <> 'active' then
    raise exception 'Your school does not currently have active KSI access.';
  end if;

  select * into student_row from public.students s
  where s.id = account_row.student_id and s.workspace_id = account_row.workspace_id and s.active = true;
  if not found then raise exception 'Your KSI student profile is not active.'; end if;

  select coalesce(jsonb_agg(resource_row order by (resource_row->>'delivered_at') desc), '[]'::jsonb)
  into resources_json
  from (
    select jsonb_build_object(
      'delivery_id', d.id,
      'lesson_id', l.id,
      'title', l.title,
      'topic', l.topic,
      'objective', l.objective,
      'subject', coalesce(sub.name, 'Learning'),
      'teacher_name', coalesce(p.display_name, 'Your teacher'),
      'duration_minutes', l.duration_minutes,
      'delivered_at', d.delivered_at,
      'updated_at', l.updated_at,
      'warm_up', coalesce(awakening.content->>'experience', ''),
      'explanation', coalesce(full_light.content->>'teachingContent', ''),
      'practice', coalesce(second_trial.content->>'experience', ''),
      'practice_actions', coalesce(second_trial.content->'learnerActions', '[]'::jsonb),
      'transfer_task', coalesce(d.real_life_assignment, ''),
      'reflection_prompt', coalesce(d.reflection_prompt, ''),
      'work_status', slw.status,
      'reflection_response', coalesce(slw.reflection_response, ''),
      'assignment_response', coalesce(slw.assignment_response, ''),
      'submitted_at', slw.submitted_at,
      'teacher_feedback', coalesce(slw.teacher_feedback, '')
    ) as resource_row
    from public.student_lesson_work slw
    join public.lesson_deliveries d on d.id = slw.delivery_id
    join public.lessons l on l.id = slw.lesson_id
    left join public.subjects sub on sub.id = slw.subject_id
    left join public.profiles p on p.id = slw.teacher_id
    left join public.lesson_stages awakening on awakening.lesson_id = l.id and awakening.stage_key = 'awakening'
    left join public.lesson_stages full_light on full_light.lesson_id = l.id and full_light.stage_key = 'full_illumination'
    left join public.lesson_stages second_trial on second_trial.lesson_id = l.id and second_trial.stage_key = 'trial_second'
    where slw.workspace_id = account_row.workspace_id
      and slw.student_id = account_row.student_id
    order by d.delivered_at desc
    limit 100
  ) q;

  return jsonb_build_object('student_id', student_row.id, 'class_id', student_row.class_id, 'resources', resources_json);
end;
$$;

revoke execute on function public.get_my_learning_resources() from public, anon;
grant execute on function public.get_my_learning_resources() to authenticated;
