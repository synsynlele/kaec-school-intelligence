-- KSI 2.0 Stage 11 — leadership-safe aggregate mastery intelligence.

create or replace function public.get_leadership_mastery_intelligence(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public','private'
as $$
declare
  summary_json jsonb;
  class_json jsonb;
  subject_json jsonb;
  priorities_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id,array['owner','admin','leader']) then
    raise exception 'Leadership KSI permission required.';
  end if;
  if not exists(select 1 from public.workspaces w where w.id=target_workspace_id and w.workspace_type='school' and w.access_status='active') then
    raise exception 'Active school workspace not found.';
  end if;

  select jsonb_build_object(
    'students_with_graph',count(distinct lm.student_id),
    'objectives_tracked',count(*),
    'mastered',count(*) filter(where lm.state='mastered'),
    'developing',count(*) filter(where lm.state='developing'),
    'intervention_required',count(*) filter(where lm.state='intervention_required'),
    'evidence_building',count(*) filter(where lm.state='evidence_building'),
    'medium_or_high_confidence',count(*) filter(where lm.confidence in ('medium','high'))
  ) into summary_json
  from public.learner_mastery lm
  where lm.workspace_id=target_workspace_id;

  select coalesce(jsonb_agg(row_json order by row_json->>'class_name'),'[]'::jsonb) into class_json
  from (
    select jsonb_build_object(
      'class_id',c.id,'class_name',c.name,
      'students_with_graph',count(distinct lm.student_id),
      'objectives_tracked',count(lm.id),
      'mastered',count(lm.id) filter(where lm.state='mastered'),
      'developing',count(lm.id) filter(where lm.state='developing'),
      'intervention_required',count(lm.id) filter(where lm.state='intervention_required'),
      'evidence_building',count(lm.id) filter(where lm.state='evidence_building'),
      'medium_or_high_confidence',count(lm.id) filter(where lm.confidence in ('medium','high'))
    ) row_json
    from public.classes c
    left join public.learning_objective_nodes n on n.workspace_id=c.workspace_id and n.class_id=c.id
    left join public.learner_mastery lm on lm.objective_node_id=n.id and lm.workspace_id=c.workspace_id
    where c.workspace_id=target_workspace_id and c.active=true
    group by c.id,c.name
  ) q;

  select coalesce(jsonb_agg(row_json order by row_json->>'subject_name'),'[]'::jsonb) into subject_json
  from (
    select jsonb_build_object(
      'subject_id',sub.id,'subject_name',sub.name,
      'students_with_graph',count(distinct lm.student_id),
      'objectives_tracked',count(lm.id),
      'mastered',count(lm.id) filter(where lm.state='mastered'),
      'developing',count(lm.id) filter(where lm.state='developing'),
      'intervention_required',count(lm.id) filter(where lm.state='intervention_required'),
      'evidence_building',count(lm.id) filter(where lm.state='evidence_building'),
      'medium_or_high_confidence',count(lm.id) filter(where lm.confidence in ('medium','high'))
    ) row_json
    from public.subjects sub
    left join public.learning_objective_nodes n on n.workspace_id=sub.workspace_id and n.subject_id=sub.id
    left join public.learner_mastery lm on lm.objective_node_id=n.id and lm.workspace_id=sub.workspace_id
    where sub.workspace_id=target_workspace_id and sub.active=true
    group by sub.id,sub.name
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'objective_id',n.id,'subject_name',sub.name,'class_name',c.name,'topic',n.topic,'objective',n.objective_text,
    'learners_affected',p.learners_affected,'average_mastery_percent',p.avg_pct,
    'confidence_basis','Only medium/high-confidence learner states are counted.'
  ) order by p.learners_affected desc,p.avg_pct asc nulls last),'[]'::jsonb)
  into priorities_json
  from (
    select lm.objective_node_id,count(distinct lm.student_id)::int learners_affected,round(avg(lm.mastery_percent),2) avg_pct
    from public.learner_mastery lm
    where lm.workspace_id=target_workspace_id and lm.state='intervention_required' and lm.confidence in ('medium','high')
    group by lm.objective_node_id
    order by count(distinct lm.student_id) desc,avg(lm.mastery_percent) asc nulls last
    limit 20
  ) p
  join public.learning_objective_nodes n on n.id=p.objective_node_id
  join public.subjects sub on sub.id=n.subject_id
  join public.classes c on c.id=n.class_id;

  return jsonb_build_object('summary',summary_json,'class_mastery',class_json,'subject_mastery',subject_json,'priority_objectives',priorities_json);
end;
$$;

revoke execute on function public.get_leadership_mastery_intelligence(uuid) from public,anon;
grant execute on function public.get_leadership_mastery_intelligence(uuid) to authenticated;

comment on function public.get_leadership_mastery_intelligence(uuid) is
  'Leadership aggregate for KSI objective mastery. Priority objectives exclude low-confidence learner states so sparse evidence is not escalated as a mastery verdict.';
