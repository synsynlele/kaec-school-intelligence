-- KSI 2.0 Stage 13 — governed curriculum learning-resource engine.
-- Canonical curriculum must already exist through the human review/promotion pipeline.
-- AI may draft student study material, but only platform-admin reviewed + published resources reach students.

create table if not exists public.curriculum_learning_resources (
  id uuid primary key default gen_random_uuid(),
  curriculum_objective_node_id uuid not null references public.curriculum_nodes(id) on delete restrict,
  framework_id uuid not null references public.curriculum_frameworks(id) on delete restrict,
  resource_version integer not null check (resource_version > 0),
  title text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  status text not null default 'draft' check (status in ('draft','reviewed','published','retired')),
  provider text,
  model text,
  engine_version text not null,
  prompt_version text not null,
  generated_by uuid not null references auth.users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_objective_node_id, resource_version)
);

create unique index if not exists curriculum_learning_resources_one_published_idx
  on public.curriculum_learning_resources(curriculum_objective_node_id)
  where status = 'published';
create index if not exists curriculum_learning_resources_framework_idx
  on public.curriculum_learning_resources(framework_id, status, curriculum_objective_node_id);

alter table public.curriculum_learning_resources enable row level security;
revoke all on public.curriculum_learning_resources from anon, authenticated;

create or replace function public.get_curriculum_resource_factory_page(
  target_framework_id uuid default null,
  target_class_level text default null,
  target_subject_name text default null,
  target_limit integer default 50,
  target_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  items_json jsonb;
  total_count integer;
  eligible_count integer;
  published_count integer;
  draft_count integer;
  reviewed_count integer;
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Platform curriculum-resource authority required.';
  end if;
  if target_limit < 1 or target_limit > 100 then raise exception 'Page size must be between 1 and 100.'; end if;
  if target_offset < 0 then raise exception 'Page offset cannot be negative.'; end if;

  select count(*)::int into eligible_count
  from public.curriculum_nodes cn
  where cn.node_type = 'objective';

  select count(*)::int into published_count
  from public.curriculum_learning_resources clr where clr.status = 'published';
  select count(*)::int into draft_count
  from public.curriculum_learning_resources clr where clr.status = 'draft';
  select count(*)::int into reviewed_count
  from public.curriculum_learning_resources clr where clr.status = 'reviewed';

  select count(*)::int into total_count
  from public.curriculum_nodes cn
  where cn.node_type = 'objective'
    and (target_framework_id is null or cn.framework_id = target_framework_id)
    and (target_class_level is null or lower(coalesce(cn.class_level,'')) = lower(target_class_level))
    and (target_subject_name is null or lower(coalesce(cn.subject_name,'')) = lower(target_subject_name));

  select coalesce(jsonb_agg(row_json order by class_level, term, subject_name, position nulls last, title), '[]'::jsonb)
  into items_json
  from (
    select
      jsonb_build_object(
        'curriculum_objective_node_id', cn.id,
        'framework_id', cn.framework_id,
        'framework_name', cf.name,
        'framework_status', cf.status,
        'class_level', cn.class_level,
        'term', cn.term,
        'subject_name', cn.subject_name,
        'title', cn.title,
        'objective_text', cn.objective_text,
        'source_reference', cn.source_reference,
        'position', cn.position,
        'latest_resource', case when clr.id is null then null else jsonb_build_object(
          'id', clr.id,
          'resource_version', clr.resource_version,
          'title', clr.title,
          'status', clr.status,
          'provider', clr.provider,
          'model', clr.model,
          'generated_at', clr.generated_at,
          'reviewed_at', clr.reviewed_at,
          'published_at', clr.published_at
        ) end
      ) row_json,
      coalesce(cn.class_level,'') class_level,
      coalesce(cn.term,'') term,
      coalesce(cn.subject_name,'') subject_name,
      cn.position,
      cn.title
    from public.curriculum_nodes cn
    join public.curriculum_frameworks cf on cf.id = cn.framework_id
    left join lateral (
      select r.*
      from public.curriculum_learning_resources r
      where r.curriculum_objective_node_id = cn.id
        and r.status <> 'retired'
      order by r.resource_version desc
      limit 1
    ) clr on true
    where cn.node_type = 'objective'
      and (target_framework_id is null or cn.framework_id = target_framework_id)
      and (target_class_level is null or lower(coalesce(cn.class_level,'')) = lower(target_class_level))
      and (target_subject_name is null or lower(coalesce(cn.subject_name,'')) = lower(target_subject_name))
    order by cn.class_level, cn.term, cn.subject_name, cn.position nulls last, cn.title
    limit target_limit offset target_offset
  ) q;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'eligible_objectives', eligible_count,
      'published_resources', published_count,
      'draft_resources', draft_count,
      'reviewed_resources', reviewed_count,
      'coverage_percent', case when eligible_count > 0 then round(published_count::numeric / eligible_count::numeric * 100) else 0 end,
      'curriculum_ready', eligible_count > 0
    ),
    'total', total_count,
    'limit', target_limit,
    'offset', target_offset,
    'items', items_json
  );
