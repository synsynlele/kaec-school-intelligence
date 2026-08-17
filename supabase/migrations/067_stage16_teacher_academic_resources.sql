-- KSI Stage 16 — Teacher Academic Resources
-- Supplied scheme rows are exposed as read-only teaching references.
-- Review and promotion authority remains unchanged and platform-admin only.

DO $$
BEGIN
  IF to_regclass('public.scheme_entries') IS NULL
     OR to_regclass('public.scheme_documents') IS NULL THEN
    RAISE EXCEPTION 'Stage 12 scheme foundations must exist before Stage 16.';
  END IF;
END;
$$;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

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

  IF target_class_level IS NOT NULL
     AND target_class_level NOT IN ('JSS1','JSS2','JSS3','SS1','SS2','SS3') THEN
    RAISE EXCEPTION 'Invalid class filter.';
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
      AND (target_class_level IS NULL OR e.class_level = target_class_level)
      AND (target_subject IS NULL OR lower(e.subject_name) = lower(target_subject))
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
      'These are supplied scheme-of-work references. They are not represented as independently verified canonical curriculum unless separately reviewed and promoted.',
    'classes', jsonb_build_array('JSS1','JSS2','JSS3','SS1','SS2','SS3'),
    'subjects', COALESCE((
      SELECT jsonb_agg(subject_name ORDER BY subject_name)
      FROM (
        SELECT DISTINCT d.subject_name
        FROM teacher_documents d
      ) s
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
      ) stats
      WHERE (target_subject IS NULL OR lower(d.subject_name) = lower(target_subject))
        AND (target_class_level IS NULL OR target_class_level = ANY(d.class_scope))
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

-- Controlled source repair. One AI pass may recover all three terms for one
-- class, but the replacement is transactional: any human-reviewed or promoted
-- row anywhere in that class blocks the whole replacement before deletion.
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF target_class_level NOT IN ('JSS1','JSS2','JSS3','SS1','SS2','SS3') THEN
    RAISE EXCEPTION 'Invalid class level.';
  END IF;
  IF jsonb_typeof(target_entries) <> 'array' OR jsonb_array_length(target_entries) = 0 THEN
    RAISE EXCEPTION 'A non-empty structured extraction is required.';
  END IF;

  SELECT * INTO doc
  FROM public.scheme_documents
  WHERE id = target_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme document not found.'; END IF;

  IF COALESCE((doc.metadata->>'stage12_review_required')::boolean, false) THEN
    RAISE EXCEPTION 'This source is quarantined and cannot be automatically re-extracted.';
  END IF;
  IF NOT target_class_level = ANY(doc.class_scope) THEN
    RAISE EXCEPTION 'The selected class does not belong to this source document.';
  END IF;

  SELECT count(*)::integer INTO protected_count
  FROM public.scheme_entries
  WHERE document_id = target_document_id
    AND class_level = target_class_level
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
    AND class_level = target_class_level
    AND review_status = 'pending'
    AND promoted_at IS NULL;

  FOR item IN SELECT value FROM jsonb_array_elements(target_entries)
  LOOP
    IF coalesce(item->>'class_level','') <> target_class_level THEN
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
      embedded_core_skills,learning_resources,source_page,source_reference,normalized_key
    ) VALUES (
      target_document_id,
      batch_id,
      target_class_level,
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
      target_class_level || '|' || extracted_term || '|' ||
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
        'stage16_last_reextracted_at', now(),
        'stage16_last_reextracted_class', target_class_level
      ),
      updated_at = now()
  WHERE id = target_document_id;

  RETURN jsonb_build_object(
    'document_id', target_document_id,
    'class_level', target_class_level,
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
