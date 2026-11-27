
create table private.admission_sequences (
  school_id uuid not null,
  class_code text not null,
  allocation bigint not null,
  primary key(school_id,class_code)
);
alter table private.admission_sequences enable row level security;
revoke all on private.admission_sequences from public,anon,authenticated;

create function private.admission_class_code(class_name text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(regexp_replace(raw, '[[:space:]]', '', 'g'), '^(jss|sss|ss)', left(raw,1))
  from (  select replace(substring(lower(btrim(class_name)) from '^(jss[[:space:]]*[123]|sss?[[:space:]]*[123]|[js][123])(?:[^0-9]|$)'), ' ', '')
) as matched(raw);
$$;

create function private.next_admission_number(school uuid, code text, minimum bigint default 0)
returns text language plpgsql security definer set search_path='' as $$
declare
  prefix text := 'KSI//'||code||'/';
  highest bigint;
  allocated bigint;
begin
  if code is null or code !~ '^[js][123]$' or minimum not between 0 and 999999999999 then
    raise exception 'Choose a supported JSS or SS class.' using errcode='22023';
  end if;
  select coalesce(max((right(ref,length(ref)-length(prefix)))::bigint),0) into highest
    from (select external_reference as ref from public.students where workspace_id=school) records
    where ref ~* ('^'||prefix||'[0-9]{1,12}$');
  highest := greatest(highest,minimum);
  insert into private.admission_sequences as seq(school_id,class_code,allocation)
    values(school,code,highest+1)
    on conflict(school_id,class_code) do update
      set allocation=greatest(seq.allocation,excluded.allocation-1)+1
    returning allocation into allocated;
  return prefix||lpad(allocated::text,greatest(4,length(allocated::text)),'0');
end
$$;
revoke all on function private.next_admission_number(uuid,text,bigint) from public,anon,authenticated,service_role;

create function private.auto_learner_admission()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  code text;
begin
  if nullif(btrim(new.external_reference),'') is not null then return new; end if;
  select private.admission_class_code(c.name) into code from public.classes c
    where c.id=new.class_id and c.workspace_id=new.workspace_id and c.active;
  if code is not null then
    new.external_reference := private.next_admission_number(new.workspace_id,code);
  end if;
  return new;
end
$$;
create trigger auto_learner_admission before insert or update of class_id,external_reference on public.students
  for each row execute function private.auto_learner_admission();

create function public.reserve_school_admission_number(p_workspace uuid,p_class_code text,p_minimum bigint)
returns text language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.workspaces w where w.id=p_workspace
    and w.workspace_type='school' and w.access_status='active') then
    raise exception 'Choose an active school.' using errcode='42501';
  end if;
  return private.next_admission_number(p_workspace,p_class_code,p_minimum);
end
$$;
revoke all on function public.reserve_school_admission_number(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_school_admission_number(uuid,text,bigint) to service_role;
