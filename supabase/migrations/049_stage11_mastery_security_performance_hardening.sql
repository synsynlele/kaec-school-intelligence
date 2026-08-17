-- KSI 2.0 Stage 11 — security/performance hardening.

create or replace function private.normalise_learning_objective(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(raw_value,'')), '\s+', ' ', 'g'));
$$;

create index if not exists learning_objective_nodes_class_workspace_fk_idx
  on public.learning_objective_nodes(class_id,workspace_id);
create index if not exists learning_objective_nodes_subject_workspace_fk_idx
  on public.learning_objective_nodes(subject_id,workspace_id);
create index if not exists learner_mastery_student_workspace_fk_idx
  on public.learner_mastery(student_id,workspace_id);
create index if not exists mastery_events_student_workspace_fk_idx
  on public.mastery_events(student_id,workspace_id);
create index if not exists mastery_events_objective_workspace_fk_idx
  on public.mastery_events(objective_node_id,workspace_id);
