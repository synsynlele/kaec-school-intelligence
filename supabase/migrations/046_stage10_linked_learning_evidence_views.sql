create or replace function public.get_my_reviewed_lesson_evidence()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  account_row public.student_accounts;
  evidence_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid()
    and sa.active = true
    and w.access_status = 'active'
  limit 1;

  if not found then raise exception 'No active KSI student account is available.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'evidence_id', se.id,
    'lesson_id', slw.lesson_id,
    'lesson_title', l.title,
    'subject_name', coalesce(sub.name, 'Learning'),
    'teacher_name', coalesce(p.display_name, 'Teacher'),
    'reflection_response', coalesce(slw.reflection_response, ''),
    'assignment_response', coalesce(slw.assignment_response, ''),
    'teacher_feedback', coalesce(slw.teacher_feedback, ''),
    'reviewed_at', slw.reviewed_at
  ) order by slw.reviewed_at desc nulls last), '[]'::jsonb)
  into evidence_json
  from public.student_lesson_work slw
  join public.student_evidence se on se.id = slw.evidence_id
  join public.lessons l on l.id = slw.lesson_id and l.workspace_id = slw.workspace_id
  left join public.subjects sub on sub.id = slw.subject_id and sub.workspace_id = slw.workspace_id
  left join public.profiles p on p.id = slw.teacher_id
  where slw.workspace_id = account_row.workspace_id
    and slw.student_id = account_row.student_id
    and slw.status = 'reviewed'
    and se.evidence_type = 'reflection'
    and se.numeric_value is null
    and se.content->>'source' = 'hqls_lesson_work';

  return jsonb_build_object(
    'student_id', account_row.student_id,
    'reviewed_count', jsonb_array_length(evidence_json),
    'evidence', evidence_json
  );
end;
$$;

revoke execute on function public.get_my_reviewed_lesson_evidence() from public, anon;
grant execute on function public.get_my_reviewed_lesson_evidence() to authenticated;

create or replace function public.get_leadership_delivery_intelligence(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  total_deliveries integer;
  total_assigned integer;
  total_submitted integer;
  total_reviewed integer;
  class_data jsonb;
  subject_data jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id, array['owner','admin','leader']) then
    raise exception 'Leadership KSI permission required.';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.workspace_type='school' and w.access_status='active'
  ) then raise exception 'Active school workspace not found.'; end if;

  select count(*)::int into total_deliveries
  from public.lesson_deliveries d where d.workspace_id = target_workspace_id;

  select count(*)::int,
         count(*) filter (where slw.status in ('submitted','reviewed'))::int,
         count(*) filter (where slw.status = 'reviewed')::int
  into total_assigned, total_submitted, total_reviewed
  from public.student_lesson_work slw
  where slw.workspace_id = target_workspace_id;

  select coalesce(jsonb_agg(row_data order by row_data->>'class_name'), '[]'::jsonb)
  into class_data
  from (
    select jsonb_build_object(
      'class_id', c.id,
      'class_name', c.name,
      'deliveries', count(distinct d.id),
      'assigned', count(slw.id),
      'submitted', count(slw.id) filter (where slw.status in ('submitted','reviewed')),
      'reviewed', count(slw.id) filter (where slw.status='reviewed'),
      'submission_percent', case when count(slw.id)>0 then round((count(slw.id) filter (where slw.status in ('submitted','reviewed')))::numeric / count(slw.id)::numeric * 100) else 0 end,
      'review_percent', case when count(slw.id)>0 then round((count(slw.id) filter (where slw.status='reviewed'))::numeric / count(slw.id)::numeric * 100) else 0 end
    ) as row_data
    from public.classes c
    left join public.lesson_deliveries d on d.class_id=c.id and d.workspace_id=c.workspace_id
    left join public.student_lesson_work slw on slw.delivery_id=d.id and slw.workspace_id=c.workspace_id
    where c.workspace_id=target_workspace_id and c.active=true
    group by c.id,c.name
  ) q;

  select coalesce(jsonb_agg(row_data order by row_data->>'subject_name'), '[]'::jsonb)
  into subject_data
  from (
    select jsonb_build_object(
      'subject_id', s.id,
      'subject_name', s.name,
      'deliveries', count(distinct d.id),
      'assigned', count(slw.id),
      'submitted', count(slw.id) filter (where slw.status in ('submitted','reviewed')),
      'reviewed', count(slw.id) filter (where slw.status='reviewed'),
      'submission_percent', case when count(slw.id)>0 then round((count(slw.id) filter (where slw.status in ('submitted','reviewed')))::numeric / count(slw.id)::numeric * 100) else 0 end,
      'review_percent', case when count(slw.id)>0 then round((count(slw.id) filter (where slw.status='reviewed'))::numeric / count(slw.id)::numeric * 100) else 0 end
    ) as row_data
    from public.subjects s
    left join public.lesson_deliveries d on d.subject_id=s.id and d.workspace_id=s.workspace_id
    left join public.student_lesson_work slw on slw.delivery_id=d.id and slw.workspace_id=s.workspace_id
    where s.workspace_id=target_workspace_id and s.active=true
    group by s.id,s.name
  ) q;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'deliveries', total_deliveries,
      'assigned', total_assigned,
      'submitted', total_submitted,
      'reviewed', total_reviewed,
      'submission_percent', case when total_assigned>0 then round(total_submitted::numeric/total_assigned::numeric*100) else 0 end,
      'review_percent', case when total_assigned>0 then round(total_reviewed::numeric/total_assigned::numeric*100) else 0 end
    ),
    'class_delivery_health', class_data,
    'subject_delivery_health', subject_data
  );
end;
$$;

revoke execute on function public.get_leadership_delivery_intelligence(uuid) from public, anon;
grant execute on function public.get_leadership_delivery_intelligence(uuid) to authenticated;