end;
$$;

create or replace function public.get_curriculum_resource_generation_context(target_curriculum_objective_node_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  node_row public.curriculum_nodes;
  framework_row public.curriculum_frameworks;
  source_row public.curriculum_sources;
  ancestry_json jsonb;
  provenance_json jsonb;
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Platform curriculum-resource authority required.';
  end if;

  select * into node_row
  from public.curriculum_nodes cn
  where cn.id = target_curriculum_objective_node_id and cn.node_type = 'objective';
  if not found then raise exception 'Canonical curriculum objective not found.'; end if;

  select * into framework_row from public.curriculum_frameworks cf where cf.id = node_row.framework_id;
  select * into source_row from public.curriculum_sources cs where cs.id = framework_row.source_id;

  with recursive ancestry as (
    select cn.id, cn.parent_id, cn.node_type, cn.title, cn.class_level, cn.term, cn.subject_name, cn.position, 0 depth
    from public.curriculum_nodes cn where cn.id = node_row.id
    union all
    select parent.id, parent.parent_id, parent.node_type, parent.title, parent.class_level, parent.term, parent.subject_name, parent.position, child.depth + 1
    from public.curriculum_nodes parent
    join ancestry child on child.parent_id = parent.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'node_type', a.node_type,
    'title', a.title,
    'class_level', a.class_level,
    'term', a.term,
    'subject_name', a.subject_name,
    'position', a.position
  ) order by a.depth desc), '[]'::jsonb)
  into ancestry_json
  from ancestry a;

  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'scheme_entry_id', se.id,
    'class_level', se.class_level,
    'term', se.term,
    'week_label', se.week_label,
    'week_number', se.week_number,
    'subject_name', se.subject_name,
    'component_name', se.component_name,
    'topic', se.topic,
    'learning_objectives', se.learning_objectives,
    'learning_activities', se.learning_activities,
    'embedded_core_skills', se.embedded_core_skills,
    'learning_resources', se.learning_resources,
    'source_page', se.source_page,
    'source_reference', se.source_reference,
    'review_status', se.review_status,
    'promoted_at', se.promoted_at
  )), '[]'::jsonb)
  into provenance_json
  from public.scheme_entry_node_links link
  join public.scheme_entries se on se.id = link.scheme_entry_id
  where link.curriculum_node_id = node_row.id
    and se.review_status = 'approved'
    and se.promoted_at is not null;

  return jsonb_build_object(
    'objective', jsonb_build_object(
      'id', node_row.id,
      'title', node_row.title,
      'objective_text', node_row.objective_text,
      'class_level', node_row.class_level,
      'term', node_row.term,
      'subject_name', node_row.subject_name,
      'source_reference', node_row.source_reference,
      'position', node_row.position,
      'metadata', node_row.metadata
    ),
    'framework', jsonb_build_object(
      'id', framework_row.id,
      'name', framework_row.name,
      'version_label', framework_row.version_label,
      'education_level', framework_row.education_level,
      'status', framework_row.status
    ),
    'source', jsonb_build_object(
      'authority', source_row.authority,
      'jurisdiction', source_row.jurisdiction,
      'name', source_row.name,
      'source_kind', source_row.source_kind,
      'verification_status', source_row.verification_status
    ),
    'ancestry', ancestry_json,
    'promoted_scheme_provenance', provenance_json,
    'generation_boundary', jsonb_build_object(
      'source_is_canonical', true,
      'human_publication_required', true,
      'may_invent_curriculum_objectives', false
    )
  );
