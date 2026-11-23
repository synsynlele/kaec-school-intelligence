alter table public.student_accounts add column password_change_pending boolean not null default false;

create function public.set_learner_password_pending(target_user uuid, target_student uuid, pending boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.student_accounts sa
  set active = not pending, password_change_pending = pending, updated_at = now()
  from auth.users u
  where sa.user_id = target_user and sa.student_id = target_student and u.id = sa.user_id
    and u.raw_app_meta_data->>'ksi_school_learner' = target_student::text
    and (sa.active or sa.password_change_pending)
    and (pending or sa.password_change_pending)
    and exists (
      select 1 from public.students s join public.workspaces w on w.id = s.workspace_id
      where s.id = sa.student_id and s.workspace_id = sa.workspace_id and s.active
        and w.workspace_type = 'school' and w.access_status = 'active'
    );
  return found;
end;
$$;

revoke all on function public.set_learner_password_pending(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_learner_password_pending(uuid, uuid, boolean) to service_role;
