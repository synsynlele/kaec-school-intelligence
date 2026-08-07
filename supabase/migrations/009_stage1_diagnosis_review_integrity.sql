-- KAEC School Intelligence — Stage 1 diagnosis review integrity
-- Reviewer and finaliser identity must come from auth.uid(), never client-supplied IDs.

revoke update on public.diagnoses from authenticated;

grant update (
  assessment_id,
  diagnosis_mode,
  observed_evidence,
  detected_patterns,
  possible_interpretations,
  academic_strengths,
  academic_challenges,
  character_strengths,
  character_challenges,
  school_academic_actions,
  parent_academic_actions,
  school_character_actions,
  parent_character_actions,
  builder_growth_direction,
  encouragement_note,
  evidence_limitations,
  engine_version,
  prompt_version,
  updated_at
) on public.diagnoses to authenticated;

create or replace function public.review_diagnosis(target_diagnosis_id uuid)
returns public.diagnoses
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_row public.diagnoses;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_row
  from public.diagnoses
  where id = target_diagnosis_id;

  if target_row.id is null then
    raise exception 'Diagnosis not found';
  end if;

  if not private.is_workspace_member(target_row.workspace_id) then
    raise exception 'Diagnosis not found';
  end if;

  if target_row.status not in ('draft', 'reviewed') then
    raise exception 'Only draft or reviewed diagnoses may be reviewed';
  end if;

  update public.diagnoses
  set
    status = 'reviewed',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = target_diagnosis_id
  returning * into target_row;

  return target_row;
end;
$$;

revoke all on function public.review_diagnosis(uuid) from public, anon;
grant execute on function public.review_diagnosis(uuid) to authenticated;

create or replace function public.finalise_diagnosis(target_diagnosis_id uuid)
returns public.diagnoses
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_row public.diagnoses;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_row
  from public.diagnoses
  where id = target_diagnosis_id;

  if target_row.id is null then
    raise exception 'Diagnosis not found';
  end if;

  if not private.has_workspace_role(target_row.workspace_id, array['owner','admin']) then
    raise exception 'Owner or admin role required to finalise diagnosis';
  end if;

  if target_row.status <> 'reviewed'
     or target_row.reviewed_by is null
     or target_row.reviewed_at is null then
    raise exception 'Diagnosis must be human-reviewed before finalisation';
  end if;

  update public.diagnoses
  set
    status = 'final',
    finalised_by = auth.uid(),
    finalised_at = now()
  where id = target_diagnosis_id
  returning * into target_row;

  return target_row;
end;
$$;

revoke all on function public.finalise_diagnosis(uuid) from public, anon;
grant execute on function public.finalise_diagnosis(uuid) to authenticated;
