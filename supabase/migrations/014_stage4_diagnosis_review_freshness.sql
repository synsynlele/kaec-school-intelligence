-- KAEC School Intelligence — Stage 4 diagnosis review freshness
-- Any material edit after human review invalidates that review and returns the
-- diagnosis to draft. Final diagnosis content is immutable.

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
    new.observed_evidence is distinct from old.observed_evidence or
    new.detected_patterns is distinct from old.detected_patterns or
    new.possible_interpretations is distinct from old.possible_interpretations or
    new.academic_strengths is distinct from old.academic_strengths or
    new.academic_challenges is distinct from old.academic_challenges or
    new.character_strengths is distinct from old.character_strengths or
    new.character_challenges is distinct from old.character_challenges or
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
    raise exception 'Final diagnoses are immutable; create a new diagnosis if the evidence or interpretation changes';
  end if;

  if old.status = 'reviewed' and (
    new.assessment_id is distinct from old.assessment_id or
    new.diagnosis_mode is distinct from old.diagnosis_mode or
    new.observed_evidence is distinct from old.observed_evidence or
    new.detected_patterns is distinct from old.detected_patterns or
    new.possible_interpretations is distinct from old.possible_interpretations or
    new.academic_strengths is distinct from old.academic_strengths or
    new.academic_challenges is distinct from old.academic_challenges or
    new.character_strengths is distinct from old.character_strengths or
    new.character_challenges is distinct from old.character_challenges or
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

drop trigger if exists diagnoses_review_freshness on public.diagnoses;
create trigger diagnoses_review_freshness
before update on public.diagnoses
for each row execute function private.enforce_diagnosis_review_freshness();
