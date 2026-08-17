-- KSI 2.0 Stage 11 — objective mastery graph + deterministic Next Best Learning Action.

create table if not exists public.learning_objective_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  topic text,
  objective_text text not null,
  objective_key text not null,
  source_kind text not null default 'ksi' check (source_kind in ('ksi','curriculum')),
  curriculum_source text,
  curriculum_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id) on delete restrict,
  foreign key (subject_id, workspace_id) references public.subjects(id, workspace_id) on delete restrict
);

create unique index if not exists learning_objective_nodes_identity_idx
  on public.learning_objective_nodes(workspace_id,class_id,subject_id,objective_key);
create index if not exists learning_objective_nodes_subject_idx
  on public.learning_objective_nodes(workspace_id,class_id,subject_id);

create table if not exists public.learner_mastery (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null,
  objective_node_id uuid not null,
  state text not null check (state in ('mastered','developing','intervention_required','evidence_building')),
  mastery_percent numeric(5,2),
  item_evidence_count integer not null default 0 check (item_evidence_count >= 0),
  qualitative_evidence_count integer not null default 0 check (qualitative_evidence_count >= 0),
  confidence text not null check (confidence in ('low','medium','high')),
  last_evidence_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, objective_node_id),
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade,
  foreign key (objective_node_id, workspace_id) references public.learning_objective_nodes(id, workspace_id) on delete cascade
);

create index if not exists learner_mastery_student_state_idx
  on public.learner_mastery(workspace_id,student_id,state,mastery_percent);
create index if not exists learner_mastery_objective_idx
  on public.learner_mastery(objective_node_id,workspace_id);

create table if not exists public.mastery_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null,
  objective_node_id uuid not null,
  previous_state text,
  new_state text not null,
  previous_mastery_percent numeric(5,2),
  new_mastery_percent numeric(5,2),
  item_evidence_count integer not null default 0,
  qualitative_evidence_count integer not null default 0,
  confidence text not null,
  changed_at timestamptz not null default now(),
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade,
  foreign key (objective_node_id, workspace_id) references public.learning_objective_nodes(id, workspace_id) on delete cascade
);

create index if not exists mastery_events_student_idx on public.mastery_events(workspace_id,student_id,changed_at desc);
create index if not exists mastery_events_objective_idx on public.mastery_events(objective_node_id,changed_at desc);

alter table public.learning_objective_nodes enable row level security;
alter table public.learner_mastery enable row level security;
alter table public.mastery_events enable row level security;
revoke all on public.learning_objective_nodes from anon, authenticated;
revoke all on public.learner_mastery from anon, authenticated;
revoke all on public.mastery_events from anon, authenticated;

create or replace function private.normalise_learning_objective(raw_value text)
returns text language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(raw_value,'')), '\s+', ' ', 'g'));
$$;

