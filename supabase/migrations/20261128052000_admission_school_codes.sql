create table private.admission_school_codes (
  school_id uuid primary key references public.workspaces(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{2,12}$')
);
alter table private.admission_school_codes enable row level security;
revoke all on private.admission_school_codes from public,anon,authenticated,service_role;

insert into private.admission_school_codes(school_id,code)
select id,'KNS' from public.workspaces where id='33b98324-ddd2-4c64-adcf-532dc792f31f';

create or replace function private.next_admission_number(school uuid, code text, minimum bigint default 0)
returns text language plpgsql security definer set search_path='' as $$
declare
  prefix text := 'KSI//'||code||'/';
  suffix text := coalesce((select '/'||c.code from private.admission_school_codes c where c.school_id=school),'');
  highest bigint;
  allocated bigint;
begin
  if code is null or code !~ '^[js][123]$' or minimum not between 0 and 999999999999 then
    raise exception 'Choose a supported JSS or SS class.' using errcode='22023';
  end if;
  select coalesce(max((split_part(substring(ref from length(prefix)+1),'/',1))::bigint),0) into highest
    from (select external_reference as ref from public.students where workspace_id=school) records
    where ref ~* ('^'||prefix||'[0-9]{1,12}('||suffix||')?$');
  highest := greatest(highest,minimum);
  insert into private.admission_sequences as seq(school_id,class_code,allocation)
    values(school,code,highest+1)
    on conflict(school_id,class_code) do update
      set allocation=greatest(seq.allocation,excluded.allocation-1)+1
    returning allocation into allocated;
  return prefix||lpad(allocated::text,greatest(4,length(allocated::text)),'0')||suffix;
end
$$;
