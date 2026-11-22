create function private.learning_report_actions(items jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('action', v->>'action', 'timeframe', v->>'timeframe')), '[]'::jsonb)
  from jsonb_array_elements(items) v
$$;
revoke all on function private.learning_report_actions(jsonb) from public, anon, authenticated;

create function public.get_my_learning_result_report(assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner public.students := private.learning_cbt_student();
  result jsonb;
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;

  select jsonb_build_object(
    'id', c.id, 'title', r.snapshot->>'title', 'published_at', r.recorded_at,
    'maxima', r.snapshot->'maxima',
    'scores', scores.value - 'id' - 'name' - 'revision' - 'editable',
    'administrative_comment', r.snapshot->'administrative_comments'->>(learner.id::text),
    'school_name', w.name, 'school_logo', w.logo_url,
    'learner_name', coalesce(scores.value->>'name', learner.display_name),
    'class_name', cl.name,
    'academic_session', coalesce(nullif(d.academic_session, ''), a.blueprint->>'academicSession', cl.academic_session),
    'term', coalesce(nullif(d.term, ''), a.blueprint->>'term'),
    'diagnosis', case when d.id is not null then jsonb_build_object(
      'conciseDiagnosis', d.concise_diagnosis,
      'academicSkillStrengths', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.academic_strengths) v),
      'academicSkillChallenges', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.academic_challenges) v),
      'characterStrengths', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.character_strengths) v),
      'characterChallenges', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.character_challenges) v),
      'schoolAcademicActions', private.learning_report_actions(d.school_academic_actions),
      'parentAcademicActions', private.learning_report_actions(d.parent_academic_actions),
      'schoolCharacterActions', private.learning_report_actions(d.school_character_actions),
      'parentCharacterActions', private.learning_report_actions(d.parent_character_actions),
      'builderGrowthDirection', coalesce(d.builder_growth_direction, ''),
      'encouragementNote', coalesce(d.encouragement_note, '')
    ) end,
    'diagnosis_reviewed_at', d.reviewed_at, 'diagnosis_finalised_at', d.finalised_at,
    'diagnosis_mode', d.diagnosis_mode
  ) into result
  from private.learning_cbts c
  join private.learning_result_reviews r on r.cbt_id = c.id and r.action = 'published'
  join public.workspaces w on w.id = c.workspace_id
  left join public.classes cl on cl.id = c.class_id and cl.workspace_id = c.workspace_id
  left join public.assessments a on a.id = c.assessment_id and a.workspace_id = c.workspace_id
  cross join lateral jsonb_array_elements(r.snapshot->'roster') scores
  left join lateral (
    select diagnosis.*
    from public.diagnoses diagnosis
    where diagnosis.workspace_id = c.workspace_id and diagnosis.student_id = learner.id
      and diagnosis.assessment_id = c.assessment_id and diagnosis.status = 'final'
      and diagnosis.reviewed_at is not null and diagnosis.finalised_at is not null
      and nullif(diagnosis.term, '') is not null
      and nullif(diagnosis.academic_session, '') is not null
    order by diagnosis.finalised_at desc, diagnosis.id
    limit 1
  ) d on true
  where c.id = assignment_id and c.workspace_id = learner.workspace_id
    and scores.value->>'id' = learner.id::text;
  return result;
end;
$$;

revoke all on function public.get_my_learning_result_report(uuid) from public, anon;
grant execute on function public.get_my_learning_result_report(uuid) to authenticated;
