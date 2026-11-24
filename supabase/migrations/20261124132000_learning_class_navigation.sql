create function public.list_learning_objective_exams(school_id uuid, search_text text, page_offset integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc, row_data.id), '[]'::jsonb)
  from (
    select a.id, a.title, a.status, a.class_id, c.name as class_name, a.updated_at,
      coalesce(b.cbt_enabled, false) as assigned, b.opens_at, b.closes_at, r.action as review_status,
      s.name as subject_name, progress.learners, progress.marked
    from public.assessments a
    join public.workspaces w on w.id = a.workspace_id
    left join public.classes c on c.id = a.class_id and c.workspace_id = a.workspace_id
    left join public.subjects s on s.id = a.subject_id and s.workspace_id = a.workspace_id
    left join private.learning_cbts b on b.assessment_id = a.id
    left join lateral (
      select action from private.learning_result_reviews where cbt_id = b.id order by revision desc limit 1
    ) r on true
    left join lateral (
      select count(*) as learners, count(*) filter (where
        case when coalesce((b.section_maxima->>'subjective')::numeric,0)
                + coalesce((b.section_maxima->>'critical_thinking')::numeric,0)
                + coalesce((b.section_maxima->>'project')::numeric,0) > 0
          then (coalesce((b.section_maxima->>'subjective')::numeric,0) = 0 or p.subjective is not null or 'subjective' = any(p.excused))
            and (coalesce((b.section_maxima->>'critical_thinking')::numeric,0) = 0 or p.critical_thinking is not null or 'critical_thinking' = any(p.excused))
            and (coalesce((b.section_maxima->>'project')::numeric,0) = 0 or p.project is not null or 'project' = any(p.excused))
          else sub.student_id is not null or 'objective' = any(p.excused)
        end) as marked
      from public.students l
      left join private.learning_paper_scores p on p.cbt_id = b.id and p.student_id = l.id
      left join private.learning_cbt_submissions sub on sub.cbt_id = b.id and sub.student_id = l.id
      where l.workspace_id = a.workspace_id and l.class_id = a.class_id and l.active
    ) progress on true
    where a.workspace_id = school_id and w.workspace_type = 'school' and w.access_status = 'active'
      and a.status <> 'archived'
      and case when coalesce(b.cbt_enabled, false) then
        exists(select from jsonb_array_elements(b.questions))
        and not exists(select from jsonb_array_elements(b.questions) q where q->>'type' is distinct from 'objective')
      else
        exists(select from public.assessment_items i where i.assessment_id=a.id)
        and not exists(select from public.assessment_items i where i.assessment_id=a.id and i.item_type::text is distinct from 'objective')
      end
      and private.has_workspace_role(a.workspace_id, array['owner','admin','leader','teacher'])
      and private.can_view_teacher_artifact(a.workspace_id, 'assessment', a.id)
      and (coalesce(search_text, '') = '' or strpos(lower(a.title), lower(search_text)) > 0
        or strpos(lower(c.name), lower(search_text)) > 0 or strpos(lower(s.name), lower(search_text)) > 0)
    order by a.updated_at desc, a.id
    limit 21 offset greatest(coalesce(page_offset, 0), 0)
  ) row_data;
$$;

revoke all on function public.list_learning_objective_exams(uuid,text,integer) from public,anon;
grant execute on function public.list_learning_objective_exams(uuid,text,integer) to authenticated;

create function public.assign_learning_class_subjects(target_workspace_id uuid,target_class_id uuid,target_teacher_id uuid,target_subject_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare subject_id uuid;
begin
  if coalesce(cardinality(target_subject_ids),0) not between 1 and 100 then
    raise exception 'Choose between 1 and 100 subjects.';
  end if;
  for subject_id in select distinct id from unnest(target_subject_ids) ids(id) order by id loop
    perform public.set_teaching_assignment(target_workspace_id,target_class_id,subject_id,target_teacher_id,true);
  end loop;
end $$;
revoke all on function public.assign_learning_class_subjects(uuid,uuid,uuid,uuid[]) from public,anon;
grant execute on function public.assign_learning_class_subjects(uuid,uuid,uuid,uuid[]) to authenticated;
