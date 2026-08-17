-- Stage 12 — Scheme review queue and guarded promotion into the Lagos sequencing graph.

create or replace function public.get_scheme_review_queue(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id,array['owner','admin','leader','teacher']) then raise exception 'School curriculum permission required.'; end if;
  select jsonb_build_object(
    'can_review', private.is_platform_access_admin(),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'document_id',e.document_id,'filename',d.original_filename,'education_level',d.education_level,'class_level',e.class_level,'term',e.term,'week_label',e.week_label,'week_number',e.week_number,'subject',e.subject_name,'component',e.component_name,'topic',e.topic,'learning_objectives',e.learning_objectives,'learning_activities',e.learning_activities,'embedded_core_skills',e.embedded_core_skills,'learning_resources',e.learning_resources,'source_page',e.source_page,'source_reference',e.source_reference,'review_status',e.review_status,'review_note',e.review_note,'promoted_at',e.promoted_at
    ) order by d.education_level,e.class_level,e.term,e.week_number nulls last,e.subject_name,e.topic)
    from public.scheme_entries e join public.scheme_documents d on d.id=e.document_id where e.review_status in ('pending','approved')),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function public.promote_scheme_entry(target_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.scheme_entries%rowtype; d public.scheme_documents%rowtype;
  class_node uuid; term_node uuid; week_node uuid; subject_node uuid; topic_node uuid; objective_node uuid;
  objective_value jsonb; objective_position integer := 0; term_slug text; subject_slug text; week_slug text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then raise exception 'Platform curriculum admin permission required.'; end if;
  select * into e from public.scheme_entries where id=target_entry_id for update;
  if not found then raise exception 'Scheme entry not found.'; end if;
  if e.review_status <> 'approved' then raise exception 'Only approved scheme entries can be promoted.'; end if;
  if e.promoted_at is not null then return jsonb_build_object('entry_id',e.id,'status','already_promoted'); end if;
  select * into d from public.scheme_documents where id=e.document_id;
  term_slug := regexp_replace(lower(e.term),'[^a-z0-9]+','-','g');
  subject_slug := trim(both '-' from regexp_replace(lower(e.subject_name),'[^a-z0-9]+','-','g'));
  week_slug := case when e.week_number is not null then e.week_number::text else trim(both '-' from regexp_replace(lower(e.week_label),'[^a-z0-9]+','-','g')) end;

  insert into public.curriculum_nodes(framework_id,node_type,node_key,title,class_level,position,source_reference,metadata)
  values(d.framework_id,'class','class:'||lower(e.class_level),e.class_level,e.class_level,null,e.source_reference,jsonb_build_object('source_kind','state_scheme'))
  on conflict (framework_id,node_key) do update set updated_at=now() returning id into class_node;
  if class_node is null then select id into class_node from public.curriculum_nodes where framework_id=d.framework_id and node_key='class:'||lower(e.class_level); end if;

  insert into public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,position,source_reference,metadata)
  values(d.framework_id,class_node,'term','class:'||lower(e.class_level)||':term:'||term_slug,e.term,e.class_level,e.term,null,e.source_reference,jsonb_build_object('source_kind','state_scheme'))
  on conflict (framework_id,node_key) do update set updated_at=now() returning id into term_node;
  if term_node is null then select id into term_node from public.curriculum_nodes where framework_id=d.framework_id and node_key='class:'||lower(e.class_level)||':term:'||term_slug; end if;

  insert into public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,position,source_reference,metadata)
  values(d.framework_id,term_node,'week','class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug,e.week_label,e.class_level,e.term,e.week_number,e.source_reference,jsonb_build_object('source_kind','state_scheme','week_number',e.week_number))
  on conflict (framework_id,node_key) do update set title=excluded.title,position=excluded.position,updated_at=now() returning id into week_node;
  if week_node is null then select id into week_node from public.curriculum_nodes where framework_id=d.framework_id and node_key='class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug; end if;

  insert into public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,source_reference,metadata)
  values(d.framework_id,week_node,'subject','class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug||':subject:'||subject_slug,e.subject_name,e.class_level,e.term,e.subject_name,e.source_reference,jsonb_build_object('source_kind','state_scheme','component_name',e.component_name))
  on conflict (framework_id,node_key) do update set updated_at=now() returning id into subject_node;
  if subject_node is null then select id into subject_node from public.curriculum_nodes where framework_id=d.framework_id and node_key='class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug||':subject:'||subject_slug; end if;

  insert into public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,source_reference,metadata)
  values(d.framework_id,subject_node,'topic','scheme-entry:'||e.id::text||':topic',e.topic,e.class_level,e.term,e.subject_name,e.source_reference,jsonb_build_object('source_kind','state_scheme','scheme_entry_id',e.id,'learning_activities',e.learning_activities,'embedded_core_skills',e.embedded_core_skills,'learning_resources',e.learning_resources))
  on conflict (framework_id,node_key) do update set title=excluded.title,metadata=excluded.metadata,updated_at=now() returning id into topic_node;
  if topic_node is null then select id into topic_node from public.curriculum_nodes where framework_id=d.framework_id and node_key='scheme-entry:'||e.id::text||':topic'; end if;

  insert into public.scheme_entry_node_links(scheme_entry_id,curriculum_node_id,link_role) values
    (e.id,class_node,'class'),(e.id,term_node,'term'),(e.id,week_node,'week'),(e.id,subject_node,'subject'),(e.id,topic_node,'topic') on conflict do nothing;

  for objective_value in select value from jsonb_array_elements(e.learning_objectives) loop
    objective_position := objective_position + 1;
    insert into public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,objective_text,source_reference,position,metadata)
    values(d.framework_id,topic_node,'objective','scheme-entry:'||e.id::text||':objective:'||objective_position::text,trim(both '"' from objective_value::text),e.class_level,e.term,e.subject_name,trim(both '"' from objective_value::text),e.source_reference,objective_position,jsonb_build_object('source_kind','state_scheme','scheme_entry_id',e.id))
    on conflict (framework_id,node_key) do update set title=excluded.title,objective_text=excluded.objective_text,updated_at=now() returning id into objective_node;
    if objective_node is null then select id into objective_node from public.curriculum_nodes where framework_id=d.framework_id and node_key='scheme-entry:'||e.id::text||':objective:'||objective_position::text; end if;
    insert into public.scheme_entry_node_links(scheme_entry_id,curriculum_node_id,link_role) values(e.id,objective_node,'objective') on conflict do nothing;
  end loop;
  update public.scheme_entries set promoted_at=now(),updated_at=now() where id=e.id;
  update public.scheme_documents set extraction_status='ingested',updated_at=now() where id=e.document_id;
  return jsonb_build_object('entry_id',e.id,'status','promoted','objective_nodes',objective_position);
end; $$;

revoke all on function public.get_scheme_review_queue(uuid), public.promote_scheme_entry(uuid) from public, anon;
grant execute on function public.get_scheme_review_queue(uuid), public.promote_scheme_entry(uuid) to authenticated;