create or replace function private.refresh_student_mastery(target_workspace_id uuid, target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public','private'
as $$
begin
  insert into public.learning_objective_nodes(workspace_id,class_id,subject_id,topic,objective_text,objective_key,source_kind)
  select distinct a.workspace_id,a.class_id,a.subject_id,nullif(btrim(ai.topic),''),btrim(ai.objective),private.normalise_learning_objective(ai.objective),'ksi'
  from public.student_evidence se
  join public.assessment_items ai on ai.id=se.assessment_item_id
  join public.assessments a on a.id=se.assessment_id
  where se.workspace_id=target_workspace_id and se.student_id=target_student_id and se.evidence_type='item_result'
    and a.class_id is not null and a.subject_id is not null and nullif(btrim(ai.objective),'') is not null
  on conflict (workspace_id,class_id,subject_id,objective_key)
  do update set topic=coalesce(excluded.topic,public.learning_objective_nodes.topic),objective_text=excluded.objective_text,updated_at=now();

  insert into public.learning_objective_nodes(workspace_id,class_id,subject_id,topic,objective_text,objective_key,source_kind)
  select distinct l.workspace_id,l.class_id,l.subject_id,nullif(btrim(l.topic),''),btrim(l.objective),private.normalise_learning_objective(l.objective),'ksi'
  from public.student_evidence se
  join public.lessons l on l.id=nullif(se.content->>'lesson_id','')::uuid
  where se.workspace_id=target_workspace_id and se.student_id=target_student_id and se.evidence_type='reflection'
    and se.content->>'source'='hqls_lesson_work' and l.class_id is not null and l.subject_id is not null
    and nullif(btrim(l.objective),'') is not null
  on conflict (workspace_id,class_id,subject_id,objective_key)
  do update set topic=coalesce(excluded.topic,public.learning_objective_nodes.topic),objective_text=excluded.objective_text,updated_at=now();

  with aggregate_evidence as (
    select n.id objective_node_id,n.workspace_id,target_student_id student_id,
      count(se.id) filter(where se.evidence_type='item_result')::int item_count,
      count(se.id) filter(where se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work')::int qualitative_count,
      case when sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0)>0
        then round(least(100::numeric,greatest(0::numeric,
          (sum(se.numeric_value) filter(where se.evidence_type='item_result') /
           sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0))*100)),2)
        else null end pct,
      max(se.recorded_at) last_evidence_at
    from public.learning_objective_nodes n
    left join public.assessments a on a.workspace_id=n.workspace_id and a.class_id=n.class_id and a.subject_id=n.subject_id
    left join public.assessment_items ai on ai.assessment_id=a.id and private.normalise_learning_objective(ai.objective)=n.objective_key
    left join public.student_evidence se on se.workspace_id=n.workspace_id and se.student_id=target_student_id and (
      (se.evidence_type='item_result' and se.assessment_item_id=ai.id)
      or (se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work' and exists(
        select 1 from public.lessons l where l.id=nullif(se.content->>'lesson_id','')::uuid and l.workspace_id=n.workspace_id
          and l.class_id=n.class_id and l.subject_id=n.subject_id and private.normalise_learning_objective(l.objective)=n.objective_key)))
    where n.workspace_id=target_workspace_id and exists(
      select 1 from public.students s where s.id=target_student_id and s.workspace_id=target_workspace_id and s.class_id=n.class_id)
    group by n.id,n.workspace_id
  ), derived as (
    select *,case
      when item_count>=2 and pct>=80 then 'mastered'
      when item_count>=2 and pct>=50 then 'developing'
      when item_count>=2 then 'intervention_required'
      when item_count=0 and qualitative_count>=2 then 'developing'
      else 'evidence_building' end derived_state,
      case when item_count>=4 then 'high' when item_count>=2 or qualitative_count>=2 then 'medium' else 'low' end derived_confidence
    from aggregate_evidence where item_count>0 or qualitative_count>0
  )
  insert into public.mastery_events(workspace_id,student_id,objective_node_id,previous_state,new_state,previous_mastery_percent,new_mastery_percent,item_evidence_count,qualitative_evidence_count,confidence,changed_at)
  select d.workspace_id,d.student_id,d.objective_node_id,lm.state,d.derived_state,lm.mastery_percent,d.pct,d.item_count,d.qualitative_count,d.derived_confidence,now()
  from derived d left join public.learner_mastery lm on lm.student_id=d.student_id and lm.objective_node_id=d.objective_node_id
  where lm.id is null or lm.state is distinct from d.derived_state or lm.mastery_percent is distinct from d.pct;

  with aggregate_evidence as (
    select n.id objective_node_id,n.workspace_id,target_student_id student_id,
      count(se.id) filter(where se.evidence_type='item_result')::int item_count,
      count(se.id) filter(where se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work')::int qualitative_count,
      case when sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0)>0
        then round(least(100::numeric,greatest(0::numeric,
          (sum(se.numeric_value) filter(where se.evidence_type='item_result') /
           sum(ai.marks) filter(where se.evidence_type='item_result' and ai.marks>0))*100)),2)
        else null end pct,
      max(se.recorded_at) last_evidence_at
    from public.learning_objective_nodes n
    left join public.assessments a on a.workspace_id=n.workspace_id and a.class_id=n.class_id and a.subject_id=n.subject_id
    left join public.assessment_items ai on ai.assessment_id=a.id and private.normalise_learning_objective(ai.objective)=n.objective_key
    left join public.student_evidence se on se.workspace_id=n.workspace_id and se.student_id=target_student_id and (
      (se.evidence_type='item_result' and se.assessment_item_id=ai.id)
      or (se.evidence_type='reflection' and se.content->>'source'='hqls_lesson_work' and exists(
        select 1 from public.lessons l where l.id=nullif(se.content->>'lesson_id','')::uuid and l.workspace_id=n.workspace_id
          and l.class_id=n.class_id and l.subject_id=n.subject_id and private.normalise_learning_objective(l.objective)=n.objective_key)))
    where n.workspace_id=target_workspace_id and exists(
      select 1 from public.students s where s.id=target_student_id and s.workspace_id=target_workspace_id and s.class_id=n.class_id)
    group by n.id,n.workspace_id
  ), derived as (
    select *,case
      when item_count>=2 and pct>=80 then 'mastered'
      when item_count>=2 and pct>=50 then 'developing'
      when item_count>=2 then 'intervention_required'
      when item_count=0 and qualitative_count>=2 then 'developing'
      else 'evidence_building' end derived_state,
      case when item_count>=4 then 'high' when item_count>=2 or qualitative_count>=2 then 'medium' else 'low' end derived_confidence
    from aggregate_evidence where item_count>0 or qualitative_count>0
  )
  insert into public.learner_mastery(workspace_id,student_id,objective_node_id,state,mastery_percent,item_evidence_count,qualitative_evidence_count,confidence,last_evidence_at)
  select workspace_id,student_id,objective_node_id,derived_state,pct,item_count,qualitative_count,derived_confidence,last_evidence_at from derived
  on conflict(student_id,objective_node_id) do update set state=excluded.state,mastery_percent=excluded.mastery_percent,item_evidence_count=excluded.item_evidence_count,
    qualitative_evidence_count=excluded.qualitative_evidence_count,confidence=excluded.confidence,last_evidence_at=excluded.last_evidence_at,updated_at=now();
