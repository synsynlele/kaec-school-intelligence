-- KAEC School Intelligence — Stage 1 tenant and provenance integrity
-- Prevents cross-workspace references and silent provenance rewrites.

-- Composite uniqueness gives PostgreSQL a declarative target for tenant-safe FKs.
alter table public.classes add constraint classes_id_workspace_unique unique (id, workspace_id);
alter table public.subjects add constraint subjects_id_workspace_unique unique (id, workspace_id);
alter table public.students add constraint students_id_workspace_unique unique (id, workspace_id);
alter table public.resources add constraint resources_id_workspace_unique unique (id, workspace_id);
alter table public.lessons add constraint lessons_id_workspace_unique unique (id, workspace_id);
alter table public.assessments add constraint assessments_id_workspace_unique unique (id, workspace_id);
alter table public.ai_runs add constraint ai_runs_id_workspace_unique unique (id, workspace_id);
alter table public.assessment_items add constraint assessment_items_id_assessment_unique unique (id, assessment_id);

-- Workspace-linked references must point to records in the same tenant.
alter table public.students add constraint students_class_same_workspace_fk
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id);

alter table public.lessons add constraint lessons_class_same_workspace_fk
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id);
alter table public.lessons add constraint lessons_subject_same_workspace_fk
  foreign key (subject_id, workspace_id) references public.subjects(id, workspace_id);

alter table public.hqls_fidelity_checks add constraint fidelity_lesson_same_workspace_fk
  foreign key (lesson_id, workspace_id) references public.lessons(id, workspace_id);

alter table public.assessments add constraint assessments_lesson_same_workspace_fk
  foreign key (source_lesson_id, workspace_id) references public.lessons(id, workspace_id);
alter table public.assessments add constraint assessments_class_same_workspace_fk
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id);
alter table public.assessments add constraint assessments_subject_same_workspace_fk
  foreign key (subject_id, workspace_id) references public.subjects(id, workspace_id);

alter table public.student_evidence add constraint evidence_student_same_workspace_fk
  foreign key (student_id, workspace_id) references public.students(id, workspace_id);
alter table public.student_evidence add constraint evidence_assessment_same_workspace_fk
  foreign key (assessment_id, workspace_id) references public.assessments(id, workspace_id);
alter table public.student_evidence add constraint evidence_item_requires_assessment
  check (assessment_item_id is null or assessment_id is not null);
alter table public.student_evidence add constraint evidence_item_same_assessment_fk
  foreign key (assessment_item_id, assessment_id) references public.assessment_items(id, assessment_id);

alter table public.diagnoses add constraint diagnoses_student_same_workspace_fk
  foreign key (student_id, workspace_id) references public.students(id, workspace_id);
alter table public.diagnoses add constraint diagnoses_assessment_same_workspace_fk
  foreign key (assessment_id, workspace_id) references public.assessments(id, workspace_id);

alter table public.artifact_resource_links add constraint artifact_resource_same_workspace_fk
  foreign key (resource_id, workspace_id) references public.resources(id, workspace_id);

alter table public.generation_feedback add constraint feedback_ai_run_same_workspace_fk
  foreign key (ai_run_id, workspace_id) references public.ai_runs(id, workspace_id);

-- Polymorphic artifact references cannot use ordinary foreign keys. Validate them
-- centrally before writes so provenance rows cannot point across tenants.
create or replace function private.validate_artifact_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actual_workspace uuid;
begin
  if new.artifact_type is null or new.artifact_id is null then
    return new;
  end if;

  case new.artifact_type
    when 'lesson' then
      select workspace_id into actual_workspace from public.lessons where id = new.artifact_id;
    when 'assessment' then
      select workspace_id into actual_workspace from public.assessments where id = new.artifact_id;
    when 'diagnosis' then
      select workspace_id into actual_workspace from public.diagnoses where id = new.artifact_id;
    else
      raise exception 'Unsupported artifact type: %', new.artifact_type;
  end case;

  if actual_workspace is null or actual_workspace <> new.workspace_id then
    raise exception 'Artifact must belong to the same workspace';
  end if;

  return new;
end;
$$;
revoke all on function private.validate_artifact_workspace() from public, anon, authenticated;

create trigger artifact_versions_validate_workspace
before insert or update of workspace_id, artifact_type, artifact_id on public.artifact_versions
for each row execute function private.validate_artifact_workspace();

create trigger artifact_resource_links_validate_workspace
before insert or update of workspace_id, artifact_type, artifact_id on public.artifact_resource_links
for each row execute function private.validate_artifact_workspace();

create trigger ai_runs_validate_workspace
before insert or update of workspace_id, artifact_type, artifact_id on public.ai_runs
for each row execute function private.validate_artifact_workspace();

create trigger generation_feedback_validate_workspace
before insert or update of workspace_id, artifact_type, artifact_id on public.generation_feedback
for each row execute function private.validate_artifact_workspace();

-- A row may never be moved from one tenant to another after creation.
create or replace function private.prevent_workspace_move()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_workspace_move() from public, anon, authenticated;

