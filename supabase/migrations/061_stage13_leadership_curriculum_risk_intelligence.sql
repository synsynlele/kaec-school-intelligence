-- KSI 2.0 Stage 13 — Leadership curriculum coverage + learning-risk intelligence.
-- Signals remain learning-focused, evidence-based and aggregate; they do not rank human worth.

create or replace function public.get_leadership_curriculum_risk_intelligence(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  canonical_objectives integer;
  published_resources integer;
  verified_curriculum_links integer;
  adopted_frameworks integer;
  active_students integer;
  diagnosis_without_intervention integer;
  mastery_intervention_students integer;
  evidence_thin_students integer;
  overdue_intervention_students integer;
  stale_evidence_students integer;
  plan_not_started_students integer;
  class_coverage jsonb;
  subject_coverage jsonb;
  risk_signals jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id, array['owner','admin','leader']) then
    raise exception 'Leadership KSI permission required.';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.workspace_type = 'school' and w.access_status = 'active'
  ) then raise exception 'Active school workspace not found.'; end if;

  select count(*)::int into adopted_frameworks
  from public.workspace_curriculum_adoptions wca
  where wca.workspace_id = target_workspace_id and wca.status = 'active';

  select count(distinct cn.id)::int into canonical_objectives
  from public.workspace_curriculum_adoptions wca
  join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
  where wca.workspace_id = target_workspace_id and wca.status = 'active';

  select count(distinct clr.curriculum_objective_node_id)::int into published_resources
  from public.workspace_curriculum_adoptions wca
  join public.curriculum_learning_resources clr on clr.framework_id = wca.framework_id and clr.status = 'published'
  where wca.workspace_id = target_workspace_id and wca.status = 'active';

  select count(distinct ocl.curriculum_objective_node_id)::int into verified_curriculum_links
  from public.objective_curriculum_links ocl
  join public.learning_objective_nodes lon on lon.id = ocl.learning_objective_node_id
  join public.curriculum_nodes cn on cn.id = ocl.curriculum_objective_node_id
  join public.workspace_curriculum_adoptions wca on wca.framework_id = cn.framework_id
  where lon.workspace_id = target_workspace_id
    and wca.workspace_id = target_workspace_id
    and wca.status = 'active'
    and ocl.alignment_status = 'verified';

  select count(*)::int into active_students
  from public.students s where s.workspace_id = target_workspace_id and s.active = true;

  with latest_final as (
    select distinct on (d.student_id) d.student_id, d.id diagnosis_id
    from public.diagnoses d
    where d.workspace_id = target_workspace_id and d.status = 'final'
    order by d.student_id, coalesce(d.finalised_at, d.updated_at) desc
  )
  select count(*)::int into diagnosis_without_intervention
  from latest_final lf
  where not exists (
    select 1 from public.intervention_handoffs ih
    where ih.workspace_id = target_workspace_id
      and ih.student_id = lf.student_id
      and ih.diagnosis_id = lf.diagnosis_id
      and ih.status = 'confirmed'
  );

  select count(distinct lm.student_id)::int into mastery_intervention_students
  from public.learner_mastery lm
  where lm.workspace_id = target_workspace_id
    and lm.state = 'intervention_required'
    and lm.confidence in ('medium','high');

  select count(*)::int into evidence_thin_students
  from (
    select lm.student_id
    from public.learner_mastery lm
    where lm.workspace_id = target_workspace_id
    group by lm.student_id
    having bool_and(lm.confidence = 'low')
  ) q;

  select count(distinct ih.student_id)::int into overdue_intervention_students
  from public.intervention_handoffs ih
  where ih.workspace_id = target_workspace_id
    and ih.status = 'confirmed'
    and ih.review_date is not null
    and ih.review_date < current_date;

  select count(*)::int into stale_evidence_students
  from public.students s
  where s.workspace_id = target_workspace_id
    and s.active = true
    and not exists (
      select 1 from public.student_evidence se
      where se.workspace_id = target_workspace_id
        and se.student_id = s.id
        and se.recorded_at >= now() - interval '30 days'
    );

  select count(distinct p.student_id)::int into plan_not_started_students
  from public.student_learning_plans p
  where p.workspace_id = target_workspace_id
    and p.status = 'active'
    and not exists (
      select 1 from public.student_learning_plan_steps s
      where s.plan_id = p.id and s.status in ('in_progress','completed')
    );

  select coalesce(jsonb_agg(row_json order by row_json->>'class_name'), '[]'::jsonb)
  into class_coverage
  from (
    select jsonb_build_object(
      'class_id', c.id,
      'class_name', c.name,
      'canonical_objectives', (
        select count(distinct cn.id)
        from public.workspace_curriculum_adoptions wca
        join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
        where wca.workspace_id = target_workspace_id
          and wca.status = 'active'
          and upper(replace(coalesce(cn.class_level,''),' ','')) = upper(replace(c.name,' ',''))
      ),
      'published_resources', (
        select count(distinct clr.curriculum_objective_node_id)
        from public.workspace_curriculum_adoptions wca
        join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
        join public.curriculum_learning_resources clr on clr.curriculum_objective_node_id = cn.id and clr.status = 'published'
        where wca.workspace_id = target_workspace_id
          and wca.status = 'active'
          and upper(replace(coalesce(cn.class_level,''),' ','')) = upper(replace(c.name,' ',''))
      ),
      'verified_aligned_objectives', (
        select count(distinct ocl.curriculum_objective_node_id)
        from public.objective_curriculum_links ocl
        join public.learning_objective_nodes lon on lon.id = ocl.learning_objective_node_id
        join public.curriculum_nodes cn on cn.id = ocl.curriculum_objective_node_id
        join public.workspace_curriculum_adoptions wca on wca.framework_id = cn.framework_id
        where lon.workspace_id = target_workspace_id
          and lon.class_id = c.id
          and wca.workspace_id = target_workspace_id
          and wca.status = 'active'
          and ocl.alignment_status = 'verified'
      )
    ) row_json
    from public.classes c
    where c.workspace_id = target_workspace_id and c.active = true
  ) q;

  select coalesce(jsonb_agg(row_json order by row_json->>'subject_name'), '[]'::jsonb)
  into subject_coverage
  from (
    select jsonb_build_object(
      'subject_id', sub.id,
      'subject_name', sub.name,
      'canonical_objectives', (
        select count(distinct cn.id)
        from public.workspace_curriculum_adoptions wca
        join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
        where wca.workspace_id = target_workspace_id
          and wca.status = 'active'
          and lower(coalesce(cn.subject_name,'')) = lower(sub.name)
      ),
      'published_resources', (
        select count(distinct clr.curriculum_objective_node_id)
        from public.workspace_curriculum_adoptions wca
        join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
        join public.curriculum_learning_resources clr on clr.curriculum_objective_node_id = cn.id and clr.status = 'published'
        where wca.workspace_id = target_workspace_id
          and wca.status = 'active'
          and lower(coalesce(cn.subject_name,'')) = lower(sub.name)
      ),
      'verified_aligned_objectives', (
        select count(distinct ocl.curriculum_objective_node_id)
        from public.objective_curriculum_links ocl
        join public.learning_objective_nodes lon on lon.id = ocl.learning_objective_node_id
        join public.curriculum_nodes cn on cn.id = ocl.curriculum_objective_node_id
        join public.workspace_curriculum_adoptions wca on wca.framework_id = cn.framework_id
        where lon.workspace_id = target_workspace_id
          and lon.subject_id = sub.id
          and wca.workspace_id = target_workspace_id
          and wca.status = 'active'
          and ocl.alignment_status = 'verified'
      )
    ) row_json
    from public.subjects sub
    where sub.workspace_id = target_workspace_id and sub.active = true
  ) q;

  risk_signals := jsonb_build_array(
    jsonb_build_object(
      'key','diagnosis_without_intervention',
      'severity',case when diagnosis_without_intervention > 0 then 'high' else 'clear' end,
      'count',diagnosis_without_intervention,
      'label','Final diagnoses awaiting confirmed intervention',
      'action','Move reviewed diagnoses into a confirmed intervention response.'
    ),
    jsonb_build_object(
      'key','mastery_intervention_required',
      'severity',case when mastery_intervention_students > 0 then 'high' else 'clear' end,
      'count',mastery_intervention_students,
      'label','Learners with medium/high-confidence intervention-required mastery',
      'action','Prioritise reteaching and fresh evidence for the affected objectives.'
    ),
    jsonb_build_object(
      'key','overdue_intervention_review',
      'severity',case when overdue_intervention_students > 0 then 'medium' else 'clear' end,
      'count',overdue_intervention_students,
      'label','Confirmed interventions past review date',
      'action','Review whether the intervention evidence shows progress or needs adjustment.'
    ),
    jsonb_build_object(
      'key','stale_learning_evidence',
      'severity',case when stale_evidence_students > 0 then 'medium' else 'clear' end,
      'count',stale_evidence_students,
      'label','Active learners without evidence in the last 30 days',
      'action','Check lesson delivery, assessment or reviewed learning evidence for these learners.'
    ),
    jsonb_build_object(
      'key','evidence_thin_mastery',
      'severity',case when evidence_thin_students > 0 then 'watch' else 'clear' end,
      'count',evidence_thin_students,
      'label','Learners whose mastery graph remains low-confidence only',
      'action','Build more varied evidence before making stronger mastery decisions.'
    ),
    jsonb_build_object(
      'key','personal_plan_not_started',
      'severity',case when plan_not_started_students > 0 then 'watch' else 'clear' end,
      'count',plan_not_started_students,
      'label','Active personalized plans with no started step',
      'action','Use Student KSI to turn the first learning priority into action.'
    )
  );

  return jsonb_build_object(
    'curriculum', jsonb_build_object(
      'adopted_frameworks', adopted_frameworks,
      'canonical_objectives', canonical_objectives,
      'published_resources', published_resources,
      'verified_curriculum_links', verified_curriculum_links,
      'resource_coverage_percent', case when canonical_objectives > 0 then round(published_resources::numeric / canonical_objectives::numeric * 100) else 0 end,
      'alignment_coverage_percent', case when canonical_objectives > 0 then round(verified_curriculum_links::numeric / canonical_objectives::numeric * 100) else 0 end,
      'curriculum_ready', canonical_objectives > 0
    ),
    'learning_risk', jsonb_build_object(
      'active_students', active_students,
      'signals', risk_signals
    ),
    'class_curriculum_coverage', class_coverage,
    'subject_curriculum_coverage', subject_coverage,
    'principle', 'Learning-risk signals identify where evidence or response is needed; they do not rank student or teacher worth.'
  );
end;
$$;

revoke all on function public.get_leadership_curriculum_risk_intelligence(uuid) from public, anon;
grant execute on function public.get_leadership_curriculum_risk_intelligence(uuid) to authenticated;