alter table public.student_lesson_work
  add column if not exists evidence_id uuid references public.student_evidence(id) on delete set null;

create unique index if not exists student_lesson_work_evidence_unique_idx
  on public.student_lesson_work(evidence_id)
  where evidence_id is not null;

create index if not exists student_lesson_work_evidence_idx
  on public.student_lesson_work(evidence_id)
  where evidence_id is not null;

create or replace function public.review_student_lesson_work(target_work_id uuid, feedback_text text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  caller_id uuid := auth.uid();
  work_row public.student_lesson_work;
  caller_role text;
  cleaned_feedback text := nullif(btrim(coalesce(feedback_text,'')), '');
  v_evidence_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if cleaned_feedback is null then raise exception 'Feedback is required before marking work reviewed.'; end if;

  select * into work_row from public.student_lesson_work where id = target_work_id;
  if not found then raise exception 'Student lesson work not found.'; end if;
  if work_row.status not in ('submitted','reviewed') then
    raise exception 'The student must submit lesson work before it can be reviewed.';
  end if;

  select wm.role into caller_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = work_row.workspace_id
    and wm.user_id = caller_id
    and wm.status = 'active'
    and w.access_status = 'active';

  if caller_role is null
     or (caller_role = 'teacher' and work_row.teacher_id <> caller_id)
     or caller_role not in ('owner','admin','teacher') then
    raise exception 'You are not authorised to review this student lesson work.';
  end if;

  if work_row.evidence_id is null then
    insert into public.student_evidence(
      workspace_id,
      student_id,
      assessment_id,
      assessment_item_id,
      evidence_type,
      numeric_value,
      content,
      recorded_by,
      recorded_at
    ) values (
      work_row.workspace_id,
      work_row.student_id,
      null,
      null,
      'reflection',
      null,
      jsonb_build_object(
        'source', 'hqls_lesson_work',
        'student_lesson_work_id', work_row.id,
        'delivery_id', work_row.delivery_id,
        'lesson_id', work_row.lesson_id,
        'class_id', work_row.class_id,
        'subject_id', work_row.subject_id,
        'teacher_id', work_row.teacher_id,
        'reflection_response', coalesce(work_row.reflection_response, ''),
        'real_life_assignment_response', coalesce(work_row.assignment_response, ''),
        'teacher_feedback', cleaned_feedback,
        'review_status', 'reviewed'
      ),
      caller_id,
      now()
    ) returning id into v_evidence_id;
  else
    v_evidence_id := work_row.evidence_id;
    update public.student_evidence
    set content = jsonb_build_object(
          'source', 'hqls_lesson_work',
          'student_lesson_work_id', work_row.id,
          'delivery_id', work_row.delivery_id,
          'lesson_id', work_row.lesson_id,
          'class_id', work_row.class_id,
          'subject_id', work_row.subject_id,
          'teacher_id', work_row.teacher_id,
          'reflection_response', coalesce(work_row.reflection_response, ''),
          'real_life_assignment_response', coalesce(work_row.assignment_response, ''),
          'teacher_feedback', cleaned_feedback,
          'review_status', 'reviewed'
        ),
        numeric_value = null,
        recorded_by = caller_id,
        recorded_at = now(),
        updated_at = now()
    where id = v_evidence_id
      and workspace_id = work_row.workspace_id
      and student_id = work_row.student_id
      and evidence_type = 'reflection';
  end if;

  update public.student_lesson_work
  set teacher_feedback = cleaned_feedback,
      status = 'reviewed',
      reviewed_at = now(),
      reviewed_by = caller_id,
      evidence_id = v_evidence_id,
      updated_at = now()
  where id = target_work_id;

  return jsonb_build_object(
    'work_id', target_work_id,
    'status', 'reviewed',
    'teacher_feedback', cleaned_feedback,
    'evidence_id', v_evidence_id,
    'reviewed_at', now(),
    'reviewed_by', caller_id
  );
end;
$$;

revoke execute on function public.review_student_lesson_work(uuid,text) from public, anon;
grant execute on function public.review_student_lesson_work(uuid,text) to authenticated;
