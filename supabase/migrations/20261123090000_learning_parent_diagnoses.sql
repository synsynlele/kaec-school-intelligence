create function public.get_my_parent_learning_diagnoses(diagnosis_id uuid default null)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id, 'title', coalesce(a.title, 'Learner diagnosis'),
      'learner_id', s.id, 'learner_name', s.display_name,
      'class_name', cl.name, 'academic_session', d.academic_session,
      'term', d.term, 'published_at', d.finalised_at
    ) || case when diagnosis_id is not null then jsonb_build_object(
      'school_name', w.name, 'school_logo', w.logo_url,
      'diagnosis_mode', d.diagnosis_mode, 'diagnosis_reviewed_at', d.reviewed_at,
      'diagnosis_finalised_at', d.finalised_at,
      'diagnosis', jsonb_build_object(
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
      )
    ) else '{}'::jsonb end order by d.finalised_at desc, d.id
  ), '[]'::jsonb)
  from private.learning_parent_links l
  join public.students s on s.id = l.learner_id and s.active
  join public.diagnoses d on d.student_id = s.id and d.workspace_id = s.workspace_id
  join public.workspaces w on w.id = s.workspace_id
  left join public.classes cl on cl.id = s.class_id and cl.workspace_id = s.workspace_id
  left join public.assessments a on a.id = d.assessment_id and a.workspace_id = s.workspace_id
  where l.parent_id = auth.uid()
    and private.learning_report_parent_can_read(s.id, s.workspace_id)
    and d.status = 'final' and d.reviewed_at is not null and d.finalised_at is not null
    and nullif(btrim(d.term), '') is not null and nullif(btrim(d.academic_session), '') is not null
    and (diagnosis_id is null or d.id = diagnosis_id);
$$;

revoke all on function public.get_my_parent_learning_diagnoses(uuid) from public, anon;
grant execute on function public.get_my_parent_learning_diagnoses(uuid) to authenticated;
