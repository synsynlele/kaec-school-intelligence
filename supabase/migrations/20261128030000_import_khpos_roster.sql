create table private.khpos_imported_learners (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  school_id uuid not null,
  khpos_learner_id uuid not null,
  student_id uuid not null unique references public.students(id) on delete cascade,
  primary key(workspace_id,school_id,khpos_learner_id)
);
alter table private.khpos_imported_learners enable row level security;
revoke all on private.khpos_imported_learners from public,anon,authenticated;

create function public.import_khpos_roster(p_workspace uuid,p_school uuid,p_class uuid,p_session text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  item jsonb;
  source_id uuid;
  linked_id uuid;
  learner_name text;
  admission text;
  destination public.classes;
  learner public.students;
  matches uuid[];
  results jsonb := '[]'::jsonb;
begin
  if actor is null or not coalesce(private.has_workspace_role(p_workspace,array['owner','admin']),false)
    or not exists(select 1 from public.workspaces w
      where w.id=p_workspace and w.workspace_type='school' and w.access_status='active') then
    raise exception 'School Owner or Admin access is required.' using errcode='42501';
  end if;
  select * into destination from public.classes c where c.id=p_class and c.workspace_id=p_workspace and c.active;
  if not found or p_session is null or destination.academic_session is null
    or regexp_replace(btrim(destination.academic_session),'^([0-9]{4})[ /-]+(?:[0-9]{2})?([0-9]{2})$','\1/\2')
      <> regexp_replace(btrim(p_session),'^([0-9]{4})[ /-]+(?:[0-9]{2})?([0-9]{2})$','\1/\2')
    or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>50 then
    raise exception 'Choose an active KSI class in the same academic session.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('khpos-roster:'||p_workspace::text,0));
  for item in select value from jsonb_array_elements(p_rows) loop
    admission := btrim(item->>'admission');
    learner_name := btrim(item->>'name');
    begin
      source_id := (item->>'id')::uuid;
      linked_id := (item->>'linked')::uuid;
      if source_id is null or coalesce(length(admission),0) not between 1 and 120
        or coalesce(length(learner_name),0) not between 1 and 240 then
        raise exception 'Add a valid name and admission number in KHP-OS.' using errcode='22023';
      end if;
      select s.* into learner from private.khpos_imported_learners l
        join public.students s on s.id=l.student_id and s.workspace_id=l.workspace_id
        where l.workspace_id=p_workspace and l.school_id=p_school and l.khpos_learner_id=source_id
        for update of s;
      if learner.id is null and linked_id is not null then
        select * into learner from public.students s where s.id=linked_id and s.workspace_id=p_workspace for update;
        if not found then
          raise exception 'The previously linked learner needs review in KSI.' using errcode='22023';
        end if;
      end if;
      if learner.id is null then
        select array_agg(s.id) into matches from public.students s
          where s.workspace_id=p_workspace and lower(btrim(s.external_reference))=lower(admission);
        if cardinality(matches)>1 then
          raise exception 'Multiple KSI learners have this admission number.' using errcode='22023';
        elsif cardinality(matches)=1 then
          select * into learner from public.students s where s.id=matches[1] for update;
        end if;
      end if;
      if learner.id is null then
        insert into public.students(workspace_id,class_id,display_name,external_reference,active,created_by)
        values(p_workspace,p_class,learner_name,admission,true,actor)
        returning * into learner;
      elsif learner.class_id is distinct from p_class or not learner.active
        or lower(btrim(learner.external_reference)) is distinct from lower(admission)
        or lower(btrim(learner.display_name)) is distinct from lower(learner_name) then
        raise exception 'Review the existing learner’s name, admission number, class or status in KSI.' using errcode='22023';
      end if;
      insert into private.khpos_imported_learners(workspace_id,school_id,khpos_learner_id,student_id)
      values(p_workspace,p_school,source_id,learner.id) on conflict(workspace_id,school_id,khpos_learner_id) do nothing;
      results := results || jsonb_build_array(jsonb_build_object('result','synced'));
    exception when sqlstate '22023' or unique_violation or invalid_text_representation then
      results := results || jsonb_build_array(jsonb_build_object('result','review','name',learner_name,'admission',admission,
        'message',case when sqlstate='22023' then sqlerrm else 'Review the learner and their existing links in KSI.' end));
    end;
  end loop;
  return results;
end
$$;
revoke all on function public.import_khpos_roster(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.import_khpos_roster(uuid,uuid,uuid,text,jsonb) to authenticated;
