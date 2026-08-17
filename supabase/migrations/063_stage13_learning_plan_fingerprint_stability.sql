-- KSI 2.0 Stage 13 — keep personalized-plan fingerprints stable across separate requests.
-- Existing mastery refresh upserts set updated_at = now() even when all substantive mastery fields are unchanged.
-- The plan fingerprint legitimately uses the latest mastery update, so preserve updated_at for no-op mastery writes.

create or replace function private.preserve_learner_mastery_timestamp_on_noop()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (
    new.workspace_id,
    new.student_id,
    new.objective_node_id,
    new.state,
    new.mastery_percent,
    new.item_evidence_count,
    new.qualitative_evidence_count,
    new.confidence,
    new.last_evidence_at
  ) is not distinct from (
    old.workspace_id,
    old.student_id,
    old.objective_node_id,
    old.state,
    old.mastery_percent,
    old.item_evidence_count,
    old.qualitative_evidence_count,
    old.confidence,
    old.last_evidence_at
  ) then
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

revoke all on function private.preserve_learner_mastery_timestamp_on_noop() from public, anon, authenticated;

drop trigger if exists learner_mastery_preserve_timestamp_on_noop on public.learner_mastery;
create trigger learner_mastery_preserve_timestamp_on_noop
before update on public.learner_mastery
for each row
execute function private.preserve_learner_mastery_timestamp_on_noop();
