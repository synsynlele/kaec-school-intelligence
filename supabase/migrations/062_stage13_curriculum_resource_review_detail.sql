-- KSI 2.0 Stage 13 — human review detail/edit support for curriculum learning resources.

create or replace function public.get_curriculum_learning_resource_detail(target_resource_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Platform curriculum-resource authority required.';
  end if;

  select jsonb_build_object(
    'resource', jsonb_build_object(
      'id', clr.id,
      'resource_version', clr.resource_version,
      'title', clr.title,
      'content', clr.content,
      'status', clr.status,
      'provider', clr.provider,
      'model', clr.model,
      'engine_version', clr.engine_version,
      'prompt_version', clr.prompt_version,
      'generated_at', clr.generated_at,
      'reviewed_at', clr.reviewed_at,
      'published_at', clr.published_at
    ),
    'objective', jsonb_build_object(
      'id', cn.id,
      'class_level', cn.class_level,
      'term', cn.term,
      'subject_name', cn.subject_name,
      'title', cn.title,
      'objective_text', cn.objective_text,
      'source_reference', cn.source_reference
    ),
    'framework', jsonb_build_object(
      'id', cf.id,
      'name', cf.name,
      'version_label', cf.version_label
    )
  ) into result
  from public.curriculum_learning_resources clr
  join public.curriculum_nodes cn on cn.id = clr.curriculum_objective_node_id
  join public.curriculum_frameworks cf on cf.id = clr.framework_id
  where clr.id = target_resource_id;

  if result is null then raise exception 'Curriculum learning resource not found.'; end if;
  return result;
end;
$$;

create or replace function public.update_curriculum_learning_resource_draft(
  target_resource_id uuid,
  target_title text,
  target_content jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare resource_row public.curriculum_learning_resources;
declare cleaned_title text := nullif(btrim(coalesce(target_title,'')), '');
begin
  if auth.uid() is null or not private.is_platform_access_admin() then
    raise exception 'Platform curriculum-resource authority required.';
  end if;
  if cleaned_title is null then raise exception 'Resource title is required.'; end if;
  if target_content is null or jsonb_typeof(target_content) <> 'object' then raise exception 'Structured learning-resource content is required.'; end if;

  select * into resource_row
  from public.curriculum_learning_resources
  where id = target_resource_id
  for update;
  if not found then raise exception 'Curriculum learning resource not found.'; end if;
  if resource_row.status not in ('draft','reviewed') then
    raise exception 'Published or retired resources are immutable. Generate a new version instead.';
  end if;

  update public.curriculum_learning_resources
  set title = cleaned_title,
      content = target_content,
      status = 'draft',
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = target_resource_id
  returning * into resource_row;

  return jsonb_build_object(
    'resource_id', resource_row.id,
    'resource_version', resource_row.resource_version,
    'status', resource_row.status,
    'updated_at', resource_row.updated_at
  );
end;
$$;

revoke all on function public.get_curriculum_learning_resource_detail(uuid) from public, anon;
revoke all on function public.update_curriculum_learning_resource_draft(uuid,text,jsonb) from public, anon;
grant execute on function public.get_curriculum_learning_resource_detail(uuid) to authenticated;
grant execute on function public.update_curriculum_learning_resource_draft(uuid,text,jsonb) to authenticated;