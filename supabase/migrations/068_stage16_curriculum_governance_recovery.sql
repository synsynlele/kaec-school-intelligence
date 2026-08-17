-- KSI Stage 16 — Curriculum governance recovery
--
-- Incident boundary:
-- The supplied scheme corpus was explicitly required to remain Pending review
-- with zero automatic promotion. On 17 August 2026 the entire corpus was
-- bulk-approved/promoted between 08:03 and 08:49 UTC without a row-by-row
-- human-review record. This migration restores the governed pre-review state,
-- removes only the graph nodes created by that promotion incident, and makes
-- mass promotion impossible at the database boundary.
--
-- This migration intentionally does NOT repair/re-extract source PDFs and does
-- NOT approve or promote any scheme row.

DO $$
BEGIN
  IF to_regclass('public.scheme_entries') IS NULL
     OR to_regclass('public.scheme_documents') IS NULL
     OR to_regclass('public.scheme_ingestion_batches') IS NULL
     OR to_regclass('public.scheme_entry_node_links') IS NULL
     OR to_regclass('public.curriculum_nodes') IS NULL THEN
    RAISE EXCEPTION 'Stage 12 curriculum foundations must exist before Stage 16 governance recovery.';
  END IF;

  -- Never delete a state-scheme node that predates or postdates the known
  -- incident window. If the database has moved on, stop and require a fresh
  -- operator audit rather than guessing.
  IF EXISTS (
    SELECT 1
    FROM public.curriculum_nodes n
    WHERE n.metadata->>'source_kind' = 'state_scheme'
      AND (n.created_at < timestamptz '2026-08-17 08:00:00+00'
           OR n.created_at > timestamptz '2026-08-17 09:00:00+00')
  ) THEN
    RAISE EXCEPTION 'State-scheme graph contains nodes outside the audited promotion incident window. Recovery aborted.';
  END IF;

  -- Likewise, do not reset a review/promotion decision outside the audited
  -- incident window.
  IF EXISTS (
    SELECT 1
    FROM public.scheme_entries e
    WHERE (e.review_status <> 'pending' OR e.promoted_at IS NOT NULL)
      AND NOT (
        (e.reviewed_at IS NOT NULL
         AND e.reviewed_at >= timestamptz '2026-08-17 08:00:00+00'
         AND e.reviewed_at <= timestamptz '2026-08-17 09:00:00+00')
        OR
        (e.promoted_at IS NOT NULL
         AND e.promoted_at >= timestamptz '2026-08-17 08:00:00+00'
         AND e.promoted_at <= timestamptz '2026-08-17 09:00:00+00')
      )
  ) THEN
    RAISE EXCEPTION 'Scheme review state exists outside the audited promotion incident window. Recovery aborted.';
  END IF;

  -- Promotion-created nodes currently have no downstream learning evidence.
  -- Preserve that invariant: if any external dependency appears, abort instead
  -- of cascading through learner, lesson, resource or mastery data.
  IF EXISTS (
    SELECT 1
    FROM public.curriculum_nodes child
    WHERE child.parent_id IN (
      SELECT id FROM public.curriculum_nodes
      WHERE metadata->>'source_kind' = 'state_scheme'
    )
      AND COALESCE(child.metadata->>'source_kind','') <> 'state_scheme'
  ) THEN
    RAISE EXCEPTION 'A non-scheme curriculum node depends on the incident graph. Recovery aborted.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.curriculum_learning_resources r
    WHERE r.curriculum_objective_node_id IN (
      SELECT id FROM public.curriculum_nodes
      WHERE metadata->>'source_kind' = 'state_scheme'
    )
  ) THEN
    RAISE EXCEPTION 'Curriculum learning resources depend on the incident graph. Recovery aborted.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.objective_curriculum_links l
    WHERE l.curriculum_objective_node_id IN (
      SELECT id FROM public.curriculum_nodes
      WHERE metadata->>'source_kind' = 'state_scheme'
    )
  ) THEN
    RAISE EXCEPTION 'Lesson objectives depend on the incident graph. Recovery aborted.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_learning_plan_steps s
    WHERE s.curriculum_node_id IN (
      SELECT id FROM public.curriculum_nodes
      WHERE metadata->>'source_kind' = 'state_scheme'
    )
  ) THEN
    RAISE EXCEPTION 'Learning-plan evidence depends on the incident graph. Recovery aborted.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.curriculum_prerequisites p
    WHERE p.objective_node_id IN (
            SELECT id FROM public.curriculum_nodes
            WHERE metadata->>'source_kind' = 'state_scheme'
          )
       OR p.prerequisite_node_id IN (
            SELECT id FROM public.curriculum_nodes
            WHERE metadata->>'source_kind' = 'state_scheme'
          )
  ) THEN
    RAISE EXCEPTION 'Curriculum prerequisites depend on the incident graph. Recovery aborted.';
  END IF;
END;
$$;

-- Remove only the graph created from the affected supplied-scheme promotions.
-- The hierarchy uses RESTRICT on parent deletion, so delete leaf-to-root.
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'objective';
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'topic';
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'strand';
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'subject';
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'week';
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'term';
DELETE FROM public.curriculum_nodes
WHERE metadata->>'source_kind' = 'state_scheme' AND node_type = 'class';

-- Restore the supplied corpus to the founder-authorised human-review boundary.
UPDATE public.scheme_entries
SET review_status = 'pending',
    review_note = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    promoted_at = NULL,
    updated_at = now()
