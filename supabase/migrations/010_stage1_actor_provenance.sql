-- KAEC School Intelligence — Stage 1 actor provenance
-- Client-supplied creator/recorder IDs must always match the authenticated actor.
-- Student evidence and HQLS fidelity checks are append-oriented records.

-- Subjects
drop policy if exists subjects_workspace_access on public.subjects;
create policy subjects_select_member on public.subjects
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy subjects_insert_self on public.subjects
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy subjects_update_member on public.subjects
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy subjects_delete_admin_or_creator on public.subjects
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['owner','admin'])
);

-- Classes
drop policy if exists classes_workspace_access on public.classes;
create policy classes_select_member on public.classes
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy classes_insert_self on public.classes
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy classes_update_member on public.classes
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy classes_delete_admin_or_creator on public.classes
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['owner','admin'])
);

-- Students
drop policy if exists students_workspace_access on public.students;
create policy students_select_member on public.students
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy students_insert_self on public.students
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy students_update_member on public.students
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy students_delete_admin_or_creator on public.students
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['owner','admin'])
);

-- Lessons
drop policy if exists lessons_workspace_access on public.lessons;
create policy lessons_select_member on public.lessons
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy lessons_insert_self on public.lessons
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy lessons_update_member on public.lessons
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy lessons_delete_member on public.lessons
for delete to authenticated
using (private.is_workspace_member(workspace_id));

-- HQLS fidelity checks are evidence. They may be read and appended, not silently rewritten.
drop policy if exists fidelity_workspace_access on public.hqls_fidelity_checks;
create policy fidelity_select_member on public.hqls_fidelity_checks
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy fidelity_insert_member on public.hqls_fidelity_checks
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and (
    (check_origin = 'system' and checked_by is null)
    or (check_origin = 'human' and checked_by = (select auth.uid()))
  )
);

-- Assessments
drop policy if exists assessments_workspace_access on public.assessments;
create policy assessments_select_member on public.assessments
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy assessments_insert_self on public.assessments
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy assessments_update_member on public.assessments
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy assessments_delete_member on public.assessments
for delete to authenticated
using (private.is_workspace_member(workspace_id));

-- Student evidence is append-oriented. Normal users cannot rewrite history;
-- owner/admin can delete a clearly erroneous record when necessary.
drop policy if exists evidence_workspace_access on public.student_evidence;
create policy evidence_select_member on public.student_evidence
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy evidence_insert_self on public.student_evidence
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and recorded_by = (select auth.uid())
);
create policy evidence_delete_admin on public.student_evidence
for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner','admin']));

-- Artifact/resource provenance links
drop policy if exists artifact_resources_workspace_access on public.artifact_resource_links;
create policy artifact_resources_select_member on public.artifact_resource_links
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy artifact_resources_insert_self on public.artifact_resource_links
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy artifact_resources_delete_member on public.artifact_resource_links
for delete to authenticated
using (private.is_workspace_member(workspace_id));