end;
$$;

revoke all on function private.refresh_student_mastery(uuid,uuid) from public,anon,authenticated;

create or replace function private.refresh_mastery_from_evidence()
returns trigger language plpgsql security definer set search_path='public','private' as $$
begin
  perform private.refresh_student_mastery(coalesce(new.workspace_id,old.workspace_id),coalesce(new.student_id,old.student_id));
  return coalesce(new,old);
end;
$$;

drop trigger if exists student_evidence_refresh_mastery on public.student_evidence;
create trigger student_evidence_refresh_mastery after insert or update or delete on public.student_evidence
for each row execute function private.refresh_mastery_from_evidence();

create or replace function public.get_my_mastery_graph()
returns jsonb
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  account_row public.student_accounts;
  student_row public.students;
  objectives_json jsonb;
  summary_json jsonb;
  next_action jsonb;
  intervention_row public.intervention_handoffs;
  priority_mastery record;
  resource_lesson record;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select sa.* into account_row from public.student_accounts sa join public.workspaces w on w.id=sa.workspace_id
  where sa.user_id=auth.uid() and sa.active=true and w.access_status='active' limit 1;
  if not found then raise exception 'No active KSI student account is available.'; end if;
  select * into student_row from public.students s where s.id=account_row.student_id and s.workspace_id=account_row.workspace_id and s.active=true;
  if not found then raise exception 'Student learning record is unavailable.'; end if;

  perform private.refresh_student_mastery(account_row.workspace_id,account_row.student_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'objective_id',n.id,'subject_id',n.subject_id,'subject',sub.name,'topic',n.topic,'objective',n.objective_text,
    'state',lm.state,'mastery_percent',lm.mastery_percent,'item_evidence_count',lm.item_evidence_count,
    'qualitative_evidence_count',lm.qualitative_evidence_count,'confidence',lm.confidence,'last_evidence_at',lm.last_evidence_at
  ) order by case lm.state when 'intervention_required' then 1 when 'developing' then 2 when 'evidence_building' then 3 else 4 end,
    lm.mastery_percent asc nulls last,lm.last_evidence_at desc nulls last),'[]'::jsonb)
  into objectives_json
  from public.learner_mastery lm join public.learning_objective_nodes n on n.id=lm.objective_node_id join public.subjects sub on sub.id=n.subject_id
  where lm.workspace_id=account_row.workspace_id and lm.student_id=account_row.student_id;

  select jsonb_build_object('total_objectives',count(*),'mastered',count(*) filter(where state='mastered'),
    'developing',count(*) filter(where state='developing'),'intervention_required',count(*) filter(where state='intervention_required'),
    'evidence_building',count(*) filter(where state='evidence_building'))
  into summary_json from public.learner_mastery where workspace_id=account_row.workspace_id and student_id=account_row.student_id;

  select * into intervention_row from public.intervention_handoffs ih
  where ih.workspace_id=account_row.workspace_id and ih.student_id=account_row.student_id and ih.status='confirmed'
  order by coalesce(ih.confirmed_at,ih.updated_at) desc limit 1;

  if found then
    next_action:=jsonb_build_object('source','intervention','title',coalesce(intervention_row.priority_growth_target,'Continue your current improvement plan'),
      'action',coalesce(intervention_row.next_learning_adjustment,intervention_row.success_indicator,'Continue the agreed learning action.'),
      'why','This is your latest confirmed KSI intervention and remains the highest-priority learning action.','objective_id',null,'lesson_id',null);
  else
    select lm.*,n.subject_id,n.topic,n.objective_text,n.objective_key,n.class_id,sub.name subject_name into priority_mastery
    from public.learner_mastery lm join public.learning_objective_nodes n on n.id=lm.objective_node_id join public.subjects sub on sub.id=n.subject_id
    where lm.workspace_id=account_row.workspace_id and lm.student_id=account_row.student_id
      and lm.state in ('intervention_required','developing','evidence_building')
    order by case lm.state when 'intervention_required' then 1 when 'developing' then 2 else 3 end,
      lm.mastery_percent asc nulls last,case lm.confidence when 'high' then 1 when 'medium' then 2 else 3 end,lm.last_evidence_at desc nulls last limit 1;

    if found then
      select l.id,l.title into resource_lesson from public.lessons l
      where l.workspace_id=account_row.workspace_id and l.class_id=priority_mastery.class_id and l.subject_id=priority_mastery.subject_id and l.status='validated'
        and (private.normalise_learning_objective(l.objective)=priority_mastery.objective_key or lower(l.topic)=lower(coalesce(priority_mastery.topic,'')))
      order by l.updated_at desc limit 1;
      next_action:=jsonb_build_object('source','mastery','title',priority_mastery.subject_name||': '||priority_mastery.objective_text,
        'action',case priority_mastery.state when 'intervention_required' then 'Relearn this objective, work through a relevant example, then try fresh practice before reassessment.'
          when 'developing' then 'Practise this objective again and explain your reasoning in your own words.'
          else 'Complete more practice so KSI has enough evidence to judge your mastery confidently.' end,
        'why',case when priority_mastery.mastery_percent is not null then 'KSI selected this from your objective-level evidence. Current mastery is '||trim(to_char(priority_mastery.mastery_percent,'990D00'))||'% with '||priority_mastery.confidence||' confidence.'
          else 'KSI selected this because your current evidence is still limited and needs strengthening.' end,
        'objective_id',priority_mastery.objective_node_id,'lesson_id',resource_lesson.id,'lesson_title',resource_lesson.title);
    else
      next_action:=jsonb_build_object('source','baseline','title','Build your next piece of learning evidence',
        'action','Open your class learning resources and complete your next lesson activity or assessment.',
        'why','KSI does not yet have enough objective-level evidence to select a more specific priority.','objective_id',null,'lesson_id',null);
    end if;
  end if;

  return jsonb_build_object('student_id',account_row.student_id,'class_id',student_row.class_id,'summary',summary_json,'next_best_action',next_action,'objectives',objectives_json);
end;
$$;

revoke execute on function public.get_my_mastery_graph() from public,anon;
grant execute on function public.get_my_mastery_graph() to authenticated;

comment on function public.get_my_mastery_graph() is
  'Student-safe objective mastery graph and deterministic Next Best Learning Action. Numeric mastery uses assessment item marks; reviewed qualitative lesson evidence strengthens the evidence picture but never inflates mastery percentage.';

do $$ declare r record; begin
  for r in select distinct se.workspace_id,se.student_id from public.student_evidence se join public.students s on s.id=se.student_id and s.workspace_id=se.workspace_id where s.active=true
  loop perform private.refresh_student_mastery(r.workspace_id,r.student_id); end loop;
end $$;
