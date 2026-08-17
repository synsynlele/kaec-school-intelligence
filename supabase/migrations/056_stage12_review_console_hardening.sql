-- KSI Stage 12 — Curriculum review console hardening
-- Review and promotion remain separate, explicit, platform-admin actions.

DO $$
BEGIN
  IF to_regclass('public.scheme_entries') IS NULL
     OR to_regclass('public.scheme_documents') IS NULL
     OR to_regclass('public.curriculum_nodes') IS NULL THEN
    RAISE EXCEPTION 'Stage 12 curriculum and scheme foundations must exist before review-console hardening.';
  END IF;
END;
$$;

ALTER TABLE public.scheme_entry_node_links
  DROP CONSTRAINT IF EXISTS scheme_entry_node_links_link_role_check;
ALTER TABLE public.scheme_entry_node_links
  ADD CONSTRAINT scheme_entry_node_links_link_role_check
  CHECK (link_role IN ('class','term','week','subject','strand','topic','objective'));

CREATE OR REPLACE FUNCTION private.refresh_scheme_review_state(
  target_document_id uuid,
  target_batch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_rows integer := 0;
  pending_rows integer := 0;
  approved_rows integer := 0;
  rejected_rows integer := 0;
  unpromoted_approved integer := 0;
BEGIN
  IF target_batch_id IS NOT NULL THEN
    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE review_status = 'pending')::integer,
      count(*) FILTER (WHERE review_status = 'approved')::integer,
      count(*) FILTER (WHERE review_status = 'rejected')::integer
    INTO total_rows, pending_rows, approved_rows, rejected_rows
    FROM public.scheme_entries
    WHERE batch_id = target_batch_id;

    UPDATE public.scheme_ingestion_batches
    SET status = CASE
      WHEN total_rows = 0 THEN 'review'
      WHEN pending_rows > 0 THEN 'review'
      WHEN approved_rows = total_rows THEN 'approved'
      WHEN rejected_rows = total_rows THEN 'rejected'
      ELSE 'review'
    END,
    reviewed_by = CASE WHEN pending_rows = 0 THEN auth.uid() ELSE reviewed_by END,
    reviewed_at = CASE WHEN pending_rows = 0 THEN now() ELSE reviewed_at END
    WHERE id = target_batch_id;
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE review_status = 'pending')::integer,
    count(*) FILTER (WHERE review_status = 'approved')::integer,
    count(*) FILTER (WHERE review_status = 'rejected')::integer,
    count(*) FILTER (WHERE review_status = 'approved' AND promoted_at IS NULL)::integer
  INTO total_rows, pending_rows, approved_rows, rejected_rows, unpromoted_approved
  FROM public.scheme_entries
  WHERE document_id = target_document_id;

  UPDATE public.scheme_documents
  SET extraction_status = CASE
    WHEN total_rows = 0 THEN 'registered'
    WHEN pending_rows > 0 THEN 'staged'
    WHEN approved_rows = 0 AND rejected_rows = total_rows THEN 'blocked'
    WHEN approved_rows > 0 AND unpromoted_approved = 0 THEN 'ingested'
    ELSE 'reviewed'
  END,
  updated_at = now()
  WHERE id = target_document_id;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_scheme_review_state(uuid,uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_scheme_review_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND private.is_platform_access_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_scheme_review_console(target_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF NOT private.has_workspace_role(target_workspace_id, ARRAY['owner','admin','leader','teacher']) THEN
    RAISE EXCEPTION 'Active workspace permission required.';
  END IF;

  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'documents', (SELECT count(*) FROM public.scheme_documents),
      'staged_documents', (SELECT count(*) FROM public.scheme_documents WHERE extraction_status = 'staged'),
      'reviewed_documents', (SELECT count(*) FROM public.scheme_documents WHERE extraction_status = 'reviewed'),
      'ingested_documents', (SELECT count(*) FROM public.scheme_documents WHERE extraction_status = 'ingested'),
      'blocked_documents', (SELECT count(*) FROM public.scheme_documents WHERE extraction_status = 'blocked'),
      'entries', (SELECT count(*) FROM public.scheme_entries),
      'pending', (SELECT count(*) FROM public.scheme_entries WHERE review_status = 'pending'),
      'approved_unpromoted', (SELECT count(*) FROM public.scheme_entries WHERE review_status = 'approved' AND promoted_at IS NULL),
      'rejected', (SELECT count(*) FROM public.scheme_entries WHERE review_status = 'rejected'),
      'promoted', (SELECT count(*) FROM public.scheme_entries WHERE promoted_at IS NOT NULL)
    ),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'filename', d.original_filename,
        'subject', d.subject_name,
        'education_level', d.education_level,
        'class_scope', d.class_scope,
        'provenance_status', d.provenance_status,
        'extraction_status', d.extraction_status,
        'metadata', d.metadata,
        'entries', (SELECT count(*) FROM public.scheme_entries e WHERE e.document_id = d.id),
        'pending', (SELECT count(*) FROM public.scheme_entries e WHERE e.document_id = d.id AND e.review_status = 'pending'),
        'approved_unpromoted', (SELECT count(*) FROM public.scheme_entries e WHERE e.document_id = d.id AND e.review_status = 'approved' AND e.promoted_at IS NULL),
        'rejected', (SELECT count(*) FROM public.scheme_entries e WHERE e.document_id = d.id AND e.review_status = 'rejected'),
        'promoted', (SELECT count(*) FROM public.scheme_entries e WHERE e.document_id = d.id AND e.promoted_at IS NOT NULL)
      ) ORDER BY d.education_level, d.subject_name, d.original_filename)
      FROM public.scheme_documents d
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_scheme_review_page(
  target_workspace_id uuid,
  target_document_id uuid DEFAULT NULL,
  target_status text DEFAULT 'pending',
  target_class_level text DEFAULT NULL,
  target_term text DEFAULT NULL,
  target_limit integer DEFAULT 100,
  target_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF NOT private.has_workspace_role(target_workspace_id, ARRAY['owner','admin','leader','teacher']) THEN
    RAISE EXCEPTION 'Active workspace permission required.';
  END IF;
  IF target_status NOT IN ('pending','approved','rejected','promoted','all') THEN
    RAISE EXCEPTION 'Unsupported review filter.';
  END IF;
  IF target_class_level IS NOT NULL AND target_class_level NOT IN ('JSS1','JSS2','JSS3','SS1','SS2','SS3') THEN
    RAISE EXCEPTION 'Invalid class filter.';
  END IF;
  IF target_term IS NOT NULL AND target_term NOT IN ('First Term','Second Term','Third Term') THEN
    RAISE EXCEPTION 'Invalid term filter.';
  END IF;
  IF target_limit < 1 OR target_limit > 200 THEN RAISE EXCEPTION 'Page size must be between 1 and 200.'; END IF;
  IF target_offset < 0 THEN RAISE EXCEPTION 'Offset cannot be negative.'; END IF;

  WITH filtered AS (
    SELECT e.*, d.original_filename, d.education_level
    FROM public.scheme_entries e
    JOIN public.scheme_documents d ON d.id = e.document_id
    WHERE (target_document_id IS NULL OR e.document_id = target_document_id)
      AND (target_class_level IS NULL OR e.class_level = target_class_level)
      AND (target_term IS NULL OR e.term = target_term)
      AND (
        target_status = 'all'
        OR (target_status = 'pending' AND e.review_status = 'pending')
        OR (target_status = 'approved' AND e.review_status = 'approved' AND e.promoted_at IS NULL)
        OR (target_status = 'rejected' AND e.review_status = 'rejected')
        OR (target_status = 'promoted' AND e.promoted_at IS NOT NULL)
      )
  ), page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY education_level, class_level, term, week_number NULLS LAST, week_label, subject_name, component_name NULLS FIRST, topic, id
    LIMIT target_limit OFFSET target_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'limit', target_limit,
    'offset', target_offset,
    'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'document_id', p.document_id,
      'filename', p.original_filename,
      'education_level', p.education_level,
      'class_level', p.class_level,
      'term', p.term,
      'week_label', p.week_label,
      'week_number', p.week_number,
      'subject', p.subject_name,
      'component', p.component_name,
      'topic', p.topic,
      'learning_objectives', p.learning_objectives,
      'learning_activities', p.learning_activities,
      'embedded_core_skills', p.embedded_core_skills,
      'learning_resources', p.learning_resources,
      'source_page', p.source_page,
      'source_reference', p.source_reference,
      'review_status', p.review_status,
      'review_note', p.review_note,
      'reviewed_at', p.reviewed_at,
      'promoted_at', p.promoted_at
    )) FROM page_rows p), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_scheme_entry(target_entry_id uuid, target_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.scheme_entries%rowtype;
  changed public.scheme_entries%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN RAISE EXCEPTION 'Platform curriculum admin permission required.'; END IF;
  IF jsonb_typeof(target_patch) <> 'object' THEN RAISE EXCEPTION 'Patch must be a JSON object.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(target_patch) AS k(key)
    WHERE key NOT IN (
      'class_level','term','week_label','week_number','component_name','topic',
      'learning_objectives','learning_activities','embedded_core_skills','learning_resources',
      'source_page','source_reference'
    )
  ) THEN
    RAISE EXCEPTION 'Patch contains a field that cannot be edited.';
  END IF;

  SELECT * INTO e FROM public.scheme_entries WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme entry not found.'; END IF;
  IF e.promoted_at IS NOT NULL THEN RAISE EXCEPTION 'Promoted scheme entries are immutable.'; END IF;

  IF target_patch ? 'learning_objectives' AND jsonb_typeof(target_patch->'learning_objectives') <> 'array' THEN RAISE EXCEPTION 'learning_objectives must be an array.'; END IF;
  IF target_patch ? 'learning_activities' AND jsonb_typeof(target_patch->'learning_activities') <> 'array' THEN RAISE EXCEPTION 'learning_activities must be an array.'; END IF;
  IF target_patch ? 'embedded_core_skills' AND jsonb_typeof(target_patch->'embedded_core_skills') <> 'array' THEN RAISE EXCEPTION 'embedded_core_skills must be an array.'; END IF;
  IF target_patch ? 'learning_resources' AND jsonb_typeof(target_patch->'learning_resources') <> 'array' THEN RAISE EXCEPTION 'learning_resources must be an array.'; END IF;

  UPDATE public.scheme_entries
  SET
    class_level = CASE WHEN target_patch ? 'class_level' THEN target_patch->>'class_level' ELSE e.class_level END,
    term = CASE WHEN target_patch ? 'term' THEN target_patch->>'term' ELSE e.term END,
    week_label = CASE WHEN target_patch ? 'week_label' THEN target_patch->>'week_label' ELSE e.week_label END,
    week_number = CASE WHEN target_patch ? 'week_number' THEN NULLIF(target_patch->>'week_number','')::integer ELSE e.week_number END,
    component_name = CASE WHEN target_patch ? 'component_name' THEN NULLIF(btrim(target_patch->>'component_name'),'') ELSE e.component_name END,
    topic = CASE WHEN target_patch ? 'topic' THEN target_patch->>'topic' ELSE e.topic END,
    learning_objectives = CASE WHEN target_patch ? 'learning_objectives' THEN target_patch->'learning_objectives' ELSE e.learning_objectives END,
    learning_activities = CASE WHEN target_patch ? 'learning_activities' THEN target_patch->'learning_activities' ELSE e.learning_activities END,
    embedded_core_skills = CASE WHEN target_patch ? 'embedded_core_skills' THEN target_patch->'embedded_core_skills' ELSE e.embedded_core_skills END,
    learning_resources = CASE WHEN target_patch ? 'learning_resources' THEN target_patch->'learning_resources' ELSE e.learning_resources END,
    source_page = CASE WHEN target_patch ? 'source_page' THEN NULLIF(target_patch->>'source_page','')::integer ELSE e.source_page END,
    source_reference = CASE WHEN target_patch ? 'source_reference' THEN NULLIF(btrim(target_patch->>'source_reference'),'') ELSE e.source_reference END,
    review_status = 'pending',
    review_note = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now()
  WHERE id = target_entry_id
  RETURNING * INTO changed;

  IF btrim(changed.week_label) = '' OR btrim(changed.topic) = '' THEN RAISE EXCEPTION 'Week label and topic are required.'; END IF;
  PERFORM private.refresh_scheme_review_state(changed.document_id, changed.batch_id);

  RETURN jsonb_build_object('entry_id', changed.id, 'status', changed.review_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_scheme_entry(
  target_entry_id uuid,
  target_status text,
  target_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_row public.scheme_entries%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN RAISE EXCEPTION 'Platform curriculum admin permission required.'; END IF;
  IF target_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Review status must be approved or rejected.'; END IF;

  SELECT * INTO entry_row FROM public.scheme_entries WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme entry not found.'; END IF;
  IF entry_row.promoted_at IS NOT NULL THEN RAISE EXCEPTION 'Promoted scheme entries are immutable.'; END IF;

  UPDATE public.scheme_entries
  SET review_status = target_status,
      review_note = NULLIF(btrim(target_review_note),''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = target_entry_id
  RETURNING * INTO entry_row;

  PERFORM private.refresh_scheme_review_state(entry_row.document_id, entry_row.batch_id);
  RETURN jsonb_build_object('entry_id', entry_row.id, 'status', target_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_scheme_entries_bulk(
  target_entry_ids uuid[],
  target_status text,
  target_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_count integer;
  found_count integer;
  touched record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN RAISE EXCEPTION 'Platform curriculum admin permission required.'; END IF;
  IF target_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Review status must be approved or rejected.'; END IF;
  IF target_entry_ids IS NULL OR cardinality(target_entry_ids) = 0 THEN RAISE EXCEPTION 'Select at least one scheme entry.'; END IF;

  SELECT count(*) INTO requested_count FROM (SELECT DISTINCT unnest(target_entry_ids) AS id) ids;
  SELECT count(*) INTO found_count FROM public.scheme_entries WHERE id = ANY(target_entry_ids);
  IF found_count <> requested_count THEN RAISE EXCEPTION 'One or more selected scheme entries no longer exist.'; END IF;
  IF EXISTS (SELECT 1 FROM public.scheme_entries WHERE id = ANY(target_entry_ids) AND promoted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Promoted scheme entries are immutable.';
  END IF;

  UPDATE public.scheme_entries
  SET review_status = target_status,
      review_note = NULLIF(btrim(target_review_note),''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = ANY(target_entry_ids);

  FOR touched IN
    SELECT DISTINCT document_id, batch_id
    FROM public.scheme_entries
    WHERE id = ANY(target_entry_ids)
  LOOP
    PERFORM private.refresh_scheme_review_state(touched.document_id, touched.batch_id);
  END LOOP;

  RETURN jsonb_build_object('updated', requested_count, 'status', target_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_scheme_entry(target_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.scheme_entries%rowtype;
  d public.scheme_documents%rowtype;
  class_node uuid;
  term_node uuid;
  week_node uuid;
  subject_node uuid;
  strand_node uuid;
  topic_parent uuid;
  topic_node uuid;
  objective_node uuid;
  objective_value jsonb;
  objective_text_value text;
  objective_position integer := 0;
  term_slug text;
  subject_slug text;
  component_slug text;
  week_slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN RAISE EXCEPTION 'Platform curriculum admin permission required.'; END IF;

  SELECT * INTO e FROM public.scheme_entries WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme entry not found.'; END IF;
  IF e.review_status <> 'approved' THEN RAISE EXCEPTION 'Only approved scheme entries can be promoted.'; END IF;
  IF e.promoted_at IS NOT NULL THEN RETURN jsonb_build_object('entry_id',e.id,'status','already_promoted'); END IF;
  SELECT * INTO d FROM public.scheme_documents WHERE id = e.document_id;

  term_slug := trim(both '-' from regexp_replace(lower(e.term),'[^a-z0-9]+','-','g'));
  subject_slug := trim(both '-' from regexp_replace(lower(e.subject_name),'[^a-z0-9]+','-','g'));
  component_slug := trim(both '-' from regexp_replace(lower(coalesce(e.component_name,'')),'[^a-z0-9]+','-','g'));
  week_slug := CASE WHEN e.week_number IS NOT NULL THEN e.week_number::text ELSE trim(both '-' from regexp_replace(lower(e.week_label),'[^a-z0-9]+','-','g')) END;

  INSERT INTO public.curriculum_nodes(framework_id,node_type,node_key,title,class_level,position,source_reference,metadata)
  VALUES(d.framework_id,'class','class:'||lower(e.class_level),e.class_level,e.class_level,NULL,e.source_reference,jsonb_build_object('source_kind','state_scheme'))
  ON CONFLICT (framework_id,node_key) DO UPDATE SET title=excluded.title,source_reference=excluded.source_reference,updated_at=now()
  RETURNING id INTO class_node;

  INSERT INTO public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,position,source_reference,metadata)
  VALUES(d.framework_id,class_node,'term','class:'||lower(e.class_level)||':term:'||term_slug,e.term,e.class_level,e.term,NULL,e.source_reference,jsonb_build_object('source_kind','state_scheme'))
  ON CONFLICT (framework_id,node_key) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,source_reference=excluded.source_reference,updated_at=now()
  RETURNING id INTO term_node;

  INSERT INTO public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,position,source_reference,metadata)
  VALUES(d.framework_id,term_node,'week','class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug,e.week_label,e.class_level,e.term,e.week_number,e.source_reference,jsonb_build_object('source_kind','state_scheme','week_number',e.week_number))
  ON CONFLICT (framework_id,node_key) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,position=excluded.position,source_reference=excluded.source_reference,metadata=excluded.metadata,updated_at=now()
  RETURNING id INTO week_node;

  INSERT INTO public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,source_reference,metadata)
  VALUES(d.framework_id,week_node,'subject','class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug||':subject:'||subject_slug,e.subject_name,e.class_level,e.term,e.subject_name,e.source_reference,jsonb_build_object('source_kind','state_scheme'))
  ON CONFLICT (framework_id,node_key) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,source_reference=excluded.source_reference,metadata=excluded.metadata,updated_at=now()
  RETURNING id INTO subject_node;

  topic_parent := subject_node;
  IF component_slug <> '' THEN
    INSERT INTO public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,source_reference,metadata)
    VALUES(d.framework_id,subject_node,'strand','class:'||lower(e.class_level)||':term:'||term_slug||':week:'||week_slug||':subject:'||subject_slug||':strand:'||component_slug,e.component_name,e.class_level,e.term,e.subject_name,e.source_reference,jsonb_build_object('source_kind','state_scheme','component_name',e.component_name))
    ON CONFLICT (framework_id,node_key) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,source_reference=excluded.source_reference,metadata=excluded.metadata,updated_at=now()
    RETURNING id INTO strand_node;
    topic_parent := strand_node;
  END IF;

  INSERT INTO public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,source_reference,metadata)
  VALUES(d.framework_id,topic_parent,'topic','scheme-entry:'||e.id::text||':topic',e.topic,e.class_level,e.term,e.subject_name,e.source_reference,
    jsonb_build_object('source_kind','state_scheme','scheme_entry_id',e.id,'component_name',e.component_name,'learning_activities',e.learning_activities,'embedded_core_skills',e.embedded_core_skills,'learning_resources',e.learning_resources))
  ON CONFLICT (framework_id,node_key) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,source_reference=excluded.source_reference,metadata=excluded.metadata,updated_at=now()
  RETURNING id INTO topic_node;

  INSERT INTO public.scheme_entry_node_links(scheme_entry_id,curriculum_node_id,link_role) VALUES
    (e.id,class_node,'class'),(e.id,term_node,'term'),(e.id,week_node,'week'),(e.id,subject_node,'subject'),(e.id,topic_node,'topic')
  ON CONFLICT DO NOTHING;
  IF strand_node IS NOT NULL THEN
    INSERT INTO public.scheme_entry_node_links(scheme_entry_id,curriculum_node_id,link_role)
    VALUES(e.id,strand_node,'strand') ON CONFLICT DO NOTHING;
  END IF;

  FOR objective_value IN SELECT value FROM jsonb_array_elements(e.learning_objectives)
  LOOP
    objective_text_value := btrim(coalesce(objective_value #>> '{}', objective_value::text));
    IF objective_text_value = '' THEN CONTINUE; END IF;
    objective_position := objective_position + 1;
    INSERT INTO public.curriculum_nodes(framework_id,parent_id,node_type,node_key,title,class_level,term,subject_name,objective_text,source_reference,position,metadata)
    VALUES(d.framework_id,topic_node,'objective','scheme-entry:'||e.id::text||':objective:'||objective_position::text,objective_text_value,e.class_level,e.term,e.subject_name,objective_text_value,e.source_reference,objective_position,jsonb_build_object('source_kind','state_scheme','scheme_entry_id',e.id,'component_name',e.component_name))
    ON CONFLICT (framework_id,node_key) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,objective_text=excluded.objective_text,source_reference=excluded.source_reference,position=excluded.position,metadata=excluded.metadata,updated_at=now()
    RETURNING id INTO objective_node;
    INSERT INTO public.scheme_entry_node_links(scheme_entry_id,curriculum_node_id,link_role)
    VALUES(e.id,objective_node,'objective') ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.scheme_entries SET promoted_at=now(),updated_at=now() WHERE id=e.id;
  PERFORM private.refresh_scheme_review_state(e.document_id, e.batch_id);
  RETURN jsonb_build_object('entry_id',e.id,'status','promoted','objective_nodes',objective_position,'strand_preserved',strand_node IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_scheme_entries_bulk(target_entry_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_count integer;
  found_count integer;
  before_count integer;
  after_count integer;
  entry_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN RAISE EXCEPTION 'Platform curriculum admin permission required.'; END IF;
  IF target_entry_ids IS NULL OR cardinality(target_entry_ids) = 0 THEN RAISE EXCEPTION 'Select at least one scheme entry.'; END IF;

  SELECT count(*) INTO requested_count FROM (SELECT DISTINCT unnest(target_entry_ids) AS id) ids;
  SELECT count(*) INTO found_count FROM public.scheme_entries WHERE id = ANY(target_entry_ids);
  IF found_count <> requested_count THEN RAISE EXCEPTION 'One or more selected scheme entries no longer exist.'; END IF;
  IF EXISTS (SELECT 1 FROM public.scheme_entries WHERE id = ANY(target_entry_ids) AND review_status <> 'approved') THEN
    RAISE EXCEPTION 'Every selected scheme entry must be approved before promotion.';
  END IF;

  SELECT count(*) INTO before_count FROM public.scheme_entries WHERE id = ANY(target_entry_ids) AND promoted_at IS NOT NULL;
  FOR entry_id IN SELECT DISTINCT unnest(target_entry_ids)
  LOOP
    PERFORM public.promote_scheme_entry(entry_id);
  END LOOP;
  SELECT count(*) INTO after_count FROM public.scheme_entries WHERE id = ANY(target_entry_ids) AND promoted_at IS NOT NULL;

  RETURN jsonb_build_object('requested',requested_count,'newly_promoted',after_count-before_count,'already_promoted',before_count);
END;
$$;

REVOKE ALL ON FUNCTION public.get_scheme_review_access() FROM public, anon;
REVOKE ALL ON FUNCTION public.get_scheme_review_console(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_scheme_review_page(uuid,uuid,text,text,text,integer,integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.update_scheme_entry(uuid,jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.review_scheme_entry(uuid,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.review_scheme_entries_bulk(uuid[],text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.promote_scheme_entry(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.promote_scheme_entries_bulk(uuid[]) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_scheme_review_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheme_review_console(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheme_review_page(uuid,uuid,text,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_scheme_entry(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_scheme_entry(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_scheme_entries_bulk(uuid[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_scheme_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_scheme_entries_bulk(uuid[]) TO authenticated;
