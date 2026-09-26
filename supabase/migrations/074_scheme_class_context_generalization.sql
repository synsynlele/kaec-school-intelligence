-- KSI 2.2 — Scheme class-context generalisation.
-- Operational classes come from each school's Academic Setup.
-- Scheme source classes come from each registered document's class_scope.
-- Existing JSS/SS source data is preserved unchanged.

ALTER TABLE public.scheme_entries
  DROP CONSTRAINT IF EXISTS scheme_entries_class_level_check;

ALTER TABLE public.scheme_entries
  ADD CONSTRAINT scheme_entries_class_level_check
  CHECK (
    char_length(btrim(class_level)) BETWEEN 1 AND 80
  );

CREATE OR REPLACE FUNCTION private.normalize_scheme_class_label(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

REVOKE ALL ON FUNCTION private.normalize_scheme_class_label(text)
FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.stage_scheme_entries(
  target_document_id uuid,
  target_entries jsonb,
  extraction_method text DEFAULT 'structured_import'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc public.scheme_documents%rowtype;
  batch_id uuid;
  item jsonb;
  inserted_count integer := 0;
  resolved_class text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF jsonb_typeof(target_entries) <> 'array' OR jsonb_array_length(target_entries) = 0 THEN
    RAISE EXCEPTION 'A non-empty structured extraction is required.';
  END IF;

  SELECT * INTO doc
  FROM public.scheme_documents
  WHERE id = target_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme document not found.'; END IF;

  INSERT INTO public.scheme_ingestion_batches(
    document_id, status, extraction_method, created_by
  )
  VALUES(target_document_id, 'staged', extraction_method, auth.uid())
  RETURNING id INTO batch_id;

  FOR item IN SELECT value FROM jsonb_array_elements(target_entries)
  LOOP
    resolved_class := NULL;

    SELECT scope
      INTO resolved_class
    FROM unnest(doc.class_scope) AS scope
    WHERE private.normalize_scheme_class_label(scope) =
          private.normalize_scheme_class_label(item->>'class_level')
    LIMIT 1;

    IF resolved_class IS NULL THEN
      RAISE EXCEPTION 'Extracted class "%" does not belong to source "%".',
        coalesce(item->>'class_level',''), doc.original_filename;
    END IF;

    IF coalesce(item->>'term','') NOT IN ('First Term','Second Term','Third Term') THEN
      RAISE EXCEPTION 'Invalid term.';
    END IF;
    IF nullif(btrim(item->>'topic'),'') IS NULL THEN
      RAISE EXCEPTION 'Every staged scheme row requires a topic.';
    END IF;

    INSERT INTO public.scheme_entries(
      document_id,batch_id,class_level,term,week_label,week_number,subject_name,
      component_name,topic,learning_objectives,learning_activities,
      embedded_core_skills,learning_resources,source_page,source_reference,
      normalized_key
    )
    VALUES(
      target_document_id,
      batch_id,
      resolved_class,
      item->>'term',
      coalesce(nullif(item->>'week_label',''),'Unspecified'),
      nullif(item->>'week_number','')::integer,
      coalesce(nullif(item->>'subject_name',''),doc.subject_name),
      nullif(item->>'component_name',''),
      item->>'topic',
      coalesce(item->'learning_objectives','[]'::jsonb),
      coalesce(item->'learning_activities','[]'::jsonb),
      coalesce(item->'embedded_core_skills','[]'::jsonb),
      coalesce(item->'learning_resources','[]'::jsonb),
      nullif(item->>'source_page','')::integer,
      nullif(item->>'source_reference',''),
      coalesce(
        nullif(item->>'normalized_key',''),
        resolved_class || '|' || (item->>'term') || '|' ||
        coalesce(
          nullif(item->>'week_number',''),
          lower(regexp_replace(coalesce(item->>'week_label','unspecified'),'[^a-zA-Z0-9]+','-','g'))
        ) || '|' ||
        lower(regexp_replace(coalesce(nullif(btrim(item->>'component_name'),''),'general'),'[^a-zA-Z0-9]+','-','g')) || '|' ||
        lower(regexp_replace(btrim(item->>'topic'),'[^a-zA-Z0-9]+','-','g'))
      )
    )
    ON CONFLICT (document_id,normalized_key) DO UPDATE SET
      batch_id=excluded.batch_id,
      class_level=excluded.class_level,
      term=excluded.term,
      week_label=excluded.week_label,
      week_number=excluded.week_number,
      subject_name=excluded.subject_name,
      component_name=excluded.component_name,
      topic=excluded.topic,
      learning_objectives=excluded.learning_objectives,
      learning_activities=excluded.learning_activities,
      embedded_core_skills=excluded.embedded_core_skills,
      learning_resources=excluded.learning_resources,
      source_page=excluded.source_page,
      source_reference=excluded.source_reference,
      review_status='pending',
      review_note=null,
      reviewed_by=null,
      reviewed_at=null,
      updated_at=now();

    inserted_count := inserted_count + 1;
  END LOOP;

  UPDATE public.scheme_ingestion_batches
  SET row_count=inserted_count,status='review'
  WHERE id=batch_id;

  UPDATE public.scheme_documents
  SET extraction_status='staged',updated_at=now()
  WHERE id=target_document_id;

  RETURN jsonb_build_object(
    'document_id', target_document_id,
    'batch_id', batch_id,
    'row_count', inserted_count,
    'review_status', 'pending',
    'promoted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stage_scheme_entries(uuid,jsonb,text)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.stage_scheme_entries(uuid,jsonb,text)
TO authenticated;

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
  IF target_class_level IS NOT NULL
     AND (char_length(btrim(target_class_level)) < 1 OR char_length(btrim(target_class_level)) > 80) THEN
    RAISE EXCEPTION 'Invalid class filter.';
  END IF;
  IF target_term IS NOT NULL AND target_term NOT IN ('First Term','Second Term','Third Term') THEN
    RAISE EXCEPTION 'Invalid term filter.';
  END IF;
  IF target_limit < 1 OR target_limit > 200 THEN
    RAISE EXCEPTION 'Page size must be between 1 and 200.';
  END IF;
  IF target_offset < 0 THEN RAISE EXCEPTION 'Offset cannot be negative.'; END IF;

  WITH filtered AS (
    SELECT e.*, d.original_filename, d.education_level
    FROM public.scheme_entries e
    JOIN public.scheme_documents d ON d.id = e.document_id
    WHERE (target_document_id IS NULL OR e.document_id = target_document_id)
      AND (
        target_class_level IS NULL OR
        private.normalize_scheme_class_label(e.class_level) =
        private.normalize_scheme_class_label(target_class_level)
      )
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
    ORDER BY education_level, class_level, term, week_number NULLS LAST,
             week_label, subject_name, component_name NULLS FIRST, topic, id
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

REVOKE ALL ON FUNCTION public.get_scheme_review_page(uuid,uuid,text,text,text,integer,integer)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_scheme_review_page(uuid,uuid,text,text,text,integer,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.update_scheme_entry(
  target_entry_id uuid,
  target_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.scheme_entries%rowtype;
  changed public.scheme_entries%rowtype;
  doc public.scheme_documents%rowtype;
  resolved_class text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF jsonb_typeof(target_patch) <> 'object' THEN
    RAISE EXCEPTION 'Patch must be a JSON object.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(target_patch) AS k(key)
    WHERE key NOT IN (
      'class_level','term','week_label','week_number','component_name','topic',
      'learning_objectives','learning_activities','embedded_core_skills',
      'learning_resources','source_page','source_reference'
    )
  ) THEN
    RAISE EXCEPTION 'Patch contains a field that cannot be edited.';
  END IF;

  SELECT * INTO e
  FROM public.scheme_entries
  WHERE id = target_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme entry not found.'; END IF;
  IF e.promoted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Promoted scheme entries are immutable.';
  END IF;

  SELECT * INTO doc
  FROM public.scheme_documents
  WHERE id = e.document_id;

  resolved_class := e.class_level;
  IF target_patch ? 'class_level' THEN
    resolved_class := NULL;
    SELECT scope
      INTO resolved_class
    FROM unnest(doc.class_scope) AS scope
    WHERE private.normalize_scheme_class_label(scope) =
          private.normalize_scheme_class_label(target_patch->>'class_level')
    LIMIT 1;

    IF resolved_class IS NULL THEN
      RAISE EXCEPTION 'That class is outside the registered source scope.';
    END IF;
  END IF;

  IF target_patch ? 'learning_objectives'
     AND jsonb_typeof(target_patch->'learning_objectives') <> 'array' THEN
    RAISE EXCEPTION 'learning_objectives must be an array.';
  END IF;
  IF target_patch ? 'learning_activities'
     AND jsonb_typeof(target_patch->'learning_activities') <> 'array' THEN
    RAISE EXCEPTION 'learning_activities must be an array.';
  END IF;
  IF target_patch ? 'embedded_core_skills'
     AND jsonb_typeof(target_patch->'embedded_core_skills') <> 'array' THEN
    RAISE EXCEPTION 'embedded_core_skills must be an array.';
  END IF;
  IF target_patch ? 'learning_resources'
     AND jsonb_typeof(target_patch->'learning_resources') <> 'array' THEN
    RAISE EXCEPTION 'learning_resources must be an array.';
  END IF;

  UPDATE public.scheme_entries
  SET
    class_level = resolved_class,
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

  IF changed.term NOT IN ('First Term','Second Term','Third Term') THEN
    RAISE EXCEPTION 'Invalid term.';
  END IF;
  IF btrim(changed.week_label) = '' OR btrim(changed.topic) = '' THEN
    RAISE EXCEPTION 'Week label and topic are required.';
  END IF;

  PERFORM private.refresh_scheme_review_state(changed.document_id, changed.batch_id);

  RETURN jsonb_build_object('entry_id', changed.id, 'status', changed.review_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_scheme_entry(uuid,jsonb)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_scheme_entry(uuid,jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_academic_resource_catalog(
  target_workspace_id uuid,
  target_class_level text DEFAULT NULL,
  target_subject text DEFAULT NULL,
  target_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  workspace_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  IF NOT private.has_workspace_role(
    target_workspace_id,
    ARRAY['owner','admin','leader','teacher']
  ) THEN
    RAISE EXCEPTION 'Active Teacher or Leadership school access is required.';
  END IF;

  SELECT access_status INTO workspace_status
  FROM public.workspaces
  WHERE id = target_workspace_id
    AND workspace_type = 'school';

  IF workspace_status IS NULL THEN
    RAISE EXCEPTION 'Academic Resources is available only in a school workspace.';
  END IF;
  IF workspace_status <> 'active' THEN
    RAISE EXCEPTION 'This school is not currently active in KSI.';
  END IF;

  IF target_class_level IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.workspace_id = target_workspace_id
      AND c.active = true
      AND private.normalize_scheme_class_label(c.name) =
          private.normalize_scheme_class_label(target_class_level)
  ) THEN
    RAISE EXCEPTION 'The selected class is not configured in this school.';
  END IF;

  IF target_subject IS NOT NULL
     AND target_subject <> '__catalog_only__'
     AND NOT EXISTS (
       SELECT 1
       FROM public.subjects s
       WHERE s.workspace_id = target_workspace_id
         AND s.active = true
         AND lower(btrim(s.name)) = lower(btrim(target_subject))
     ) THEN
    RAISE EXCEPTION 'The selected subject is not configured in this school.';
  END IF;

  IF target_term IS NOT NULL
     AND target_term NOT IN ('First Term','Second Term','Third Term') THEN
    RAISE EXCEPTION 'Invalid term filter.';
  END IF;

  WITH teacher_documents AS (
    SELECT d.*
    FROM public.scheme_documents d
    WHERE d.extraction_status <> 'blocked'
      AND COALESCE((d.metadata->>'stage12_review_required')::boolean, false) = false
  ),
  selected_entries AS (
    SELECT e.*, d.original_filename, d.provenance_status
    FROM public.scheme_entries e
    JOIN teacher_documents d ON d.id = e.document_id
    WHERE e.review_status <> 'rejected'
      AND (
        target_class_level IS NULL OR
        private.normalize_scheme_class_label(e.class_level) =
        private.normalize_scheme_class_label(target_class_level)
      )
      AND (
        target_subject IS NULL OR
        target_subject = '__catalog_only__' OR
        lower(btrim(e.subject_name)) = lower(btrim(target_subject))
      )
      AND (target_term IS NULL OR e.term = target_term)
    ORDER BY
      e.class_level,
      e.subject_name,
      e.term,
      e.week_number NULLS LAST,
      e.week_label,
      e.component_name NULLS FIRST,
      e.topic,
      e.id
    LIMIT 600
  )
  SELECT jsonb_build_object(
    'provenance_notice',
      'Scheme references are shown only when they match this school''s configured class and subject. Supplied source copies remain distinct from independently verified canonical curriculum.',
    'classes', COALESCE((
      SELECT jsonb_agg(c.name ORDER BY c.name)
      FROM public.classes c
      WHERE c.workspace_id = target_workspace_id
        AND c.active = true
    ), '[]'::jsonb),
    'subjects', COALESCE((
      SELECT jsonb_agg(s.name ORDER BY s.name)
      FROM public.subjects s
      WHERE s.workspace_id = target_workspace_id
        AND s.active = true
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'filename', d.original_filename,
        'subject', d.subject_name,
        'education_level', d.education_level,
        'class_scope', d.class_scope,
        'extraction_status', d.extraction_status,
        'quarantined', false,
        'entry_count', stats.entry_count,
        'topics_present', stats.topics_present,
        'objectives_present', stats.objectives_present,
        'activities_present', stats.activities_present,
        'skills_present', stats.skills_present,
        'resources_present', stats.resources_present
      ) ORDER BY d.education_level, d.subject_name)
      FROM teacher_documents d
      CROSS JOIN LATERAL (
        SELECT
          count(*)::integer AS entry_count,
          count(*) FILTER (WHERE nullif(btrim(e.topic),'') IS NOT NULL)::integer AS topics_present,
          count(*) FILTER (WHERE jsonb_array_length(e.learning_objectives) > 0)::integer AS objectives_present,
          count(*) FILTER (WHERE jsonb_array_length(e.learning_activities) > 0)::integer AS activities_present,
          count(*) FILTER (WHERE jsonb_array_length(e.embedded_core_skills) > 0)::integer AS skills_present,
          count(*) FILTER (WHERE jsonb_array_length(e.learning_resources) > 0)::integer AS resources_present
        FROM public.scheme_entries e
        WHERE e.document_id = d.id
          AND e.review_status <> 'rejected'
          AND (
            target_class_level IS NULL OR
            private.normalize_scheme_class_label(e.class_level) =
            private.normalize_scheme_class_label(target_class_level)
          )
      ) stats
      WHERE (
        target_subject IS NULL OR
        target_subject = '__catalog_only__' OR
        lower(btrim(d.subject_name)) = lower(btrim(target_subject))
      )
        AND (
          target_class_level IS NULL OR EXISTS (
            SELECT 1
            FROM unnest(d.class_scope) AS scope
            WHERE private.normalize_scheme_class_label(scope) =
                  private.normalize_scheme_class_label(target_class_level)
          )
        )
    ), '[]'::jsonb),
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'document_id', e.document_id,
        'filename', e.original_filename,
        'class_level', e.class_level,
        'term', e.term,
        'week_label', e.week_label,
        'week_number', e.week_number,
        'subject', e.subject_name,
        'component', e.component_name,
        'topic', e.topic,
        'learning_objectives', e.learning_objectives,
        'learning_activities', e.learning_activities,
        'embedded_core_skills', e.embedded_core_skills,
        'learning_resources', e.learning_resources,
        'source_page', e.source_page,
        'source_reference', e.source_reference,
        'review_status', e.review_status,
        'promoted', e.promoted_at IS NOT NULL,
        'provenance_status', e.provenance_status
      ))
      FROM selected_entries e
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_academic_resource_catalog(uuid,text,text,text)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_academic_resource_catalog(uuid,text,text,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_scheme_class_extraction(
  target_document_id uuid,
  target_class_level text,
  target_entries jsonb,
  target_extraction_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc public.scheme_documents%rowtype;
  batch_id uuid;
  item jsonb;
  inserted_count integer := 0;
  protected_count integer := 0;
  extracted_term text;
  normalized_component text;
  normalized_topic text;
  resolved_class text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF nullif(btrim(target_class_level),'') IS NULL
     OR char_length(btrim(target_class_level)) > 80 THEN
    RAISE EXCEPTION 'Invalid class level.';
  END IF;
  IF jsonb_typeof(target_entries) <> 'array'
     OR jsonb_array_length(target_entries) = 0 THEN
    RAISE EXCEPTION 'A non-empty structured extraction is required.';
  END IF;

  SELECT * INTO doc
  FROM public.scheme_documents
  WHERE id = target_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme document not found.'; END IF;

  IF COALESCE((doc.metadata->>'stage12_review_required')::boolean, false) THEN
    RAISE EXCEPTION 'This source is quarantined and cannot be automatically re-extracted.';
  END IF;

  SELECT scope
    INTO resolved_class
  FROM unnest(doc.class_scope) AS scope
  WHERE private.normalize_scheme_class_label(scope) =
        private.normalize_scheme_class_label(target_class_level)
  LIMIT 1;

  IF resolved_class IS NULL THEN
    RAISE EXCEPTION 'The selected class does not belong to this source document.';
  END IF;

  SELECT count(*)::integer INTO protected_count
  FROM public.scheme_entries
  WHERE document_id = target_document_id
    AND private.normalize_scheme_class_label(class_level) =
        private.normalize_scheme_class_label(resolved_class)
    AND (review_status <> 'pending' OR promoted_at IS NOT NULL);

  IF protected_count > 0 THEN
    RAISE EXCEPTION 'This class contains reviewed or promoted rows. Re-extraction is blocked to protect human decisions.';
  END IF;

  INSERT INTO public.scheme_ingestion_batches(
    document_id,status,extraction_method,created_by,notes
  )
  VALUES(
    target_document_id,
    'staged',
    'vision',
    auth.uid(),
    nullif(btrim(target_extraction_note),'')
  )
  RETURNING id INTO batch_id;

  DELETE FROM public.scheme_entries
  WHERE document_id = target_document_id
    AND private.normalize_scheme_class_label(class_level) =
        private.normalize_scheme_class_label(resolved_class)
    AND review_status = 'pending'
    AND promoted_at IS NULL;

  FOR item IN SELECT value FROM jsonb_array_elements(target_entries)
  LOOP
    IF private.normalize_scheme_class_label(coalesce(item->>'class_level','')) <>
       private.normalize_scheme_class_label(resolved_class) THEN
      RAISE EXCEPTION 'Extracted class does not match the requested class.';
    END IF;

    extracted_term := coalesce(item->>'term','');
    IF extracted_term NOT IN ('First Term','Second Term','Third Term') THEN
      RAISE EXCEPTION 'Every extracted row requires a valid term.';
    END IF;
    IF nullif(btrim(item->>'topic'),'') IS NULL THEN
      RAISE EXCEPTION 'Every extracted row requires a topic.';
    END IF;

    normalized_component := lower(regexp_replace(
      coalesce(nullif(btrim(item->>'component_name'),''),'general'),
      '[^a-zA-Z0-9]+','-','g'
    ));
    normalized_topic := lower(regexp_replace(
      btrim(item->>'topic'),
      '[^a-zA-Z0-9]+','-','g'
    ));

    INSERT INTO public.scheme_entries(
      document_id,batch_id,class_level,term,week_label,week_number,subject_name,
      component_name,topic,learning_objectives,learning_activities,
      embedded_core_skills,learning_resources,source_page,source_reference,
      normalized_key
    )
    VALUES (
      target_document_id,
      batch_id,
      resolved_class,
      extracted_term,
      coalesce(nullif(btrim(item->>'week_label'),''),'Unspecified'),
      nullif(item->>'week_number','')::integer,
      doc.subject_name,
      nullif(btrim(item->>'component_name'),''),
      btrim(item->>'topic'),
      coalesce(item->'learning_objectives','[]'::jsonb),
      coalesce(item->'learning_activities','[]'::jsonb),
      coalesce(item->'embedded_core_skills','[]'::jsonb),
      coalesce(item->'learning_resources','[]'::jsonb),
      nullif(item->>'source_page','')::integer,
      nullif(btrim(item->>'source_reference'),''),
      resolved_class || '|' || extracted_term || '|' ||
        coalesce(
          nullif(item->>'week_number',''),
          lower(regexp_replace(coalesce(item->>'week_label','unspecified'),'[^a-zA-Z0-9]+','-','g'))
        ) || '|' || normalized_component || '|' || normalized_topic
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  UPDATE public.scheme_ingestion_batches
  SET row_count = inserted_count,
      status = 'review'
  WHERE id = batch_id;

  UPDATE public.scheme_documents
  SET extraction_status = 'staged',
      metadata = metadata || jsonb_build_object(
        'last_reextracted_at', now(),
        'last_reextracted_class', resolved_class
      ),
      updated_at = now()
  WHERE id = target_document_id;

  RETURN jsonb_build_object(
    'document_id', target_document_id,
    'class_level', resolved_class,
    'batch_id', batch_id,
    'row_count', inserted_count,
    'review_status', 'pending',
    'promoted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_scheme_class_extraction(uuid,text,jsonb,text)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.replace_scheme_class_extraction(uuid,text,jsonb,text)
TO authenticated;

COMMENT ON FUNCTION public.get_academic_resource_catalog(uuid,text,text,text) IS
'Returns scheme references filtered by the active school classes and subjects configured in Academic Setup; class matching is format-normalised rather than restricted to JSS/SS labels.';

COMMENT ON FUNCTION public.replace_scheme_class_extraction(uuid,text,jsonb,text) IS
'Re-extracts one class from a registered scheme source using that document class_scope; supports any valid school level rather than a fixed secondary-school allowlist.';
