-- KAEC School Intelligence — Stage 6 guarded archive/delete lifecycle
-- Final polish only: this does not add an intelligence engine.
-- Active records may be archived by workspace owner/admin. Permanent deletion is
-- deliberately narrower so the evidence -> diagnosis -> intervention -> lesson chain
-- cannot be silently destroyed.

-- DIAGNOSES ------------------------------------------------------------------

-- Keep archived diagnoses immutable and reserve final/archived transitions for
-- workspace owner/admin while retaining normal draft/review collaboration.
drop policy if exists diagnoses_update_member on public.diagnoses;
create policy diagnoses_update_member
on public.diagnoses
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
  and (
    status <> 'final'
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    status in ('draft','reviewed')
    or (
      status in ('final','archived')
      and private.has_workspace_role(workspace_id, array['owner','admin'])
    )
  )
);

-- A diagnosis may leave active work only after its intervention handoff has also
-- left active work. This prevents a visible intervention pointing at a hidden source.
create or replace function private.enforce_diagnosis_archive_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.status = 'archived' and new.status is distinct from old.status then
    raise exception 'Archived diagnoses are immutable';
  end if;

  if new.status = 'archived' and old.status <> 'archived' then
    if exists (
      select 1
      from public.intervention_handoffs h
      where h.diagnosis_id = old.id
        and h.status <> 'archived'
    ) then
      raise exception 'Archive the linked intervention before archiving this diagnosis';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_diagnosis_archive_integrity()
from public, anon, authenticated;

drop trigger if exists diagnoses_archive_integrity on public.diagnoses;
create trigger diagnoses_archive_integrity
before update on public.diagnoses
for each row execute function private.enforce_diagnosis_archive_integrity();

-- Raw cascade deletion would otherwise erase a linked intervention. Permanent
-- diagnosis delete is therefore owner/admin + archived + dependency-free only.
drop policy if exists diagnoses_delete_admin on public.diagnoses;
create policy diagnoses_delete_admin_archived_dependency_free
on public.diagnoses
for delete
to authenticated
using (
  status = 'archived'
  and private.has_workspace_role(workspace_id, array['owner','admin'])
  and not exists (
    select 1
    from public.intervention_handoffs h
    where h.diagnosis_id = diagnoses.id
  )
);

-- INTERVENTION HANDOFFS ------------------------------------------------------

alter table public.intervention_handoffs
  drop constraint if exists intervention_handoffs_status_check;
alter table public.intervention_handoffs
  add constraint intervention_handoffs_status_check
  check (status in ('draft', 'confirmed', 'archived'));

-- Replace integrity trigger so confirmed plans may be archived without rewriting
-- their confirmed provenance or linked lesson. Archived rows are immutable.
create or replace function private.enforce_intervention_handoff_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  source_workspace_id uuid;
  source_student_id uuid;
  source_status text;
  linked_lesson_workspace_id uuid;
