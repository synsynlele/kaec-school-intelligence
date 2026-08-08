-- KAEC School Intelligence - Stage 4 parent report context
-- Preserve the Session and Term visible on the proven KAEC diagnosis sheet.

alter table public.diagnoses
  add column if not exists academic_session text not null default '',
  add column if not exists term text not null default '';

alter table public.diagnoses
  drop constraint if exists diagnoses_academic_session_length,
  add constraint diagnoses_academic_session_length check (char_length(academic_session) <= 80),
  drop constraint if exists diagnoses_term_length,
  add constraint diagnoses_term_length check (char_length(term) <= 40);

create or replace function private.enforce_diagnosis_review_freshness()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.status = 'final' and (
    new.assessment_id is distinct from old.assessment_id or
    new.diagnosis_mode is distinct from old.diagnosis_mode or
    new.academic_session is distinct from old.academic_session or
    new.term is distinct from old.term or
    new.observed_evidence is distinct from old.observed_evidence or
    new.detected_patterns is distinct from old.detected_patterns or
    new.possible_interpretations is distinct from old.possible_interpretations or
    new.academic_strengths is distinct from old.academic_strengths or
    new.academic_challenges is distinct from old.academic_challenges or
    new.character_strengths is distinct from old.character_strengths or
    new.character_challenges is distinct from old.character_challenges or
    new.concise_diagnosis is distinct from old.concise_diagnosis or
    new.school_academic_actions is distinct from old.school_academic_actions or
    new.parent_academic_actions is distinct from old.parent_academic_actions or
    new.school_character_actions is distinct from old.school_character_actions or
    new.parent_character_actions is distinct from old.parent_character_actions or
    new.builder_growth_direction is distinct from old.builder_growth_direction or
    new.encouragement_note is distinct from old.encouragement_note or
    new.evidence_limitations is distinct from old.evidence_limitations or
    new.engine_version is distinct from old.engine_version or
    new.prompt_version is distinct from old.prompt_version
  ) then
    raise exception 'Final diagnoses are immutable; create a new diagnosis if the evidence, report period or interpretation changes';
  end if;

  if old.status = 'reviewed' and (
    new.assessment_id is distinct from old.assessment_id or
    new.diagnosis_mode is distinct from old.diagnosis_mode or
    new.academic_session is distinct from old.academic_session or
    new.term is distinct from old.term or
    new.observed_evidence is distinct from old.observed_evidence or
    new.detected_patterns is distinct from old.detected_patterns or
    new.possible_interpretations is distinct from old.possible_interpretations or
    new.academic_strengths is distinct from old.academic_strengths or
    new.academic_challenges is distinct from old.academic_challenges or
    new.character_strengths is distinct from old.character_strengths or
    new.character_challenges is distinct from old.character_challenges or
    new.concise_diagnosis is distinct from old.concise_diagnosis or
    new.school_academic_actions is distinct from old.school_academic_actions or
    new.parent_academic_actions is distinct from old.parent_academic_actions or
    new.school_character_actions is distinct from old.school_character_actions or
    new.parent_character_actions is distinct from old.parent_character_actions or
    new.builder_growth_direction is distinct from old.builder_growth_direction or
    new.encouragement_note is distinct from old.encouragement_note or
    new.evidence_limitations is distinct from old.evidence_limitations
  ) then
    new.status := 'draft';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.finalised_by := null;
    new.finalised_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_diagnosis_review_freshness() from public, anon, authenticated;

create or replace function public.set_diagnosis_report_context(
  target_diagnosis_id uuid,
  target_academic_session text,
  target_term text
)
returns public.diagnoses
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  diagnosis_row public.diagnoses;
  clean_session text := trim(coalesce(target_academic_session, ''));
  clean_term text := trim(coalesce(target_term, ''));
begin
  if clean_session = '' then
    raise exception 'Academic session is required for a parent diagnosis report';
  end if;
  if clean_term = '' then
    raise exception 'Term is required for a parent diagnosis report';
  end if;

  select * into diagnosis_row
  from public.diagnoses
  where id = target_diagnosis_id;

  if diagnosis_row.id is null then
    raise exception 'Diagnosis not found';
  end if;
  if not private.is_workspace_member(diagnosis_row.workspace_id) then
    raise exception 'Active workspace membership required';
  end if;
  if diagnosis_row.status = 'final' then
    raise exception 'Final diagnoses are immutable';
  end if;

  update public.diagnoses
  set academic_session = left(clean_session, 80),
      term = left(clean_term, 40),
      updated_at = now()
  where id = target_diagnosis_id
  returning * into diagnosis_row;

  return diagnosis_row;
end;
$$;

revoke all on function public.set_diagnosis_report_context(uuid, text, text) from public, anon;
grant execute on function public.set_diagnosis_report_context(uuid, text, text) to authenticated;
