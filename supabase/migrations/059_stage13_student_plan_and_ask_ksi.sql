-- KSI 2.0 Stage 13 — persistent personalized learning plan + bounded Ask KSI tutor context.
-- Student planning is derived from the same governed diagnosis/intervention/mastery/curriculum record.
-- Ask KSI may explain and practise learning; it cannot create authoritative diagnosis, intervention or mastery states.

create table if not exists public.student_learning_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null,
  source_fingerprint text not null,
  status text not null default 'active' check (status in ('active','superseded')),
  generated_for_user uuid not null references auth.users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade,
  unique (student_id, source_fingerprint)
);

create unique index if not exists student_learning_plans_one_active_idx
  on public.student_learning_plans(student_id)
  where status = 'active';
create index if not exists student_learning_plans_workspace_idx
  on public.student_learning_plans(workspace_id, student_id, generated_at desc);

create table if not exists public.student_learning_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.student_learning_plans(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null,
  position integer not null check (position > 0),
  source_kind text not null check (source_kind in ('intervention','mastery','curriculum','baseline')),
  subject_id uuid references public.subjects(id) on delete set null,
  objective_node_id uuid references public.learning_objective_nodes(id) on delete set null,
  curriculum_node_id uuid references public.curriculum_nodes(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  action_text text not null,
  why_text text not null,
  success_signal text,
  status text not null default 'todo' check (status in ('todo','in_progress','completed','skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade,
  unique (plan_id, position)
);

create index if not exists student_learning_plan_steps_student_idx
  on public.student_learning_plan_steps(workspace_id, student_id, status, position);

create table if not exists public.student_tutor_turns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 1200),
  answer text,
  model text,
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade
);

create index if not exists student_tutor_turns_student_idx
  on public.student_tutor_turns(workspace_id, student_id, created_at desc);
create index if not exists student_tutor_turns_rate_idx
  on public.student_tutor_turns(user_id, created_at desc);

alter table public.student_learning_plans enable row level security;
alter table public.student_learning_plan_steps enable row level security;
alter table public.student_tutor_turns enable row level security;

revoke all on public.student_learning_plans, public.student_learning_plan_steps, public.student_tutor_turns from anon, authenticated;

create or replace function private.refresh_student_learning_plan(
  target_workspace_id uuid,
  target_student_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_plan_id uuid;
  v_fingerprint text;
  v_position integer := 0;
  v_lesson_id uuid;
  v_intervention public.intervention_handoffs;
  v_mastery_updated timestamptz;
  v_curriculum_updated timestamptz;
  v_lesson_updated timestamptz;
  mastery_row record;
  curriculum_row record;
begin
  perform pg_advisory_xact_lock(hashtext(target_student_id::text)::bigint);

  if not exists (
    select 1
    from public.students s
    join public.workspaces w on w.id = s.workspace_id
    where s.id = target_student_id
      and s.workspace_id = target_workspace_id
      and s.active = true
      and w.workspace_type = 'school'
      and w.access_status = 'active'
  ) then
    raise exception 'Active student learning record not found.';
  end if;

  perform private.refresh_student_mastery(target_workspace_id, target_student_id);

  select ih.* into v_intervention
  from public.intervention_handoffs ih
  where ih.workspace_id = target_workspace_id
    and ih.student_id = target_student_id
    and ih.status = 'confirmed'
  order by coalesce(ih.confirmed_at, ih.updated_at) desc
  limit 1;

  select max(lm.updated_at) into v_mastery_updated
  from public.learner_mastery lm
  where lm.workspace_id = target_workspace_id
    and lm.student_id = target_student_id;

  select max(greatest(coalesce(ocl.verified_at, ocl.linked_at), cn.updated_at)) into v_curriculum_updated
  from public.objective_curriculum_links ocl
  join public.learning_objective_nodes lon on lon.id = ocl.learning_objective_node_id
  join public.curriculum_nodes cn on cn.id = ocl.curriculum_objective_node_id
  where lon.workspace_id = target_workspace_id
    and ocl.alignment_status = 'verified';

  select max(l.updated_at) into v_lesson_updated
  from public.lessons l
  join public.students s on s.id = target_student_id and s.workspace_id = target_workspace_id
  where l.workspace_id = target_workspace_id
    and l.class_id = s.class_id
    and l.status = 'validated';

  v_fingerprint := md5(concat_ws('|',
    target_workspace_id::text,
    target_student_id::text,
    coalesce(v_intervention.id::text, 'no-intervention'),
    coalesce(v_intervention.updated_at::text, 'no-intervention-update'),
    coalesce(v_mastery_updated::text, 'no-mastery'),
    coalesce(v_curriculum_updated::text, 'no-curriculum'),
    coalesce(v_lesson_updated::text, 'no-lesson')
  ));

  select slp.id into v_plan_id
  from public.student_learning_plans slp
  where slp.student_id = target_student_id
    and slp.workspace_id = target_workspace_id
    and slp.status = 'active'
    and slp.source_fingerprint = v_fingerprint
  limit 1;

  if found then
    return v_plan_id;
  end if;

  update public.student_learning_plans
  set status = 'superseded', updated_at = now()
  where workspace_id = target_workspace_id
    and student_id = target_student_id
    and status = 'active';

  insert into public.student_learning_plans(
    workspace_id, student_id, source_fingerprint, status, generated_for_user
  ) values (
    target_workspace_id, target_student_id, v_fingerprint, 'active', target_user_id
  )
  on conflict (student_id, source_fingerprint)
  do update set status = 'active', generated_for_user = excluded.generated_for_user, updated_at = now()
  returning id into v_plan_id;

  delete from public.student_learning_plan_steps where plan_id = v_plan_id;

  if v_intervention.id is not null then
    v_position := v_position + 1;
    insert into public.student_learning_plan_steps(
      plan_id, workspace_id, student_id, position, source_kind, lesson_id,
      title, action_text, why_text, success_signal
    ) values (
      v_plan_id,
      target_workspace_id,
      target_student_id,
      v_position,
      'intervention',
      v_intervention.next_lesson_id,
      coalesce(nullif(btrim(v_intervention.priority_growth_target), ''), 'Continue your current improvement plan'),
      coalesce(
        nullif(btrim(v_intervention.next_learning_adjustment), ''),
        nullif(btrim(v_intervention.success_indicator), ''),
        'Continue the agreed learning action and add fresh evidence.'
      ),
      'Your latest confirmed intervention remains the highest-priority KSI learning action.',
      nullif(btrim(v_intervention.success_indicator), '')
    );
  end if;

  for mastery_row in
    select
      lm.objective_node_id,
      lm.state,
      lm.mastery_percent,
      lm.confidence,
      lon.subject_id,
      lon.class_id,
      lon.topic,
      lon.objective_text,
      lon.objective_key,
      sub.name as subject_name
    from public.learner_mastery lm
    join public.learning_objective_nodes lon on lon.id = lm.objective_node_id
    join public.subjects sub on sub.id = lon.subject_id
    where lm.workspace_id = target_workspace_id
      and lm.student_id = target_student_id
      and lm.state <> 'mastered'
    order by
      case lm.state when 'intervention_required' then 1 when 'developing' then 2 else 3 end,
      case lm.confidence when 'high' then 1 when 'medium' then 2 else 3 end,
      lm.mastery_percent asc nulls last,
      lm.last_evidence_at desc nulls last
    limit 5
  loop
    exit when v_position >= 6;

    select l.id into v_lesson_id
    from public.lessons l
    where l.workspace_id = target_workspace_id
      and l.class_id = mastery_row.class_id
      and l.subject_id = mastery_row.subject_id
      and l.status = 'validated'
      and (
        private.normalise_learning_objective(l.objective) = mastery_row.objective_key
        or lower(l.topic) = lower(coalesce(mastery_row.topic, ''))
      )
    order by l.updated_at desc
    limit 1;

    v_position := v_position + 1;
    insert into public.student_learning_plan_steps(
      plan_id, workspace_id, student_id, position, source_kind, subject_id,
      objective_node_id, lesson_id, title, action_text, why_text, success_signal
    ) values (
      v_plan_id,
      target_workspace_id,
      target_student_id,
      v_position,
      'mastery',
      mastery_row.subject_id,
      mastery_row.objective_node_id,
      v_lesson_id,
      mastery_row.subject_name || ': ' || mastery_row.objective_text,
      case mastery_row.state
        when 'intervention_required' then 'Relearn this objective, work through a relevant example, then complete fresh practice before reassessment.'
        when 'developing' then 'Practise this objective again, explain your reasoning in your own words, and apply it to a new example.'
        else 'Complete more practice or reviewed work so KSI has enough evidence to judge this objective confidently.'
      end,
      case
        when mastery_row.mastery_percent is not null then
          'KSI selected this from your objective-level evidence. Current mastery is ' || trim(to_char(mastery_row.mastery_percent, '990D00')) || '% with ' || mastery_row.confidence || ' confidence.'
        else
          'KSI selected this because your current evidence is still limited and needs strengthening.'
      end,
      case mastery_row.state
        when 'intervention_required' then 'Fresh evidence shows the misconception has reduced and the objective is at least developing.'
        when 'developing' then 'Fresh evidence shows consistent correct reasoning across more than one task.'
        else 'KSI receives enough reviewed evidence to move beyond evidence-building.'
      end
    );
  end loop;

  for curriculum_row in
    select
      cn.id,
      cn.subject_name,
      cn.title,
      cn.objective_text,
      cn.source_reference,
      sub.id as subject_id
    from public.student_accounts sa
    join public.students st on st.id = sa.student_id and st.workspace_id = sa.workspace_id
    join public.classes c on c.id = st.class_id and c.workspace_id = st.workspace_id
    join public.workspace_curriculum_adoptions wca on wca.workspace_id = sa.workspace_id and wca.status = 'active'
    join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
    left join public.subjects sub on sub.workspace_id = sa.workspace_id and lower(sub.name) = lower(cn.subject_name)
    where sa.user_id = target_user_id
      and sa.student_id = target_student_id
      and sa.workspace_id = target_workspace_id
      and sa.active = true
      and upper(replace(coalesce(cn.class_level, ''), ' ', '')) = upper(replace(c.name, ' ', ''))
      and not exists (
        select 1
        from public.student_learning_plan_steps existing_step
        where existing_step.plan_id = v_plan_id
          and existing_step.curriculum_node_id = cn.id
      )
      and not exists (
        select 1
        from public.objective_curriculum_links ocl
        join public.learner_mastery lm on lm.objective_node_id = ocl.learning_objective_node_id
        where ocl.curriculum_objective_node_id = cn.id
          and ocl.alignment_status = 'verified'
          and lm.student_id = target_student_id
          and lm.state = 'mastered'
      )
    order by coalesce(cn.position, 999999), cn.subject_name, cn.title
    limit 2
  loop
    exit when v_position >= 6;
    v_position := v_position + 1;
    insert into public.student_learning_plan_steps(
      plan_id, workspace_id, student_id, position, source_kind, subject_id,
      curriculum_node_id, title, action_text, why_text, success_signal
    ) values (
      v_plan_id,
      target_workspace_id,
      target_student_id,
      v_position,
      'curriculum',
      curriculum_row.subject_id,
      curriculum_row.id,
      coalesce(curriculum_row.subject_name || ': ', '') || coalesce(curriculum_row.objective_text, curriculum_row.title),
      'Study this approved curriculum objective, use a validated class resource where available, then build evidence through practice or assessment.',
      'This objective comes from your school''s active, human-approved curriculum framework and is not yet evidenced as mastered.',
      'Complete a relevant learning activity and add reviewed evidence for this objective.'
    );
  end loop;

  if v_position = 0 then
    select l.id into v_lesson_id
    from public.lessons l
    join public.students s on s.id = target_student_id and s.workspace_id = target_workspace_id
    where l.workspace_id = target_workspace_id
      and l.class_id = s.class_id
      and l.status = 'validated'
    order by l.updated_at desc
    limit 1;

    insert into public.student_learning_plan_steps(
      plan_id, workspace_id, student_id, position, source_kind, lesson_id,
      title, action_text, why_text, success_signal
    ) values (
      v_plan_id,
      target_workspace_id,
      target_student_id,
      1,
      'baseline',
      v_lesson_id,
      'Build your next piece of learning evidence',
      'Open your learning library and complete your next validated lesson activity, reflection or assessment.',
      'KSI needs more governed learning evidence before it can make a more specific multi-step recommendation.',
      'A new reviewed learning or assessment record enters your KSI evidence.'
    );
  end if;

  return v_plan_id;
end;
$$;

revoke all on function private.refresh_student_learning_plan(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.get_my_personalized_learning_plan()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  account_row public.student_accounts;
  v_plan_id uuid;
  plan_json jsonb;
  steps_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.workspace_type = 'school'
    and w.access_status = 'active'
  limit 1;

  if not found then raise exception 'No active KSI student account is available.'; end if;

  v_plan_id := private.refresh_student_learning_plan(account_row.workspace_id, account_row.student_id, auth.uid());

  select jsonb_build_object(
    'id', p.id,
    'generated_at', p.generated_at,
    'updated_at', p.updated_at,
    'progress', jsonb_build_object(
      'total', count(s.id),
      'completed', count(s.id) filter (where s.status = 'completed'),
      'in_progress', count(s.id) filter (where s.status = 'in_progress'),
      'remaining', count(s.id) filter (where s.status in ('todo','in_progress')),
      'percent', case when count(s.id) > 0 then round((count(s.id) filter (where s.status = 'completed'))::numeric / count(s.id)::numeric * 100) else 0 end
    )
  ) into plan_json
  from public.student_learning_plans p
  left join public.student_learning_plan_steps s on s.plan_id = p.id
  where p.id = v_plan_id
  group by p.id, p.generated_at, p.updated_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'position', s.position,
    'source_kind', s.source_kind,
    'subject_id', s.subject_id,
    'subject', sub.name,
    'objective_node_id', s.objective_node_id,
    'curriculum_node_id', s.curriculum_node_id,
    'lesson_id', s.lesson_id,
    'lesson_title', l.title,
    'title', s.title,
    'action', s.action_text,
    'why', s.why_text,
    'success_signal', s.success_signal,
    'status', s.status,
    'completed_at', s.completed_at,
    'mastery_state', lm.state,
    'mastery_percent', lm.mastery_percent,
    'confidence', lm.confidence,
    'curriculum_source_reference', cn.source_reference
  ) order by s.position), '[]'::jsonb) into steps_json
  from public.student_learning_plan_steps s
  left join public.subjects sub on sub.id = s.subject_id
  left join public.lessons l on l.id = s.lesson_id
  left join public.learner_mastery lm on lm.student_id = s.student_id and lm.objective_node_id = s.objective_node_id
  left join public.curriculum_nodes cn on cn.id = s.curriculum_node_id
  where s.plan_id = v_plan_id;

  return jsonb_build_object(
    'student_id', account_row.student_id,
    'workspace_id', account_row.workspace_id,
    'plan', plan_json,
    'steps', steps_json
  );
