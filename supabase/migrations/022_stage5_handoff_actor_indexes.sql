-- KAEC School Intelligence — Stage 5 intervention actor index hardening
-- Cover user foreign keys used for provenance and confirmation audit queries.

create index intervention_handoffs_created_by_idx
  on public.intervention_handoffs (created_by);

create index intervention_handoffs_confirmed_by_idx
  on public.intervention_handoffs (confirmed_by)
  where confirmed_by is not null;
