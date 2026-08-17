-- KSI 2.0 acceptance integrity fix.
--
-- The mastery refresh joins objective nodes through class/subject assessments before
-- matching qualitative HQLS reflection evidence. A single reflection can therefore
-- appear more than once in the joined rowset when several assessments exist for the
-- same class/subject. Evidence confidence must be based on distinct evidence records,
-- never join multiplicity.

create or replace function private.refresh_student_mastery(target_workspace_id uuid, target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public','private'
as $$
begin
  insert into public.learning_objective_nodes(workspace_id,class_id,subject_id,topic,objective_text,objective_key,source_kind)
  select distinct a.workspace_id,a.class_id,a.subject_id,nullif(btrim(ai.topic),''),btrim(ai.objective),private.normalise_learning_objective(ai.objective),'ksi'
  from public.student_evidence se
  join public.assessment_items ai on ai.id=se.assessment_item_id
  join public.assessments a on a.id=se.assessment_id
  where se.workspace_id=target_workspace_id and se.student_id=target_student_id and se.evidence_type='item_result'
    and a.class_id is not null and a.subject_id is not null and nullif(btrim(ai.objective),'') is not null
  on conflict (workspace_id,class_id,subject_id,objective_key)
  do update set topic=coalesce(excluded.topic,public.learning_objective_nodes.topic),objective_text=excluded.objective_text,updated_at=now();

  insert into public.learning_objective_nodes(workspace_id,class_id,subject_id,topic,objective_text,objective_key,source_kind)
  select distinct l.workspace_id,l.class_id,l.subject_id,nullif(btrim(l.topic),''),btrim(l.objective),private.normalise_learning_objective(l.objective),'ksi'
  from public.student_evidence se
  join public.lessons l on l.id=nullif(se.content->>'lesson_id','')::uuid
  where se.workspace_id=target_workspace_id and se.student_id=target_student_id and se.evidence_type='reflection'
    and se.content->>'source'='hqls_lesson_work' and l.class_id is not null and l.subject_id is not null
    and nullif(btrim(l.objective),'') is not null
  on conflict (workspace_id,class_id,subject_id,objective_key)
  do update set topic=coalesce(excluded.topic,public.learning_objective_nodes.topic),objective_text=excluded.objective_text,updated_at=now();

  with aggregate_evidence as (
    select n.id objective_node_id,n.workspace_id,target_student_id student_id,
      count(distinct se.id) filter(where se.evidence_type='item_result')::int item_count,
      count(distinct se.id) filter(where se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work')::int qualitative_count,
      case when sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0)>0
        then round(least(100::numeric,greatest(0::numeric,
          (sum(se.numeric_value) filter(where se.evidence_type='item_result') /
           sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0))*100)),2)
        else null end pct,
      max(se.recorded_at) last_evidence_at
    from public.learning_objective_nodes n
    left join public.assessments a on a.workspace_id=n.workspace_id and a.class_id=n.class_id and a.subject_id=n.subject_id
    left join public.assessment_items ai on ai.assessment_id=a.id and private.normalise_learning_objective(ai.objective)=n.objective_key
    left join public.student_evidence se on se.workspace_id=n.workspace_id and se.student_id=target_student_id and (
      (se.evidence_type='item_result' and se.assessment_item_id=ai.id)
      or (se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work' and exists(
        select 1 from public.lessons l where l.id=nullif(se.content->>'lesson_id','')::uuid and l.workspace_id=n.workspace_id
          and l.class_id=n.class_id and l.subject_id=n.subject_id and private.normalise_learning_objective(l.objective)=n.objective_key)))
    where n.workspace_id=target_workspace_id and exists(
      select 1 from public.students s where s.id=target_student_id and s.workspace_id=target_workspace_id and s.class_id=n.class_id)
    group by n.id,n.workspace_id
  ), derived as (
    select *,case
      when item_count>=2 and pct>=80 then 'mastered'
      when item_count>=2 and pct>=50 then 'developing'
      when item_count>=2 then 'intervention_required'
      when item_count=0 and qualitative_count>=2 then 'developing'
      else 'evidence_building' end derived_state,
      case when item_count>=4 then 'high' when item_count>=2 or qualitative_count>=2 then 'medium' else 'low' end derived_confidence
    from aggregate_evidence where item_count>0 or qualitative_count>0
  )
  insert into public.mastery_events(workspace_id,student_id,objective_node_id,previous_state,new_state,previous_mastery_percent,new_mastery_percent,item_evidence_count,qualitative_evidence_count,confidence,changed_at)
  select d.workspace_id,d.student_id,d.objective_node_id,lm.state,d.derived_state,lm.mastery_percent,d.pct,d.item_count,d.qualitative_count,d.derived_confidence,now()
  from derived d left join public.learner_mastery lm on lm.student_id=d.student_id and lm.objective_node_id=d.objective_node_id
  where lm.id is null or lm.state is distinct from d.derived_state or lm.mastery_percent is distinct from d.pct;

  with aggregate_evidence as (
    select n.id objective_node_id,n.workspace_id,target_student_id student_id,
      count(distinct se.id) filter(where se.evidence_type='item_result')::int item_count,
      count(distinct se.id) filter(where se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work')::int qualitative_count,
      case when sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0)>0
        then round(least(100::numeric,greatest(0::numeric,
          (sum(se.numeric_value) filter(where se.evidence_type='item_result') /
           sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0))*100)),2)
        else null end pct,
      max(se.recorded_at) last_evidence_at
    from public.learning_objective_nodes n
    left join public.assessments a on a.workspace_id=n.workspace_id and a.class_id=n.class_id and a.subject_id=n.subject_id
    left join public.assessment_items ai on ai.assessment_id=a.id and private.normalise_learning_objective(ai.objective)=n.objective_key
    left join public.student_evidence se on se.workspace_id=n.workspace_id and se.student_id=target_student_id and (
      (se.evidence_type='item_result' and se.assessment_item_id=ai.id)
      or (se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work' and exists(
        select 1 from public.lessons l where l.id=nullif(se.content->>'lesson_id','')::uuid and l.workspace_id=n.workspace_id
          and l.class_id=n.class_id and l.subject_id=n.subject_id and private.normalise_learning_objective(l.objective)=n.objective_key)))
    where n.workspace_id=target_workspace_id and exists(
      select 1 from public.students s where s.id=target_student_id and s.workspace_id=target_workspace_id and s.class_id=n.class_id)
    group by n.id,n.workspace_id
  ), derived as (
    select *,case
      when item_count>=2 and pct>=80 then 'mastered'
      when item_count>=2 and pct>=50 then 'developing'
      when item_count>=2 then 'intervention_required'
      when item_count=0 and qualitative_count>=2 then 'developing'
      else 'evidence_building' end derived_state,
      case when item_count>=4 then 'high' when item_count>=2 or qualitative_count>=2 then 'medium' else 'low' end derived_confidence
    from aggregate_evidence where item_count>0 or qualitative_count>0
  )
  insert into public.learner_mastery(workspace_id,student_id,objective_node_id,state,mastery_percent,item_evidence_count,qualitative_evidence_count,confidence,last_evidence_at)
  select workspace_id,student_id,objective_node_id,derived_state,pct,item_count,qualitative_count,derived_confidence,last_evidence_at from derived
  on conflict(student_id,objective_node_id) do update set state=excluded.state,mastery_percent=excluded.mastery_percent,item_evidence_count=excluded.item_evidence_count,
    qualitative_evidence_count=excluded.qualitative_evidence_count,confidence=excluded.confidence,last_evidence_at=excluded.last_evidence_at,updated_at=now();
end;
$$;

revoke all on function private.refresh_student_mastery(uuid,uuid) from public,anon,authenticated;