end;
$$;

create or replace function public.update_my_learning_plan_step(
  target_step_id uuid,
  target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.student_accounts;
  step_row public.student_learning_plan_steps;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if target_status not in ('todo','in_progress','completed','skipped') then
    raise exception 'Invalid learning-plan step status.';
  end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.access_status = 'active'
  limit 1;
  if not found then raise exception 'No active KSI student account is available.'; end if;

  select s.* into step_row
  from public.student_learning_plan_steps s
  join public.student_learning_plans p on p.id = s.plan_id and p.status = 'active'
  where s.id = target_step_id
    and s.workspace_id = account_row.workspace_id
    and s.student_id = account_row.student_id
  for update;
  if not found then raise exception 'This learning-plan step is not available to this student.'; end if;

  update public.student_learning_plan_steps
  set status = target_status,
      completed_at = case when target_status = 'completed' then coalesce(completed_at, now()) else null end,
      updated_at = now()
  where id = target_step_id
  returning * into step_row;

  return jsonb_build_object(
    'step_id', step_row.id,
    'status', step_row.status,
    'completed_at', step_row.completed_at
  );
end;
$$;

create or replace function public.get_my_ask_ksi_context()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  account_row public.student_accounts;
  student_row public.students;
  class_name text;
  v_plan_id uuid;
  diagnosis_json jsonb;
  intervention_json jsonb;
  mastery_json jsonb;
  plan_json jsonb;
  resource_json jsonb;
  curriculum_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.workspace_type = 'school'
    and w.access_status = 'active'
  limit 1;
  if not found then raise exception 'No active KSI student account is available.'; end if;

  select s.* into student_row
  from public.students s
  where s.id = account_row.student_id
    and s.workspace_id = account_row.workspace_id
    and s.active = true;
  if not found then raise exception 'Student learning record is unavailable.'; end if;

  select c.name into class_name
  from public.classes c
  where c.id = student_row.class_id and c.workspace_id = student_row.workspace_id;

  v_plan_id := private.refresh_student_learning_plan(account_row.workspace_id, account_row.student_id, auth.uid());

  select jsonb_build_object(
    'concise_diagnosis', d.concise_diagnosis,
    'academic_strengths', coalesce(d.academic_strengths, '[]'::jsonb),
    'academic_challenges', coalesce(d.academic_challenges, '[]'::jsonb),
    'builder_growth_direction', d.builder_growth_direction,
    'encouragement_note', d.encouragement_note,
    'term', d.term,
    'academic_session', d.academic_session
  ) into diagnosis_json
  from public.diagnoses d
  where d.workspace_id = account_row.workspace_id
    and d.student_id = account_row.student_id
    and d.status = 'final'
  order by coalesce(d.finalised_at, d.updated_at) desc
  limit 1;

  select jsonb_build_object(
    'priority_growth_target', ih.priority_growth_target,
    'timeframe', ih.timeframe,
    'success_indicator', ih.success_indicator,
    'next_learning_adjustment', ih.next_learning_adjustment,
    'review_date', ih.review_date
  ) into intervention_json
  from public.intervention_handoffs ih
  where ih.workspace_id = account_row.workspace_id
    and ih.student_id = account_row.student_id
    and ih.status = 'confirmed'
  order by coalesce(ih.confirmed_at, ih.updated_at) desc
  limit 1;

  select coalesce(jsonb_agg(row_json order by priority_order, mastery_percent asc nulls last), '[]'::jsonb)
  into mastery_json
  from (
    select jsonb_build_object(
      'subject', sub.name,
      'topic', lon.topic,
      'objective', lon.objective_text,
      'state', lm.state,
      'mastery_percent', lm.mastery_percent,
      'confidence', lm.confidence,
      'item_evidence_count', lm.item_evidence_count,
      'qualitative_evidence_count', lm.qualitative_evidence_count
    ) row_json,
    case lm.state when 'intervention_required' then 1 when 'developing' then 2 when 'evidence_building' then 3 else 4 end priority_order,
    lm.mastery_percent
    from public.learner_mastery lm
    join public.learning_objective_nodes lon on lon.id = lm.objective_node_id
    join public.subjects sub on sub.id = lon.subject_id
    where lm.workspace_id = account_row.workspace_id
      and lm.student_id = account_row.student_id
    order by priority_order, lm.mastery_percent asc nulls last
    limit 10
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', s.position,
    'title', s.title,
    'action', s.action_text,
    'why', s.why_text,
    'success_signal', s.success_signal,
    'status', s.status,
    'source_kind', s.source_kind,
    'lesson_id', s.lesson_id
  ) order by s.position), '[]'::jsonb)
  into plan_json
  from public.student_learning_plan_steps s
  where s.plan_id = v_plan_id;

  select coalesce(jsonb_agg(row_json order by updated_at desc), '[]'::jsonb)
  into resource_json
  from (
    select jsonb_build_object(
      'lesson_id', l.id,
      'title', l.title,
      'subject', sub.name,
      'topic', l.topic,
      'objective', l.objective,
      'explanation', left(coalesce(full_light.content->>'teachingContent', ''), 2200),
      'practice', left(coalesce(second_trial.content->>'experience', ''), 1400)
    ) row_json,
    l.updated_at
    from public.lessons l
    left join public.subjects sub on sub.id = l.subject_id
    left join public.lesson_stages full_light on full_light.lesson_id = l.id and full_light.stage_key = 'full_illumination'
    left join public.lesson_stages second_trial on second_trial.lesson_id = l.id and second_trial.stage_key = 'trial_second'
    where l.workspace_id = account_row.workspace_id
      and l.class_id = student_row.class_id
      and l.status = 'validated'
    order by l.updated_at desc
    limit 8
  ) r;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', cn.subject_name,
    'term', cn.term,
    'title', cn.title,
    'objective', cn.objective_text,
    'source_reference', cn.source_reference
  ) order by cn.subject_name, coalesce(cn.position, 999999)), '[]'::jsonb)
  into curriculum_json
  from public.workspace_curriculum_adoptions wca
  join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type in ('topic','objective')
  where wca.workspace_id = account_row.workspace_id
    and wca.status = 'active'
    and upper(replace(coalesce(cn.class_level, ''), ' ', '')) = upper(replace(coalesce(class_name, ''), ' ', ''));

  return jsonb_build_object(
    'student', jsonb_build_object('id', student_row.id, 'name', student_row.display_name, 'class_name', class_name),
    'diagnosis', diagnosis_json,
    'intervention', intervention_json,
    'mastery', mastery_json,
    'learning_plan', plan_json,
    'validated_learning_resources', resource_json,
    'approved_curriculum', curriculum_json,
    'boundary', jsonb_build_object(
      'authoritative_states', jsonb_build_array('diagnosis','intervention','mastery'),
      'tutor_may_change_authoritative_state', false,
      'teacher_private_notes_included', false
    )
  );
