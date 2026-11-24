create function public.preview_learning_class_broadsheet(
  school_id uuid, target_class uuid, school_session text, school_term text
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  roster jsonb;
begin
  if school_term is null or school_term not in ('First Term', 'Second Term', 'Third Term') then
    raise exception 'Choose a school term.';
  end if;

  -- This lookup verifies leadership, class and academic session.
  roster := public.get_learning_subject_enrolments(school_id, target_class, school_session);

  return jsonb_build_object(
    'subjects', roster->'subjects',
    'learners', coalesce((
      select jsonb_agg(learner || jsonb_build_object('assessments', case
        when jsonb_typeof(learner->'subjects') = 'array'
          then public.learning_term_report_preview(school_id, (learner->>'id')::uuid, school_session, school_term)->'assessments'
        else '[]'::jsonb
      end) order by position)
      from jsonb_array_elements(roster->'learners') with ordinality rows(learner, position)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.preview_learning_class_broadsheet(uuid,uuid,text,text) from public, anon;
grant execute on function public.preview_learning_class_broadsheet(uuid,uuid,text,text) to authenticated;
