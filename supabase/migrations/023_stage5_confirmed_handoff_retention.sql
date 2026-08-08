-- KAEC School Intelligence — Stage 5 confirmed handoff retention
-- Confirmed interventions are durable audit history and must not be deleted by product users.
-- Owner/admin may remove only accidental draft handoffs before confirmation.

drop policy if exists intervention_handoffs_delete_admin
on public.intervention_handoffs;

create policy intervention_handoffs_delete_admin_draft_only
on public.intervention_handoffs
for delete
to authenticated
using (
  status = 'draft'
  and (select private.has_workspace_role(workspace_id, array['owner','admin']))
);