end;
$$;

create or replace function public.begin_my_ask_ksi_turn(target_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.student_accounts;
  cleaned_question text := nullif(btrim(coalesce(target_question, '')), '');
  v_turn_id uuid;
  recent_minute integer;
  recent_hour integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if cleaned_question is null then raise exception 'Ask KSI needs a learning question.'; end if;
  if char_length(cleaned_question) > 1200 then raise exception 'Keep your Ask KSI question under 1,200 characters.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.access_status = 'active'
  limit 1;
  if not found then raise exception 'No active KSI student account is available.'; end if;

  select count(*)::int into recent_minute
  from public.student_tutor_turns t
  where t.user_id = auth.uid() and t.created_at >= now() - interval '1 minute';
  select count(*)::int into recent_hour
  from public.student_tutor_turns t
  where t.user_id = auth.uid() and t.created_at >= now() - interval '1 hour';

  if recent_minute >= 4 then raise exception 'Ask KSI is receiving questions too quickly. Wait about a minute and try again.'; end if;
  if recent_hour >= 30 then raise exception 'Ask KSI hourly learning limit reached. Continue with your plan and try again later.'; end if;

  insert into public.student_tutor_turns(workspace_id, student_id, user_id, question)
  values (account_row.workspace_id, account_row.student_id, auth.uid(), cleaned_question)
  returning id into v_turn_id;

  return v_turn_id;
end;
$$;

create or replace function public.complete_my_ask_ksi_turn(
  target_turn_id uuid,
  target_answer text,
  target_model text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_answer text := nullif(btrim(coalesce(target_answer, '')), '');
  turn_row public.student_tutor_turns;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if cleaned_answer is null then raise exception 'Ask KSI answer is required.'; end if;

  select * into turn_row
  from public.student_tutor_turns
  where id = target_turn_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Ask KSI turn not found.'; end if;
  if turn_row.status <> 'pending' then raise exception 'This Ask KSI turn is already closed.'; end if;

  update public.student_tutor_turns
  set answer = cleaned_answer,
      model = nullif(btrim(coalesce(target_model, '')), ''),
      status = 'complete',
      error_message = null,
      completed_at = now()
  where id = target_turn_id;

  return jsonb_build_object('turn_id', target_turn_id, 'status', 'complete');
end;
$$;

create or replace function public.fail_my_ask_ksi_turn(
  target_turn_id uuid,
  target_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.student_tutor_turns
  set status = 'failed',
      error_message = left(nullif(btrim(coalesce(target_error_message, '')), ''), 500),
      completed_at = now()
  where id = target_turn_id
    and user_id = auth.uid()
    and status = 'pending';
end;
$$;

create or replace function public.get_my_ask_ksi_history(target_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_row public.student_accounts;
  history_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if target_limit < 1 or target_limit > 30 then raise exception 'History limit must be between 1 and 30.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.access_status = 'active'
  limit 1;
  if not found then raise exception 'No active KSI student account is available.'; end if;

  select coalesce(jsonb_agg(row_json order by created_at asc), '[]'::jsonb)
  into history_json
  from (
    select jsonb_build_object(
      'id', t.id,
      'question', t.question,
      'answer', t.answer,
      'model', t.model,
      'created_at', t.created_at,
      'completed_at', t.completed_at
    ) row_json,
    t.created_at
    from public.student_tutor_turns t
    where t.workspace_id = account_row.workspace_id
      and t.student_id = account_row.student_id
      and t.user_id = auth.uid()
      and t.status = 'complete'
    order by t.created_at desc
    limit target_limit
  ) q;

  return jsonb_build_object('student_id', account_row.student_id, 'turns', history_json);
end;
$$;

revoke all on function public.get_my_personalized_learning_plan() from public, anon;
revoke all on function public.update_my_learning_plan_step(uuid, text) from public, anon;
revoke all on function public.get_my_ask_ksi_context() from public, anon;
revoke all on function public.begin_my_ask_ksi_turn(text) from public, anon;
revoke all on function public.complete_my_ask_ksi_turn(uuid, text, text) from public, anon;
revoke all on function public.fail_my_ask_ksi_turn(uuid, text) from public, anon;
revoke all on function public.get_my_ask_ksi_history(integer) from public, anon;

grant execute on function public.get_my_personalized_learning_plan() to authenticated;
grant execute on function public.update_my_learning_plan_step(uuid, text) to authenticated;
grant execute on function public.get_my_ask_ksi_context() to authenticated;
grant execute on function public.begin_my_ask_ksi_turn(text) to authenticated;
grant execute on function public.complete_my_ask_ksi_turn(uuid, text, text) to authenticated;
grant execute on function public.fail_my_ask_ksi_turn(uuid, text) to authenticated;
grant execute on function public.get_my_ask_ksi_history(integer) to authenticated;