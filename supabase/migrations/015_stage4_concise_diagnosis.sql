-- KAEC School Intelligence — Stage 4 concise diagnosis
-- Parent-facing diagnosis summary must remain first-class structured data even
-- when insufficient evidence means no possible interpretation should be made.

alter table public.diagnoses
  add column if not exists concise_diagnosis text not null default '';

comment on column public.diagnoses.concise_diagnosis is
  'Evidence-bounded parent-facing educational diagnosis summary. Not a medical, psychiatric or psychological diagnosis.';

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
  concise_diagnosis,
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
