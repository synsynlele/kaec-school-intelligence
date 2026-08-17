-- KSI 2.0 Stage 12 — Curriculum Intelligence foundation
-- Versioned authoritative sources, curriculum hierarchy, prerequisites, school adoption and explicit objective alignment.

create table public.curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  authority text not null,
  jurisdiction text not null,
  name text not null,
  source_url text not null,
  source_kind text not null check (source_kind in ('official','state_scheme','school_overlay')),
  accessed_on date,
  verification_status text not null default 'registered' check (verification_status in ('registered','verified','retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(authority, name, source_url)
);

create table public.curriculum_frameworks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.curriculum_sources(id) on delete restrict,
  name text not null,
  version_label text not null,
  education_level text not null,
  effective_from date,
  effective_to date,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, version_label, education_level)
);

create table public.curriculum_nodes (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.curriculum_frameworks(id) on delete cascade,
  parent_id uuid references public.curriculum_nodes(id) on delete restrict,
  node_type text not null check (node_type in ('class','term','subject','strand','topic','objective')),
  node_key text not null,
  title text not null,
  class_level text,
  term text,
  subject_name text,
  objective_text text,
  source_reference text,
  position integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(framework_id, node_key)
);

create table public.curriculum_prerequisites (
  framework_id uuid not null references public.curriculum_frameworks(id) on delete cascade,
  objective_node_id uuid not null references public.curriculum_nodes(id) on delete cascade,
  prerequisite_node_id uuid not null references public.curriculum_nodes(id) on delete cascade,
  relationship text not null default 'prerequisite' check (relationship in ('prerequisite','recommended_before')),
  created_at timestamptz not null default now(),
  primary key (framework_id, objective_node_id, prerequisite_node_id),
  check (objective_node_id <> prerequisite_node_id)
);

create table public.workspace_curriculum_adoptions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid not null references public.curriculum_frameworks(id) on delete restrict,
  status text not null default 'active' check (status in ('active','paused','retired')),
  adopted_by uuid not null references auth.users(id) on delete restrict,
  adopted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, framework_id)
);

create table public.objective_curriculum_links (
  learning_objective_node_id uuid not null references public.learning_objective_nodes(id) on delete cascade,
  curriculum_objective_node_id uuid not null references public.curriculum_nodes(id) on delete restrict,
  alignment_status text not null default 'proposed' check (alignment_status in ('proposed','verified','rejected')),
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  rationale text,
  linked_by uuid references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  primary key (learning_objective_node_id, curriculum_objective_node_id)
);

create index curriculum_nodes_framework_parent_idx on public.curriculum_nodes(framework_id, parent_id);
create index curriculum_nodes_lookup_idx on public.curriculum_nodes(framework_id, class_level, subject_name, term, node_type);
create index curriculum_prerequisites_objective_idx on public.curriculum_prerequisites(objective_node_id);
create index curriculum_prerequisites_prerequisite_idx on public.curriculum_prerequisites(prerequisite_node_id);
create index workspace_curriculum_adoptions_framework_idx on public.workspace_curriculum_adoptions(framework_id);
create index objective_curriculum_links_curriculum_idx on public.objective_curriculum_links(curriculum_objective_node_id);

alter table public.curriculum_sources enable row level security;
alter table public.curriculum_frameworks enable row level security;
alter table public.curriculum_nodes enable row level security;
alter table public.curriculum_prerequisites enable row level security;
alter table public.workspace_curriculum_adoptions enable row level security;
alter table public.objective_curriculum_links enable row level security;

revoke all on table public.curriculum_sources, public.curriculum_frameworks, public.curriculum_nodes, public.curriculum_prerequisites, public.workspace_curriculum_adoptions, public.objective_curriculum_links from anon, authenticated;

insert into public.curriculum_sources(authority, jurisdiction, name, source_url, source_kind, accessed_on, verification_status, metadata)
values (
  'Nigerian Educational Research and Development Council (NERDC)',
  'Nigeria',
  'New Revised Basic Education Curriculum',
  'https://www.nerdc.gov.ng/content_manager/new_curriculum_home.html',
  'official',
  date '2026-08-17',
  'verified',
  jsonb_build_object('class_entries', jsonb_build_array('JSS1','JSS2','JSS3'), 'content_ingested', false)
)
on conflict (authority, name, source_url) do update set accessed_on = excluded.accessed_on, verification_status = 'verified', metadata = excluded.metadata, updated_at = now();

insert into public.curriculum_frameworks(source_id, name, version_label, education_level, status, metadata)
select cs.id,
       'NERDC New Revised Basic Education Curriculum — Junior Secondary',
       'official-current-accessed-2026-08-17',
       'Junior Secondary',
       'draft',
       jsonb_build_object('class_scope', jsonb_build_array('JSS1','JSS2','JSS3'), 'ingestion_status','source_registered')
from public.curriculum_sources cs
where cs.authority = 'Nigerian Educational Research and Development Council (NERDC)'
  and cs.name = 'New Revised Basic Education Curriculum'
on conflict (source_id, version_label, education_level) do nothing;

create or replace function public.get_curriculum_intelligence(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id, array['owner','admin','leader','teacher']) then
    raise exception 'School curriculum permission required.';
  end if;

  select jsonb_build_object(
    'sources', coalesce((select jsonb_agg(jsonb_build_object('id',cs.id,'authority',cs.authority,'name',cs.name,'url',cs.source_url,'status',cs.verification_status,'accessed_on',cs.accessed_on) order by cs.name) from public.curriculum_sources cs), '[]'::jsonb),
    'frameworks', coalesce((select jsonb_agg(jsonb_build_object('id',cf.id,'name',cf.name,'version_label',cf.version_label,'status',cf.status,'node_count',(select count(*) from public.curriculum_nodes cn where cn.framework_id=cf.id)) order by cf.name) from public.curriculum_frameworks cf), '[]'::jsonb),
    'school_adoptions', coalesce((select jsonb_agg(jsonb_build_object('framework_id',a.framework_id,'status',a.status,'adopted_at',a.adopted_at)) from public.workspace_curriculum_adoptions a where a.workspace_id=target_workspace_id), '[]'::jsonb),
    'alignment', jsonb_build_object(
      'ksi_objectives', (select count(*) from public.learning_objective_nodes lon where lon.workspace_id=target_workspace_id),
      'verified_links', (select count(*) from public.objective_curriculum_links ocl join public.learning_objective_nodes lon on lon.id=ocl.learning_objective_node_id where lon.workspace_id=target_workspace_id and ocl.alignment_status='verified'),
      'proposed_links', (select count(*) from public.objective_curriculum_links ocl join public.learning_objective_nodes lon on lon.id=ocl.learning_objective_node_id where lon.workspace_id=target_workspace_id and ocl.alignment_status='proposed'),
      'unmapped_objectives', (select count(*) from public.learning_objective_nodes lon where lon.workspace_id=target_workspace_id and not exists (select 1 from public.objective_curriculum_links ocl where ocl.learning_objective_node_id=lon.id and ocl.alignment_status in ('proposed','verified')))
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_curriculum_intelligence(uuid) from public, anon;
grant execute on function public.get_curriculum_intelligence(uuid) to authenticated;