end;
$$;

create or replace function public.save_curriculum_learning_resource_draft(
  target_curriculum_objective_node_id uuid,
  target_title text,
  target_content jsonb,
  target_provider text,
  target_model text,
  target_engine_version text,
  target_prompt_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  node_row public.curriculum_nodes;
  next_version integer;
  v_resource_id uuid;
  cleaned_title text := nullif(btrim(coalesce(target_title,'')), '');
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Platform curriculum-resource authority required.';
  end if;
  if cleaned_title is null then raise exception 'Resource title is required.'; end if;
  if target_content is null or jsonb_typeof(target_content) <> 'object' then raise exception 'Structured learning-resource content is required.'; end if;
  if nullif(btrim(coalesce(target_engine_version,'')), '') is null then raise exception 'Engine version is required.'; end if;
  if nullif(btrim(coalesce(target_prompt_version,'')), '') is null then raise exception 'Prompt version is required.'; end if;

  select * into node_row
  from public.curriculum_nodes cn
  where cn.id = target_curriculum_objective_node_id and cn.node_type = 'objective'
  for update;
  if not found then raise exception 'Canonical curriculum objective not found.'; end if;

  update public.curriculum_learning_resources
  set status = 'retired', retired_at = now(), updated_at = now()
  where curriculum_objective_node_id = node_row.id
    and status in ('draft','reviewed');

  select coalesce(max(resource_version),0) + 1 into next_version
  from public.curriculum_learning_resources
  where curriculum_objective_node_id = node_row.id;

  insert into public.curriculum_learning_resources(
    curriculum_objective_node_id, framework_id, resource_version, title, content,
    status, provider, model, engine_version, prompt_version, generated_by
  ) values (
    node_row.id, node_row.framework_id, next_version, cleaned_title, target_content,
    'draft', nullif(btrim(coalesce(target_provider,'')), ''), nullif(btrim(coalesce(target_model,'')), ''),
    btrim(target_engine_version), btrim(target_prompt_version), auth.uid()
  ) returning id into v_resource_id;

  return jsonb_build_object('resource_id', v_resource_id, 'resource_version', next_version, 'status', 'draft');
end;
$$;

create or replace function public.review_curriculum_learning_resource(
  target_resource_id uuid,
  target_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resource_row public.curriculum_learning_resources;
  action_value text := lower(btrim(coalesce(target_action,'')));
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Platform curriculum-resource authority required.';
  end if;
  if action_value not in ('review','publish','retire') then raise exception 'Invalid curriculum-resource action.'; end if;

  select * into resource_row from public.curriculum_learning_resources where id = target_resource_id for update;
  if not found then raise exception 'Curriculum learning resource not found.'; end if;

  if action_value = 'review' then
    if resource_row.status <> 'draft' then raise exception 'Only a draft resource can enter review.'; end if;
    update public.curriculum_learning_resources
    set status = 'reviewed', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = target_resource_id;
  elsif action_value = 'publish' then
    if resource_row.status <> 'reviewed' then raise exception 'A resource must be reviewed before publication.'; end if;
    update public.curriculum_learning_resources
    set status = 'retired', retired_at = now(), updated_at = now()
    where curriculum_objective_node_id = resource_row.curriculum_objective_node_id
      and status = 'published'
      and id <> target_resource_id;
    update public.curriculum_learning_resources
    set status = 'published', published_by = auth.uid(), published_at = now(), retired_at = null, updated_at = now()
    where id = target_resource_id;
  else
    update public.curriculum_learning_resources
    set status = 'retired', retired_at = now(), updated_at = now()
    where id = target_resource_id;
  end if;

  select * into resource_row from public.curriculum_learning_resources where id = target_resource_id;
  return jsonb_build_object(
    'resource_id', resource_row.id,
    'status', resource_row.status,
    'reviewed_at', resource_row.reviewed_at,
    'published_at', resource_row.published_at,
    'retired_at', resource_row.retired_at
  );
end;
$$;

create or replace function public.get_my_curriculum_learning_resources()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_row public.student_accounts;
  student_row public.students;
  class_name text;
  canonical_count integer;
  published_count integer;
  resources_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select sa.* into account_row
  from public.student_accounts sa
  join public.workspaces w on w.id = sa.workspace_id
  where sa.user_id = auth.uid() and sa.active = true and w.access_status = 'active'
  limit 1;
  if not found then raise exception 'No active KSI student account is available.'; end if;

  select * into student_row
  from public.students s
  where s.id = account_row.student_id and s.workspace_id = account_row.workspace_id and s.active = true;
  if not found then raise exception 'Student learning record is unavailable.'; end if;

  select c.name into class_name
  from public.classes c where c.id = student_row.class_id and c.workspace_id = student_row.workspace_id;

  select count(*)::int into canonical_count
  from public.workspace_curriculum_adoptions wca
  join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
  where wca.workspace_id = account_row.workspace_id
    and wca.status = 'active'
    and upper(replace(coalesce(cn.class_level,''),' ','')) = upper(replace(coalesce(class_name,''),' ',''));

  select count(*)::int into published_count
  from public.workspace_curriculum_adoptions wca
  join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
  join public.curriculum_learning_resources clr on clr.curriculum_objective_node_id = cn.id and clr.status = 'published'
  where wca.workspace_id = account_row.workspace_id
    and wca.status = 'active'
    and upper(replace(coalesce(cn.class_level,''),' ','')) = upper(replace(coalesce(class_name,''),' ',''));

  select coalesce(jsonb_agg(jsonb_build_object(
    'resource_id', clr.id,
    'curriculum_objective_node_id', cn.id,
    'framework_id', cn.framework_id,
    'class_level', cn.class_level,
    'term', cn.term,
    'subject_name', cn.subject_name,
    'topic', cn.title,
    'objective', cn.objective_text,
    'source_reference', cn.source_reference,
    'title', clr.title,
    'content', clr.content,
    'resource_version', clr.resource_version,
    'published_at', clr.published_at
  ) order by cn.term, cn.subject_name, cn.position nulls last, cn.title), '[]'::jsonb)
  into resources_json
  from public.workspace_curriculum_adoptions wca
  join public.curriculum_nodes cn on cn.framework_id = wca.framework_id and cn.node_type = 'objective'
  join public.curriculum_learning_resources clr on clr.curriculum_objective_node_id = cn.id and clr.status = 'published'
  where wca.workspace_id = account_row.workspace_id
    and wca.status = 'active'
    and upper(replace(coalesce(cn.class_level,''),' ','')) = upper(replace(coalesce(class_name,''),' ',''));

  return jsonb_build_object(
    'student_id', account_row.student_id,
    'class_name', class_name,
    'readiness', jsonb_build_object(
      'canonical_objectives', canonical_count,
      'published_resources', published_count,
      'coverage_percent', case when canonical_count > 0 then round(published_count::numeric / canonical_count::numeric * 100) else 0 end,
      'curriculum_promoted', canonical_count > 0,
      'resource_library_live', published_count > 0
    ),
    'resources', resources_json
  );
end;
$$;

revoke all on function public.get_curriculum_resource_factory_page(uuid,text,text,integer,integer) from public, anon;
revoke all on function public.get_curriculum_resource_generation_context(uuid) from public, anon;
revoke all on function public.save_curriculum_learning_resource_draft(uuid,text,jsonb,text,text,text,text) from public, anon;
revoke all on function public.review_curriculum_learning_resource(uuid,text) from public, anon;
revoke all on function public.get_my_curriculum_learning_resources() from public, anon;

grant execute on function public.get_curriculum_resource_factory_page(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.get_curriculum_resource_generation_context(uuid) to authenticated;
grant execute on function public.save_curriculum_learning_resource_draft(uuid,text,jsonb,text,text,text,text) to authenticated;
grant execute on function public.review_curriculum_learning_resource(uuid,text) to authenticated;
grant execute on function public.get_my_curriculum_learning_resources() to authenticated;