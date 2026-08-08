-- Stage 3 saved-work lifecycle
-- Archive hides lessons/assessments from normal product queries.
-- Restore is reversible. Permanent delete is allowed only from archive and only
-- when no downstream intelligence depends on the artifact.

DROP POLICY IF EXISTS lessons_select_member ON public.lessons;
CREATE POLICY lessons_select_member
ON public.lessons
FOR SELECT
TO authenticated
USING (
  private.is_workspace_member(workspace_id)
  AND status <> 'archived'
);

DROP POLICY IF EXISTS assessments_select_member ON public.assessments;
CREATE POLICY assessments_select_member
ON public.assessments
FOR SELECT
TO authenticated
USING (
  private.is_workspace_member(workspace_id)
  AND status <> 'archived'
);

CREATE OR REPLACE FUNCTION public.list_archived_saved_work(target_workspace_id uuid)
RETURNS TABLE (
  artifact_type text,
  artifact_id uuid,
  title text,
  updated_at timestamptz,
  dependency_count bigint,
  can_manage boolean,
  can_permanently_delete boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_workspace_member(target_workspace_id) THEN
    RAISE EXCEPTION 'The selected workspace is not available to this account.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    'lesson'::text,
    l.id,
    l.title,
    l.updated_at,
    (SELECT count(*) FROM public.assessments a WHERE a.source_lesson_id = l.id)::bigint AS dependency_count,
    (l.created_by = current_user_id OR private.has_workspace_role(l.workspace_id, ARRAY['owner'::text, 'admin'::text])) AS can_manage,
    (
      (l.created_by = current_user_id OR private.has_workspace_role(l.workspace_id, ARRAY['owner'::text, 'admin'::text]))
      AND NOT EXISTS (SELECT 1 FROM public.assessments a WHERE a.source_lesson_id = l.id)
    ) AS can_permanently_delete
  FROM public.lessons l
  WHERE l.workspace_id = target_workspace_id
    AND l.status = 'archived'

  UNION ALL

  SELECT
    'assessment'::text,
    a.id,
    a.title,
    a.updated_at,
    (
      (SELECT count(*) FROM public.student_evidence se WHERE se.assessment_id = a.id)
      +
      (SELECT count(*) FROM public.diagnoses d WHERE d.assessment_id = a.id)
    )::bigint AS dependency_count,
    (a.created_by = current_user_id OR private.has_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text])) AS can_manage,
    (
      (a.created_by = current_user_id OR private.has_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text]))
      AND NOT EXISTS (SELECT 1 FROM public.student_evidence se WHERE se.assessment_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM public.diagnoses d WHERE d.assessment_id = a.id)
    ) AS can_permanently_delete
  FROM public.assessments a
  WHERE a.workspace_id = target_workspace_id
    AND a.status = 'archived'

  ORDER BY updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_saved_artifact(
  target_artifact_type text,
  target_artifact_id uuid,
  target_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  artifact_workspace_id uuid;
  artifact_created_by uuid;
  artifact_status text;
  artifact_title text;
  artifact_blueprint jsonb;
  restore_status text;
  latest_fidelity_passed boolean;
  dependency_count bigint := 0;
  normalized_type text := lower(trim(target_artifact_type));
  normalized_action text := lower(trim(target_action));
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF normalized_type NOT IN ('lesson', 'assessment') THEN
    RAISE EXCEPTION 'Unsupported saved-work type.' USING ERRCODE = '22023';
  END IF;

  IF normalized_action NOT IN ('archive', 'restore', 'delete') THEN
    RAISE EXCEPTION 'Unsupported saved-work action.' USING ERRCODE = '22023';
  END IF;

  IF normalized_type = 'lesson' THEN
    SELECT l.workspace_id, l.created_by, l.status, l.title
      INTO artifact_workspace_id, artifact_created_by, artifact_status, artifact_title
    FROM public.lessons l
    WHERE l.id = target_artifact_id
    FOR UPDATE;
  ELSE
    SELECT a.workspace_id, a.created_by, a.status, a.title, a.blueprint
      INTO artifact_workspace_id, artifact_created_by, artifact_status, artifact_title, artifact_blueprint
    FROM public.assessments a
    WHERE a.id = target_artifact_id
    FOR UPDATE;
  END IF;

  IF artifact_workspace_id IS NULL THEN
    RAISE EXCEPTION 'This saved item no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT private.is_workspace_member(artifact_workspace_id) THEN
    RAISE EXCEPTION 'This saved item is not available to this account.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    artifact_created_by = current_user_id
    OR private.has_workspace_role(artifact_workspace_id, ARRAY['owner'::text, 'admin'::text])
  ) THEN
    RAISE EXCEPTION 'Only the creator or a workspace owner/admin can manage this saved item.' USING ERRCODE = '42501';
  END IF;

  IF normalized_action = 'archive' THEN
    IF artifact_status <> 'archived' THEN
      IF normalized_type = 'lesson' THEN
        UPDATE public.lessons SET status = 'archived' WHERE id = target_artifact_id;
      ELSE
        UPDATE public.assessments SET status = 'archived' WHERE id = target_artifact_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'artifactType', normalized_type,
      'artifactId', target_artifact_id,
      'title', artifact_title,
      'status', 'archived',
      'action', 'archive'
    );
  END IF;

  IF normalized_action = 'restore' THEN
    IF artifact_status <> 'archived' THEN
      RAISE EXCEPTION 'Only archived items can be restored.' USING ERRCODE = '22023';
    END IF;

    IF normalized_type = 'lesson' THEN
      SELECT h.passed
        INTO latest_fidelity_passed
      FROM public.hqls_fidelity_checks h
      WHERE h.lesson_id = target_artifact_id
      ORDER BY h.created_at DESC
      LIMIT 1;

      restore_status := CASE WHEN coalesce(latest_fidelity_passed, false) THEN 'validated' ELSE 'draft' END;
      UPDATE public.lessons SET status = restore_status WHERE id = target_artifact_id;
    ELSE
      restore_status := CASE
        WHEN lower(coalesce(artifact_blueprint -> 'validation' ->> 'passed', 'false')) = 'true'
          THEN 'validated'
        ELSE 'draft'
      END;
      UPDATE public.assessments SET status = restore_status WHERE id = target_artifact_id;
    END IF;

    RETURN jsonb_build_object(
      'artifactType', normalized_type,
      'artifactId', target_artifact_id,
      'title', artifact_title,
      'status', restore_status,
      'action', 'restore'
    );
  END IF;

  -- Permanent delete is deliberately two-step: archive first, then delete.
  IF artifact_status <> 'archived' THEN
    RAISE EXCEPTION 'Archive this item before permanently deleting it.' USING ERRCODE = '22023';
  END IF;

  IF normalized_type = 'lesson' THEN
    SELECT count(*) INTO dependency_count
    FROM public.assessments a
    WHERE a.source_lesson_id = target_artifact_id;

    IF dependency_count > 0 THEN
      RAISE EXCEPTION 'This lesson cannot be permanently deleted because % assessment(s) still depend on it. Archive or remove those assessments first.', dependency_count
        USING ERRCODE = '23503';
    END IF;
  ELSE
    SELECT
      (SELECT count(*) FROM public.student_evidence se WHERE se.assessment_id = target_artifact_id)
      +
      (SELECT count(*) FROM public.diagnoses d WHERE d.assessment_id = target_artifact_id)
      INTO dependency_count;

    IF dependency_count > 0 THEN
      RAISE EXCEPTION 'This assessment cannot be permanently deleted because % evidence/diagnosis record(s) still depend on it.', dependency_count
        USING ERRCODE = '23503';
    END IF;
  END IF;

  DELETE FROM public.generation_feedback
  WHERE artifact_type = normalized_type AND artifact_id = target_artifact_id;

  DELETE FROM public.artifact_resource_links
  WHERE artifact_type = normalized_type AND artifact_id = target_artifact_id;

  DELETE FROM public.artifact_versions
  WHERE artifact_type = normalized_type AND artifact_id = target_artifact_id;

  DELETE FROM public.ai_runs
  WHERE artifact_type = normalized_type AND artifact_id = target_artifact_id;

  IF normalized_type = 'lesson' THEN
    DELETE FROM public.lessons WHERE id = target_artifact_id;
  ELSE
    DELETE FROM public.assessments WHERE id = target_artifact_id;
  END IF;

  RETURN jsonb_build_object(
    'artifactType', normalized_type,
    'artifactId', target_artifact_id,
    'title', artifact_title,
    'status', 'deleted',
    'action', 'delete'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_archived_saved_work(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_saved_artifact(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_archived_saved_work(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_saved_artifact(text, uuid, text) TO authenticated;
