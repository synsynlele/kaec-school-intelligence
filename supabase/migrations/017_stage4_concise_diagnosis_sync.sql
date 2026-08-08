-- KAEC School Intelligence — Stage 4 concise diagnosis compatibility bridge
-- Early Stage 4 drafts carried the concise parent summary in the first
-- interpretation's `summary` property. `concise_diagnosis` is now canonical.
-- This trigger keeps edits synchronized while the route transition is completed.

create or replace function private.sync_diagnosis_concise_summary()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  legacy_summary text;
begin
  legacy_summary := nullif(trim(coalesce(new.possible_interpretations -> 0 ->> 'summary', '')), '');

  if tg_op = 'INSERT' then
    if trim(coalesce(new.concise_diagnosis, '')) = '' and legacy_summary is not null then
      new.concise_diagnosis := legacy_summary;
    end if;
  elsif new.possible_interpretations is distinct from old.possible_interpretations
        and new.concise_diagnosis is not distinct from old.concise_diagnosis
        and legacy_summary is not null then
    new.concise_diagnosis := legacy_summary;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_diagnosis_concise_summary() from public, anon, authenticated;

drop trigger if exists diagnoses_sync_concise_summary on public.diagnoses;
create trigger diagnoses_sync_concise_summary
before insert or update on public.diagnoses
for each row execute function private.sync_diagnosis_concise_summary();
