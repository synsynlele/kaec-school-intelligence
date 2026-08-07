-- KAEC School Intelligence — Stage 1 Platform Foundation
-- Governed by docs/PRODUCT_CONSTITUTION.md v1.1 APPROVED.
-- Do not apply this migration to pipupath-staging.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  default_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  workspace_type text not null default 'individual'
    check (workspace_type in ('individual', 'school')),
  logo_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id)
  references public.workspaces(id)
  on delete set null;

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'teacher')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  age_range text,
  academic_session text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, academic_session)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  display_name text not null,
  external_reference text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  resource_type text not null
    check (resource_type in ('curriculum', 'scheme', 'notes', 'reference', 'other')),
  visibility text not null default 'workspace'
    check (visibility in ('private', 'workspace')),
  storage_path text,
  mime_type text,
  extracted_text text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  topic text not null,
  age_range text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  objective text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'archived')),
  engine_version text,
  prompt_version text,
  source_context jsonb not null default '[]'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_stages (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  stage_number smallint not null check (stage_number between 1 and 7),
  stage_key text not null
    check (stage_key in (
      'awakening',
      'exploration',
      'micro_illumination',
      'trial_first',
      'full_illumination',
      'trial_second',
      'integration'
    )),
  content jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, stage_number),
  unique (lesson_id, stage_key)
);

create table public.hqls_fidelity_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  checked_by uuid references auth.users(id) on delete set null,
  check_origin text not null default 'system'
    check (check_origin in ('system', 'human')),
  passed boolean not null,
  score numeric,
  violations jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  engine_version text,
  created_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  source_lesson_id uuid references public.lessons(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  assessment_mode text not null
    check (assessment_mode in ('objective', 'subjective', 'critical_thinking', 'project', 'mixed')),
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'archived')),
  blueprint jsonb not null default '{}'::jsonb,
  engine_version text,
  prompt_version text,
  source_context jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  position integer not null check (position > 0),
  item_type text not null
    check (item_type in ('objective', 'subjective', 'critical_thinking', 'project')),
  critical_thinking_type text
    check (
      critical_thinking_type is null or critical_thinking_type in (
        'reality_simulation',
        'imperfect_choice',
        'hidden_problem',
        'creation',
        'crisis'
      )
    ),
  topic text,
  objective text,
  difficulty text,
  marks numeric check (marks is null or marks >= 0),
  content jsonb not null default '{}'::jsonb,
  answer_key jsonb,
  marking_guide jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, position)
);

create table public.student_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  assessment_item_id uuid references public.assessment_items(id) on delete set null,
  evidence_type text not null
    check (evidence_type in ('score', 'item_result', 'observation', 'reflection')),
  numeric_value numeric,
  content jsonb not null default '{}'::jsonb,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  assessment_id uuid references public.assessments(id) on delete set null,
  diagnosis_mode text not null
    check (diagnosis_mode in ('quick_teacher', 'assessment_based', 'combined')),
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'final', 'archived')),
  observed_evidence jsonb not null default '[]'::jsonb,
  detected_patterns jsonb not null default '[]'::jsonb,
  possible_interpretations jsonb not null default '[]'::jsonb,
  academic_strengths jsonb not null default '[]'::jsonb,
  academic_challenges jsonb not null default '[]'::jsonb,
  character_strengths jsonb not null default '[]'::jsonb,
  character_challenges jsonb not null default '[]'::jsonb,
  school_academic_actions jsonb not null default '[]'::jsonb,
  parent_academic_actions jsonb not null default '[]'::jsonb,
  school_character_actions jsonb not null default '[]'::jsonb,
  parent_character_actions jsonb not null default '[]'::jsonb,
  builder_growth_direction text,
  encouragement_note text,
  evidence_limitations jsonb not null default '[]'::jsonb,
  engine_version text,
  prompt_version text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  finalised_by uuid references auth.users(id) on delete set null,
  finalised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnosis_final_requires_human check (
    status <> 'final'
    or (reviewed_by is not null and reviewed_at is not null and finalised_by is not null and finalised_at is not null)
  )
);

create table public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('lesson', 'assessment', 'diagnosis')),
  artifact_id uuid not null,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  origin text not null
    check (origin in ('generated', 'manual_edit', 'regeneration', 'review', 'finalisation')),
  engine_version text,
  prompt_version text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (artifact_type, artifact_id, version_number)
);

create table public.artifact_resource_links (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('lesson', 'assessment', 'diagnosis')),
  artifact_id uuid not null,
  purpose text not null default 'context',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (resource_id, artifact_type, artifact_id)
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  engine text not null,
  engine_version text not null,
  prompt_version text not null,
  provider text,
  model text,
  artifact_type text check (artifact_type is null or artifact_type in ('lesson', 'assessment', 'diagnosis')),
  artifact_id uuid,
  status text not null check (status in ('started', 'succeeded', 'failed', 'cancelled')),
  input_summary jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.generation_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  artifact_type text not null check (artifact_type in ('lesson', 'assessment', 'diagnosis')),
  artifact_id uuid not null,
  rating text not null check (rating in ('useful', 'needs_improvement', 'incorrect', 'misaligned')),
  comment text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index subjects_workspace_id_idx on public.subjects(workspace_id);
