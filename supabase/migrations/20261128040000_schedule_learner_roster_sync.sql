create table public.learner_roster_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  school_id uuid not null,
  campus_id uuid not null,
  source_class_id uuid not null,
  destination_class_id uuid not null,
  term_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  next_run timestamptz not null default now(),
  revision uuid not null default gen_random_uuid(),
  after_id uuid,
  last_run timestamptz,
  last_status text,
  review_count integer not null default 0,
  unique (workspace_id,destination_class_id)
);
alter table public.learner_roster_sync_jobs enable row level security;
revoke all on public.learner_roster_sync_jobs from public,anon,authenticated;
grant select,insert,update on public.learner_roster_sync_jobs to service_role;
create index learner_roster_sync_jobs_due on public.learner_roster_sync_jobs (next_run,id) where enabled;

create function public.run_khpos_roster_sync_page(p_job uuid,p_revision uuid,p_session text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  job public.learner_roster_sync_jobs;
begin
  select * into job from public.learner_roster_sync_jobs
    where id=p_job and revision=p_revision and enabled for update;
  if not found then raise exception 'Schedule changed.' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',job.actor_id::text,true);
  return public.import_khpos_roster(job.workspace_id,job.school_id,job.destination_class_id,p_session,p_rows);
end
$$;
revoke all on function public.run_khpos_roster_sync_page(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.run_khpos_roster_sync_page(uuid,uuid,text,jsonb) to service_role;