WHERE review_status <> 'pending' OR promoted_at IS NOT NULL;

UPDATE public.scheme_ingestion_batches b
SET status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL
WHERE EXISTS (
  SELECT 1 FROM public.scheme_entries e WHERE e.batch_id = b.id
);

UPDATE public.scheme_documents d
SET extraction_status = 'staged',
    metadata = d.metadata || jsonb_build_object(
      'stage16_governance_recovered_at', now(),
      'stage16_governance_recovery', 'bulk_review_promotion_reset_to_pending'
    ),
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.scheme_entries e WHERE e.document_id = d.id
)
  AND COALESCE((d.metadata->>'stage12_review_required')::boolean, false) = false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.scheme_entries
    WHERE review_status <> 'pending' OR promoted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Governance recovery failed: every supplied scheme row must be Pending and unpromoted.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.curriculum_nodes
    WHERE metadata->>'source_kind' = 'state_scheme'
  ) THEN
    RAISE EXCEPTION 'Governance recovery failed: incident curriculum nodes remain.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.scheme_entry_node_links) THEN
    RAISE EXCEPTION 'Governance recovery failed: scheme graph links remain.';
  END IF;
END;
$$;

-- Every review decision now requires durable human review evidence.
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
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF target_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Review status must be approved or rejected.';
  END IF;
  IF NULLIF(btrim(target_review_note),'') IS NULL THEN
    RAISE EXCEPTION 'A human review note is required before approving or rejecting a scheme entry.';
  END IF;

  SELECT * INTO entry_row
  FROM public.scheme_entries
  WHERE id = target_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Scheme entry not found.'; END IF;
  IF entry_row.promoted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Promoted scheme entries are immutable.';
  END IF;

  UPDATE public.scheme_entries
  SET review_status = target_status,
      review_note = btrim(target_review_note),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = target_entry_id
  RETURNING * INTO entry_row;

  PERFORM private.refresh_scheme_review_state(entry_row.document_id, entry_row.batch_id);
  RETURN jsonb_build_object('entry_id', entry_row.id, 'status', target_status);
END;
$$;

-- Batch review remains available for scale, but it must carry an explicit
-- human review note and is capped to one visible review page (50 rows).
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
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  IF target_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Review status must be approved or rejected.';
  END IF;
  IF target_entry_ids IS NULL OR cardinality(target_entry_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one scheme entry.';
  END IF;
  IF cardinality(target_entry_ids) > 50 THEN
    RAISE EXCEPTION 'Bulk review is limited to 50 visible rows at a time.';
  END IF;
  IF NULLIF(btrim(target_review_note),'') IS NULL THEN
    RAISE EXCEPTION 'A human review note is required for every bulk review decision.';
  END IF;

  SELECT count(*) INTO requested_count
  FROM (SELECT DISTINCT unnest(target_entry_ids) AS id) ids;

  SELECT count(*) INTO found_count
  FROM public.scheme_entries
  WHERE id = ANY(target_entry_ids);

  IF found_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected scheme entries no longer exist.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.scheme_entries
    WHERE id = ANY(target_entry_ids) AND promoted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Promoted scheme entries are immutable.';
  END IF;

  UPDATE public.scheme_entries
  SET review_status = target_status,
      review_note = btrim(target_review_note),
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

  RETURN jsonb_build_object(
    'updated', requested_count,
    'status', target_status,
    'review_note_required', true
  );
END;
$$;

-- A promoted row must carry recorded review evidence. This trigger also makes
-- already-promoted rows immutable against legacy staging/upsert paths.
CREATE OR REPLACE FUNCTION private.guard_scheme_entry_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.promoted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Promoted scheme entries are immutable.';
  END IF;

  IF OLD.promoted_at IS NULL AND NEW.promoted_at IS NOT NULL THEN
    IF NEW.review_status <> 'approved'
       OR NEW.reviewed_by IS NULL
       OR NEW.reviewed_at IS NULL
       OR NULLIF(btrim(NEW.review_note),'') IS NULL THEN
      RAISE EXCEPTION 'Promotion requires an approved row with recorded human review evidence.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scheme_entry_governance_guard ON public.scheme_entries;
CREATE TRIGGER scheme_entry_governance_guard
BEFORE UPDATE ON public.scheme_entries
FOR EACH ROW
EXECUTE FUNCTION private.guard_scheme_entry_governance();

REVOKE ALL ON FUNCTION private.guard_scheme_entry_governance() FROM public, anon, authenticated;

-- Mass canonical promotion is intentionally disabled. Promotion remains a
-- separate, explicit one-row action after documented review.
CREATE OR REPLACE FUNCTION public.promote_scheme_entries_bulk(target_entry_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT private.is_platform_access_admin() THEN
    RAISE EXCEPTION 'Platform curriculum admin permission required.';
  END IF;
  RAISE EXCEPTION 'Bulk curriculum promotion is disabled. Promote one reviewed entry at a time.';
END;
$$;

REVOKE ALL ON FUNCTION public.review_scheme_entry(uuid,text,text),
  public.review_scheme_entries_bulk(uuid[],text,text),
  public.promote_scheme_entries_bulk(uuid[])
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_scheme_entry(uuid,text,text),
  public.review_scheme_entries_bulk(uuid[],text,text),
  public.promote_scheme_entries_bulk(uuid[])
TO authenticated;