create index classes_workspace_id_idx on public.classes(workspace_id);
create index students_workspace_id_idx on public.students(workspace_id);
create index students_class_id_idx on public.students(class_id);
create index resources_workspace_id_idx on public.resources(workspace_id);
create index lessons_workspace_id_idx on public.lessons(workspace_id);
create index lessons_source_lookup_idx on public.lessons(workspace_id, subject_id, class_id);
create index lesson_stages_lesson_id_idx on public.lesson_stages(lesson_id);
create index assessments_workspace_id_idx on public.assessments(workspace_id);
create index assessments_source_lesson_id_idx on public.assessments(source_lesson_id);
create index assessment_items_assessment_id_idx on public.assessment_items(assessment_id);
create index student_evidence_student_id_idx on public.student_evidence(student_id);
create index student_evidence_assessment_id_idx on public.student_evidence(assessment_id);
create index diagnoses_workspace_id_idx on public.diagnoses(workspace_id);
create index diagnoses_student_id_idx on public.diagnoses(student_id);
create index artifact_versions_lookup_idx on public.artifact_versions(artifact_type, artifact_id);
create index ai_runs_workspace_id_idx on public.ai_runs(workspace_id);

-- Workspace membership helpers.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[]) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

-- Bootstrap one private individual workspace for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  resolved_name text;
begin
  resolved_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'My Workspace');

  insert into public.profiles (id, display_name, email)
  values (new.id, resolved_name, new.email);

  insert into public.workspaces (name, workspace_type, created_by)
  values (resolved_name || '''s Workspace', 'individual', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new_workspace_id, new.id, 'owner', 'active');

  update public.profiles
  set default_workspace_id = new_workspace_id
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at triggers
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects
for each row execute function public.set_updated_at();
create trigger classes_set_updated_at before update on public.classes
for each row execute function public.set_updated_at();
create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger resources_set_updated_at before update on public.resources
for each row execute function public.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons
for each row execute function public.set_updated_at();
create trigger lesson_stages_set_updated_at before update on public.lesson_stages
for each row execute function public.set_updated_at();
create trigger assessments_set_updated_at before update on public.assessments
for each row execute function public.set_updated_at();
create trigger assessment_items_set_updated_at before update on public.assessment_items
for each row execute function public.set_updated_at();
create trigger student_evidence_set_updated_at before update on public.student_evidence
for each row execute function public.set_updated_at();
create trigger diagnoses_set_updated_at before update on public.diagnoses
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.resources enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_stages enable row level security;
alter table public.hqls_fidelity_checks enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_items enable row level security;
alter table public.student_evidence enable row level security;
alter table public.diagnoses enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.artifact_resource_links enable row level security;
alter table public.ai_runs enable row level security;
alter table public.generation_feedback enable row level security;

-- Profiles
create policy profiles_select_self on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces and membership
create policy workspaces_select_member on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (public.has_workspace_role(id, array['owner','admin']))
with check (public.has_workspace_role(id, array['owner','admin']));

create policy workspace_members_select_member on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_members_manage_admin on public.workspace_members
for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

-- Generic workspace-scoped tables
create policy subjects_workspace_access on public.subjects
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy classes_workspace_access on public.classes
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy students_workspace_access on public.students
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy resources_select_scope on public.resources
for select to authenticated using (
  public.is_workspace_member(workspace_id)
  and (visibility = 'workspace' or created_by = auth.uid())
);
create policy resources_insert_member on public.resources
for insert to authenticated with check (
  public.is_workspace_member(workspace_id) and created_by = auth.uid()
);
create policy resources_update_owner_or_admin on public.resources
for update to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (created_by = auth.uid() or public.has_workspace_role(workspace_id, array['owner','admin']))
)
with check (public.is_workspace_member(workspace_id));
create policy resources_delete_owner_or_admin on public.resources
for delete to authenticated using (
  created_by = auth.uid() or public.has_workspace_role(workspace_id, array['owner','admin'])
);

create policy lessons_workspace_access on public.lessons
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy lesson_stages_workspace_access on public.lesson_stages
for all to authenticated
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id and public.is_workspace_member(l.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id and public.is_workspace_member(l.workspace_id)
  )
);

create policy fidelity_workspace_access on public.hqls_fidelity_checks
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy assessments_workspace_access on public.assessments
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy assessment_items_workspace_access on public.assessment_items
for all to authenticated
using (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_id and public.is_workspace_member(a.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_id and public.is_workspace_member(a.workspace_id)
  )
);

create policy evidence_workspace_access on public.student_evidence
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy diagnoses_select_member on public.diagnoses
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy diagnoses_insert_member on public.diagnoses
for insert to authenticated with check (
  public.is_workspace_member(workspace_id) and created_by = auth.uid()
);
create policy diagnoses_update_member on public.diagnoses
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and (
    status <> 'final'
    or public.has_workspace_role(workspace_id, array['owner','admin'])
  )
);
create policy diagnoses_delete_admin on public.diagnoses
for delete to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']));

create policy artifact_versions_select_member on public.artifact_versions
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy artifact_versions_insert_member on public.artifact_versions
for insert to authenticated with check (
  public.is_workspace_member(workspace_id) and created_by = auth.uid()
);

create policy artifact_resources_workspace_access on public.artifact_resource_links
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy ai_runs_select_member on public.ai_runs
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ai_runs_insert_self on public.ai_runs
for insert to authenticated with check (
  public.is_workspace_member(workspace_id) and initiated_by = auth.uid()
);
create policy ai_runs_update_self on public.ai_runs
for update to authenticated
using (initiated_by = auth.uid() and public.is_workspace_member(workspace_id))
with check (initiated_by = auth.uid() and public.is_workspace_member(workspace_id));

create policy generation_feedback_workspace_access on public.generation_feedback
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

-- Authenticated role receives table privileges; RLS remains the data boundary.
grant select, insert, update, delete on all tables in schema public to authenticated;