create trigger subjects_prevent_workspace_move before update on public.subjects for each row execute function private.prevent_workspace_move();
create trigger classes_prevent_workspace_move before update on public.classes for each row execute function private.prevent_workspace_move();
create trigger students_prevent_workspace_move before update on public.students for each row execute function private.prevent_workspace_move();
create trigger resources_prevent_workspace_move before update on public.resources for each row execute function private.prevent_workspace_move();
create trigger lessons_prevent_workspace_move before update on public.lessons for each row execute function private.prevent_workspace_move();
create trigger fidelity_prevent_workspace_move before update on public.hqls_fidelity_checks for each row execute function private.prevent_workspace_move();
create trigger assessments_prevent_workspace_move before update on public.assessments for each row execute function private.prevent_workspace_move();
create trigger evidence_prevent_workspace_move before update on public.student_evidence for each row execute function private.prevent_workspace_move();
create trigger diagnoses_prevent_workspace_move before update on public.diagnoses for each row execute function private.prevent_workspace_move();
create trigger artifact_versions_prevent_workspace_move before update on public.artifact_versions for each row execute function private.prevent_workspace_move();
create trigger artifact_links_prevent_workspace_move before update on public.artifact_resource_links for each row execute function private.prevent_workspace_move();
create trigger ai_runs_prevent_workspace_move before update on public.ai_runs for each row execute function private.prevent_workspace_move();
create trigger feedback_prevent_workspace_move before update on public.generation_feedback for each row execute function private.prevent_workspace_move();

-- Preserve creator/recorder provenance. The trigger receives the immutable column
-- name as TG_ARGV[0] and works across tables through JSONB record comparison.
create or replace function private.prevent_identity_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_value text;
  new_value text;
begin
  old_value := to_jsonb(old) ->> tg_argv[0];
  new_value := to_jsonb(new) ->> tg_argv[0];
  if new_value is distinct from old_value then
    raise exception '% is immutable', tg_argv[0];
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_identity_rewrite() from public, anon, authenticated;

create trigger workspaces_preserve_creator before update on public.workspaces for each row execute function private.prevent_identity_rewrite('created_by');
create trigger subjects_preserve_creator before update on public.subjects for each row execute function private.prevent_identity_rewrite('created_by');
create trigger classes_preserve_creator before update on public.classes for each row execute function private.prevent_identity_rewrite('created_by');
create trigger students_preserve_creator before update on public.students for each row execute function private.prevent_identity_rewrite('created_by');
create trigger resources_preserve_creator before update on public.resources for each row execute function private.prevent_identity_rewrite('created_by');
create trigger lessons_preserve_creator before update on public.lessons for each row execute function private.prevent_identity_rewrite('created_by');
create trigger assessments_preserve_creator before update on public.assessments for each row execute function private.prevent_identity_rewrite('created_by');
create trigger evidence_preserve_recorder before update on public.student_evidence for each row execute function private.prevent_identity_rewrite('recorded_by');
create trigger diagnoses_preserve_creator before update on public.diagnoses for each row execute function private.prevent_identity_rewrite('created_by');
create trigger artifact_versions_preserve_creator before update on public.artifact_versions for each row execute function private.prevent_identity_rewrite('created_by');
create trigger artifact_links_preserve_creator before update on public.artifact_resource_links for each row execute function private.prevent_identity_rewrite('created_by');
create trigger ai_runs_preserve_initiator before update on public.ai_runs for each row execute function private.prevent_identity_rewrite('initiated_by');
create trigger feedback_preserve_creator before update on public.generation_feedback for each row execute function private.prevent_identity_rewrite('created_by');

-- Membership identity is immutable and every workspace must retain an active owner.
create or replace function private.protect_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owners integer;
begin
  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then
      raise exception 'workspace membership identity is immutable';
    end if;
  end if;

  if old.role = 'owner' and old.status = 'active' and (
    tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active'
  ) then
    select count(*) into remaining_owners
    from public.workspace_members wm
    where wm.workspace_id = old.workspace_id
      and wm.user_id <> old.user_id
      and wm.role = 'owner'
      and wm.status = 'active';

    if remaining_owners = 0 then
      raise exception 'A workspace must retain at least one active owner';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_workspace_membership() from public, anon, authenticated;

create trigger workspace_members_protect_integrity
before update or delete on public.workspace_members
for each row execute function private.protect_workspace_membership();

-- Cover the new composite foreign keys on the referencing side.
create index if not exists students_class_workspace_idx on public.students(class_id, workspace_id);
create index if not exists lessons_class_workspace_idx on public.lessons(class_id, workspace_id);
create index if not exists lessons_subject_workspace_idx on public.lessons(subject_id, workspace_id);
create index if not exists fidelity_lesson_workspace_idx on public.hqls_fidelity_checks(lesson_id, workspace_id);
create index if not exists assessments_lesson_workspace_idx on public.assessments(source_lesson_id, workspace_id);
create index if not exists assessments_class_workspace_idx on public.assessments(class_id, workspace_id);
create index if not exists assessments_subject_workspace_idx on public.assessments(subject_id, workspace_id);
create index if not exists evidence_student_workspace_idx on public.student_evidence(student_id, workspace_id);
create index if not exists evidence_assessment_workspace_idx on public.student_evidence(assessment_id, workspace_id);
create index if not exists evidence_item_assessment_idx on public.student_evidence(assessment_item_id, assessment_id);
create index if not exists diagnoses_student_workspace_idx on public.diagnoses(student_id, workspace_id);
create index if not exists diagnoses_assessment_workspace_idx on public.diagnoses(assessment_id, workspace_id);
create index if not exists artifact_resource_workspace_idx on public.artifact_resource_links(resource_id, workspace_id);
create index if not exists feedback_ai_run_workspace_idx on public.generation_feedback(ai_run_id, workspace_id);
