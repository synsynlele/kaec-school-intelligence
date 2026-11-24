create table private.learning_cbt_restarts (
  id bigint generated always as identity primary key,
  cbt_id uuid not null,
  student_id uuid not null,
  restarted_by uuid references auth.users(id) on delete set null,
  restarted_at timestamptz not null default now(),
  previous_submission jsonb not null
);
alter table private.learning_cbt_restarts enable row level security;

create function public.restart_learning_cbt(source_id uuid, learner_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare assignment private.learning_cbts; previous private.learning_cbt_submissions;
begin
  select * into assignment from private.learning_cbts c where c.assessment_id=source_id and c.cbt_enabled for update;
  if not found or not coalesce(private.has_workspace_role(assignment.workspace_id,array['owner','admin','leader','teacher']),false)
    or not coalesce(private.can_view_teacher_artifact(assignment.workspace_id,'assessment',source_id),false)
    or not exists(select from public.workspaces w where w.id=assignment.workspace_id and w.workspace_type='school' and w.access_status='active')
    or not exists(select from public.students s where s.id=learner_id and s.workspace_id=assignment.workspace_id and s.class_id=assignment.class_id and s.active)
  then raise exception 'CBT or learner unavailable.'; end if;
  if assignment.closes_at<=statement_timestamp() then raise exception 'The CBT window has closed.'; end if;
  if (select action from private.learning_result_reviews where cbt_id=assignment.id order by revision desc limit 1) in ('submitted','published')
  then raise exception 'This assessment is already under review or published.'; end if;
  delete from private.learning_cbt_submissions s where s.cbt_id=assignment.id and s.student_id=learner_id returning * into previous;
  if not found then raise exception 'There is no submitted attempt to restart.'; end if;
  insert into private.learning_cbt_restarts(cbt_id,student_id,restarted_by,previous_submission)
    values(assignment.id,learner_id,auth.uid(),to_jsonb(previous));
end $$;
revoke all on function public.restart_learning_cbt(uuid,uuid) from public,anon;
grant execute on function public.restart_learning_cbt(uuid,uuid) to authenticated;
