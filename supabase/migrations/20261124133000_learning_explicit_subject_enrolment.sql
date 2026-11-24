create or replace function public.save_learning_subject_gradebook(school_id uuid,target_class uuid,school_session text,school_term text,report_period text,
  target_subject uuid,new_sheet jsonb,previous_sheet jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare roster jsonb; chosen jsonb; mark record; component text; maximum numeric; score numeric; total numeric:=0;
  maxima jsonb:=new_sheet->'maxima'; marks jsonb:=new_sheet->'marks';
  components constant text[]:=array['objective','subjective','critical_thinking','project'];
begin
  perform 1 from public.classes c where c.id=target_class and c.workspace_id=school_id for update;
  roster:=public.get_learning_subject_gradebook(school_id,target_class,school_session,school_term,report_period);
  select value into chosen from jsonb_array_elements(roster->'subjects') where value->>'id'=target_subject::text;
  if chosen is null then raise exception 'You are not assigned to this class subject.'; end if;
  if chosen->'sheet' is distinct from coalesce(previous_sheet,'null'::jsonb) then raise exception 'Scores changed. Reload the class before saving.'; end if;
  if jsonb_typeof(maxima) is distinct from 'object' or jsonb_typeof(marks) is distinct from 'object' then raise exception 'Invalid score sheet.'; end if;
  if exists(select from jsonb_object_keys(maxima) k where not (k=any(components))) then raise exception 'Unknown score component.'; end if;
  foreach component in array components loop
    if jsonb_typeof(maxima->component) is distinct from 'number' then raise exception 'Set each component maximum.'; end if;
    maximum:=(maxima->>component)::numeric;
    if maximum<0 or maximum>100 then raise exception 'Invalid component maximum.'; end if;
    total:=total+maximum;
  end loop;
  if total<>100 then raise exception 'Component maxima must total 100.'; end if;
  for mark in select key,value from jsonb_each(marks) loop
    if not exists(select from jsonb_array_elements(roster->'learners') l where l->>'id'=mark.key
      and (l->'subjects') ? target_subject::text)
      or jsonb_typeof(mark.value) is distinct from 'object' then raise exception 'Invalid learner or marks.'; end if;
    if exists(select from jsonb_object_keys(mark.value) k where not (k=any(components))) then raise exception 'Unknown score component.'; end if;
    foreach component in array components loop
      if mark.value->>component is null then continue; end if;
      if jsonb_typeof(mark.value->component)<>'number' then raise exception 'Scores must be numbers.'; end if;
      score:=(mark.value->>component)::numeric;
      if score<0 or score>(maxima->>component)::numeric then raise exception 'A score exceeds its component maximum.'; end if;
    end loop;
  end loop;
  insert into private.learning_subject_gradebook values
    (school_id,target_class,school_session,school_term,report_period,target_subject,jsonb_build_object('maxima',maxima,'marks',marks),auth.uid())
  on conflict on constraint learning_subject_gradebook_pkey do update set scores=excluded.scores,updated_by=excluded.updated_by;
end $$;

create or replace function public.approve_learning_subject_gradebook(school_id uuid,target_class uuid,school_session text,school_term text,report_period text,reviewed_sheet jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare roster jsonb; learner jsonb; subject jsonb; maxima jsonb; scores jsonb; subjects jsonb; school public.workspaces; classroom public.classes; published_count integer:=0;
begin
  perform 1 from public.classes c where c.id=target_class and c.workspace_id=school_id for update;
  roster:=public.get_learning_subject_gradebook(school_id,target_class,school_session,school_term,report_period);
  if not (roster->>'can_publish')::boolean then raise exception 'School leadership access required.'; end if;
  if roster is distinct from reviewed_sheet then raise exception 'Scores or enrolment changed. Reload and review the class.'; end if;
  if jsonb_array_length(roster->'learners')=0 then raise exception 'Add class learners and teaching assignments.'; end if;
  select * into school from public.workspaces w where w.id=school_id;
  select * into classroom from public.classes c where c.id=target_class;

  for learner in select value from jsonb_array_elements(roster->'learners') loop
    if jsonb_typeof(learner->'subjects') is distinct from 'array' then
      raise exception 'Confirm subject enrolment for % before publishing.',learner->>'name';
    end if;
    subjects:='[]';
    for subject in select value from jsonb_array_elements(roster->'subjects') loop
      if not ((learner->'subjects') ? (subject->>'id')) then continue; end if;
      maxima:=subject->'sheet'->'maxima';
      scores:=subject->'sheet'->'marks'->(learner->>'id');
      if maxima is null or exists(select from jsonb_each_text(maxima) m where m.value::numeric>0 and scores->>m.key is null) then
        raise exception 'Complete the marks for % in %.',learner->>'name',subject->>'name';
      end if;
      subjects:=subjects||jsonb_build_array(jsonb_build_object('id',subject->>'id','subject',subject->>'name',
        'title',case when report_period='midterm' then 'Mid-Term' else 'Terminal' end,'maxima',maxima,'scores',scores));
    end loop;
    if jsonb_array_length(subjects)=0 then raise exception 'No enrolled subjects for %.',learner->>'name'; end if;
    update private.learning_term_reports r set withdrawn_at=now(),withdrawn_by=auth.uid(),withdrawal_reason='Replaced by approved class results'
      where r.workspace_id=school_id and r.student_id=(learner->>'id')::uuid and r.academic_session=school_session
        and r.term=school_term and r.report_kind=report_period and r.withdrawn_at is null;
    insert into private.learning_term_reports(workspace_id,student_id,academic_session,term,report_kind,published_by,snapshot,released_class_id)
      values(school_id,(learner->>'id')::uuid,school_session,school_term,report_period,auth.uid(),jsonb_build_object(
        'learner_name',learner->>'name','school_name',school.name,'school_logo',school.logo_url,'class_name',classroom.name,
        'academic_session',school_session,'term',school_term,'assessments',subjects,'mastery_progressing_at',60,
        'passport_photo',(select p.jpeg from private.learning_passport_photos p where p.learner_id=(learner->>'id')::uuid)),target_class);
    published_count:=published_count+1;
  end loop;
  return published_count;
end $$;
