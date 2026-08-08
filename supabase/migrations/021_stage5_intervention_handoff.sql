-- KAEC School Intelligence — Stage 5 governed intervention handoff
-- Supporting capability only: Final Diagnosis -> Confirmed Intervention -> Next HQLS Lesson.
-- This is deliberately not a fourth intelligence engine.

create table public.intervention_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  diagnosis_id uuid not null unique references public.diagnoses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  priority_growth_target text not null default '',
  evidence_basis text not null default '',
  school_intervention jsonb not null default '[]'::jsonb,
  parent_intervention jsonb not null default '[]'::jsonb,
  timeframe text not null default '',
  success_indicator text not null default '',
  review_date date,
  next_learning_adjustment text not null default '',
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  next_lesson_id uuid references public.lessons(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intervention_handoffs_school_actions_array
    check (jsonb_typeof(school_intervention) = 'array'),
  constraint intervention_handoffs_parent_actions_array
    check (jsonb_typeof(parent_intervention) = 'array')
);

create index intervention_handoffs_workspace_updated_idx
  on public.intervention_handoffs (workspace_id, updated_at desc);
create index intervention_handoffs_student_updated_idx
  on public.intervention_handoffs (student_id, updated_at desc);
create index intervention_handoffs_next_lesson_idx
  on public.intervention_handoffs (next_lesson_id)
  where next_lesson_id is not null;

alter table public.intervention_handoffs enable row level security;

create policy intervention_handoffs_select_member
on public.intervention_handoffs
for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy intervention_handoffs_insert_member
on public.intervention_handoffs
for insert
to authenticated
with check (
  (select private.is_workspace_member(workspace_id))
  and created_by = (select auth.uid())
);

create policy intervention_handoffs_update_member
on public.intervention_handoffs
for update
to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

create policy intervention_handoffs_delete_admin
on public.intervention_handoffs
for delete
to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner','admin'])));

revoke all on table public.intervention_handoffs from anon;
grant select, insert, update, delete on table public.intervention_handoffs to authenticated;
grant all on table public.intervention_handoffs to service_role;

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

  if source_status <> 'final' then
    raise exception 'Intervention handoff can only be created from a final diagnosis';
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

    if old.status = 'confirmed' then
      if new.status is distinct from old.status
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
        raise exception 'Confirmed intervention handoffs are immutable; create a new diagnosis cycle if the plan must change';
      end if;

      if old.next_lesson_id is not null and new.next_lesson_id is distinct from old.next_lesson_id then
        raise exception 'A confirmed intervention handoff cannot be relinked to a different lesson';
      end if;
    end if;

    if old.status = 'draft' and new.status not in ('draft', 'confirmed') then
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
  else
    new.confirmed_by := null;
    new.confirmed_at := null;
    if new.next_lesson_id is not null then
      raise exception 'Only confirmed intervention handoffs may link to a next HQLS lesson';
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

revoke all on function private.enforce_intervention_handoff_integrity() from public, anon, authenticated;

drop trigger if exists intervention_handoffs_integrity on public.intervention_handoffs;
create trigger intervention_handoffs_integrity
before insert or update on public.intervention_handoffs
for each row execute function private.enforce_intervention_handoff_integrity();