begin
  select d.workspace_id, d.student_id, d.status
  into source_workspace_id, source_student_id, source_status
  from public.diagnoses d
  where d.id = new.diagnosis_id;

  if source_workspace_id is null then
    raise exception 'Intervention handoff requires an existing diagnosis';
  end if;

  if tg_op = 'INSERT' and source_status <> 'final' then
    raise exception 'Intervention handoff can only be created from a final diagnosis';
  end if;

  if tg_op = 'UPDATE' and new.status <> 'archived' and source_status <> 'final' then
    raise exception 'Active intervention handoffs require a final diagnosis';
  end if;

  if new.workspace_id <> source_workspace_id or new.student_id <> source_student_id then
    raise exception 'Intervention handoff must remain in the diagnosis workspace and student boundary';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
      or new.diagnosis_id is distinct from old.diagnosis_id
      or new.student_id is distinct from old.student_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Intervention diagnosis provenance is immutable';
    end if;

    if old.status = 'archived' then
      raise exception 'Archived intervention handoffs are immutable';
    end if;

    if old.status = 'confirmed' then
      if new.status not in ('confirmed', 'archived')
        or new.priority_growth_target is distinct from old.priority_growth_target
        or new.evidence_basis is distinct from old.evidence_basis
        or new.school_intervention is distinct from old.school_intervention
        or new.parent_intervention is distinct from old.parent_intervention
        or new.timeframe is distinct from old.timeframe
        or new.success_indicator is distinct from old.success_indicator
        or new.review_date is distinct from old.review_date
        or new.next_learning_adjustment is distinct from old.next_learning_adjustment
        or new.confirmed_by is distinct from old.confirmed_by
        or new.confirmed_at is distinct from old.confirmed_at then
        raise exception 'Confirmed intervention handoffs are immutable except for archival and the one governed lesson link';
      end if;

      if old.next_lesson_id is not null and new.next_lesson_id is distinct from old.next_lesson_id then
        raise exception 'A confirmed intervention handoff cannot be relinked to a different lesson';
      end if;
    end if;

    if old.status = 'draft' and new.status not in ('draft', 'confirmed', 'archived') then
      raise exception 'Invalid intervention handoff status transition';
    end if;
  end if;

  if new.status = 'confirmed' then
    if btrim(new.priority_growth_target) = ''
      or btrim(new.evidence_basis) = ''
      or btrim(new.timeframe) = ''
      or btrim(new.success_indicator) = ''
      or new.review_date is null
      or btrim(new.next_learning_adjustment) = '' then
      raise exception 'Confirm the growth target, evidence basis, timeframe, success indicator, review date and next learning adjustment first';
    end if;

    if jsonb_array_length(new.school_intervention) = 0 then
      raise exception 'A confirmed intervention handoff requires at least one school intervention';
    end if;

    if tg_op = 'INSERT' or old.status = 'draft' then
      new.confirmed_by := (select auth.uid());
      new.confirmed_at := now();
    end if;
  elsif new.status = 'draft' then
    new.confirmed_by := null;
    new.confirmed_at := null;
    if new.next_lesson_id is not null then
      raise exception 'Only confirmed intervention handoffs may link to a next HQLS lesson';
    end if;
  elsif new.status = 'archived' then
    -- Draft archival keeps confirmation fields empty. Confirmed archival preserves
    -- confirmation and next-lesson provenance exactly as recorded.
    if tg_op = 'INSERT' then
      raise exception 'New intervention handoffs cannot start archived';
    end if;
    if old.status = 'draft' and new.next_lesson_id is not null then
      raise exception 'A draft intervention cannot archive with a linked lesson';
    end if;
  end if;

  if new.next_lesson_id is not null then
    select l.workspace_id
    into linked_lesson_workspace_id
    from public.lessons l
    where l.id = new.next_lesson_id;

    if linked_lesson_workspace_id is null or linked_lesson_workspace_id <> new.workspace_id then
      raise exception 'The next HQLS lesson must belong to the same workspace as the intervention handoff';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_intervention_handoff_integrity()
from public, anon, authenticated;

-- Members may keep editing/confirming active plans. Only owner/admin may move a
-- plan into Archive. Archived rows cannot be updated or restored.
drop policy if exists intervention_handoffs_update_member
on public.intervention_handoffs;
create policy intervention_handoffs_update_member
on public.intervention_handoffs
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status <> 'archived'
)
with check (
  private.is_workspace_member(workspace_id)
  and (
    status in ('draft','confirmed')
    or (
      status = 'archived'
      and private.has_workspace_role(workspace_id, array['owner','admin'])
    )
  )
);

-- Draft mistakes remain removable. An archived intervention may be permanently
-- deleted only when no next HQLS lesson was linked. A linked plan is durable
-- provenance and stays in Archive.
drop policy if exists intervention_handoffs_delete_admin_draft_only
on public.intervention_handoffs;
drop policy if exists intervention_handoffs_delete_admin
on public.intervention_handoffs;
create policy intervention_handoffs_delete_admin_guarded
on public.intervention_handoffs
for delete
to authenticated
using (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  and (
    status = 'draft'
    or (status = 'archived' and next_lesson_id is null)
  )
);
