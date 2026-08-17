-- Stage 8 performance hardening for student access onboarding.

create index if not exists student_access_invites_student_workspace_idx
  on public.student_access_invites(student_id, workspace_id);
create index if not exists student_access_invites_issued_by_idx
  on public.student_access_invites(issued_by);
create index if not exists student_access_invites_redeemed_by_idx
  on public.student_access_invites(redeemed_by)
  where redeemed_by is not null;
