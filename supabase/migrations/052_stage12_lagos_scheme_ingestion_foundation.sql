-- KSI 2.0 Stage 12 — Lagos Scheme Ingestion foundation
-- Keep supplied scheme copies distinct from official curriculum content.

alter table public.curriculum_nodes drop constraint if exists curriculum_nodes_node_type_check;
alter table public.curriculum_nodes
  add constraint curriculum_nodes_node_type_check
  check (node_type in ('class','term','week','subject','strand','topic','objective'));

create table public.scheme_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.curriculum_sources(id) on delete restrict,
  framework_id uuid not null references public.curriculum_frameworks(id) on delete restrict,
  original_filename text not null,
  subject_name text not null,
  education_level text not null check (education_level in ('Junior Secondary','Senior Secondary')),
  class_scope text[] not null,
  publisher_copy text,
  authority_claim text,
  provenance_status text not null default 'supplied' check (provenance_status in ('supplied','reviewed','verified','retired')),
  extraction_status text not null default 'registered' check (extraction_status in ('registered','staged','reviewed','ingested','blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(framework_id, original_filename)
);

create table public.scheme_ingestion_batches (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.scheme_documents(id) on delete cascade,
  status text not null default 'staged' check (status in ('staged','review','approved','rejected')),
  extraction_method text not null check (extraction_method in ('parsed_text','vision','manual','structured_import')),
  row_count integer not null default 0 check (row_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text
);

create table public.scheme_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.scheme_documents(id) on delete cascade,
  batch_id uuid references public.scheme_ingestion_batches(id) on delete set null,
  class_level text not null check (class_level in ('JSS1','JSS2','JSS3','SS1','SS2','SS3')),
  term text not null check (term in ('First Term','Second Term','Third Term')),
  week_label text not null,
  week_number integer check (week_number is null or (week_number >= 1 and week_number <= 20)),
  subject_name text not null,
  component_name text,
  topic text not null,
  learning_objectives jsonb not null default '[]'::jsonb,
  learning_activities jsonb not null default '[]'::jsonb,
  embedded_core_skills jsonb not null default '[]'::jsonb,
  learning_resources jsonb not null default '[]'::jsonb,
  source_page integer check (source_page is null or source_page > 0),
  source_reference text,
  normalized_key text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, normalized_key),
  check (jsonb_typeof(learning_objectives) = 'array'),
  check (jsonb_typeof(learning_activities) = 'array'),
  check (jsonb_typeof(embedded_core_skills) = 'array'),
  check (jsonb_typeof(learning_resources) = 'array')
);

create table public.scheme_entry_node_links (
  scheme_entry_id uuid not null references public.scheme_entries(id) on delete cascade,
  curriculum_node_id uuid not null references public.curriculum_nodes(id) on delete cascade,
  link_role text not null check (link_role in ('class','term','week','subject','topic','objective')),
  created_at timestamptz not null default now(),
  primary key (scheme_entry_id, curriculum_node_id, link_role)
);

create index scheme_documents_source_idx on public.scheme_documents(source_id);
create index scheme_documents_framework_idx on public.scheme_documents(framework_id);
create index scheme_documents_level_subject_idx on public.scheme_documents(education_level, subject_name);
create index scheme_batches_document_idx on public.scheme_ingestion_batches(document_id, created_at desc);
create index scheme_batches_created_by_idx on public.scheme_ingestion_batches(created_by);
create index scheme_batches_reviewed_by_idx on public.scheme_ingestion_batches(reviewed_by);
create index scheme_entries_document_review_idx on public.scheme_entries(document_id, review_status);
create index scheme_entries_sequence_idx on public.scheme_entries(class_level, term, subject_name, week_number);
create index scheme_entries_batch_idx on public.scheme_entries(batch_id);
create index scheme_entries_reviewed_by_idx on public.scheme_entries(reviewed_by);
create index scheme_entry_node_links_node_idx on public.scheme_entry_node_links(curriculum_node_id);

alter table public.scheme_documents enable row level security;
alter table public.scheme_ingestion_batches enable row level security;
alter table public.scheme_entries enable row level security;
alter table public.scheme_entry_node_links enable row level security;

revoke all on table public.scheme_documents, public.scheme_ingestion_batches, public.scheme_entries, public.scheme_entry_node_links from anon, authenticated;

insert into public.curriculum_sources(authority, jurisdiction, name, source_url, source_kind, accessed_on, verification_status, metadata)
values (
  'Lagos State Ministry of Education (as stated in supplied documents)',
  'Lagos State, Nigeria',
  'Unified Schemes of Work — supplied PDF copies',
  'urn:ksi:user-supplied:lagos-unified-schemes:2026-08-17',
  'state_scheme',
  date '2026-08-17',
  'registered',
  jsonb_build_object('source_basis','user_supplied_pdf_copies','publisher_copy','Edudelight.com','verification_note','Document provenance is preserved separately from independent authority verification.')
)
on conflict (authority, name, source_url) do update set metadata = excluded.metadata, updated_at = now();

insert into public.curriculum_frameworks(source_id, name, version_label, education_level, status, metadata)
select cs.id, v.name, 'supplied-copy-2026-08-17', v.education_level, 'draft', jsonb_build_object('sequencing_layer','Lagos scheme of work','review_required',true)
from public.curriculum_sources cs
cross join (values ('Lagos Unified Schemes of Work — Junior Secondary','Junior Secondary'),('Lagos Unified Schemes of Work — Senior Secondary','Senior Secondary')) as v(name, education_level)
where cs.source_url = 'urn:ksi:user-supplied:lagos-unified-schemes:2026-08-17'
on conflict (source_id, version_label, education_level) do nothing;

with source_row as (select id from public.curriculum_sources where source_url='urn:ksi:user-supplied:lagos-unified-schemes:2026-08-17'),
docs(original_filename, subject_name, education_level, class_scope) as (
  values
    ('BST JSS 1-3 Edudelight.com.pdf','Basic Science and Technology','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('IRS JSS 1-3 Edudelight.com.pdf','Islamic Religious Studies','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('Mathematics JSS 1-3 Edudelight.com.pdf','Mathematics','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('NVE JSS1 TO JSS3 Edudelight.com.pdf','National Value Education','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('PVS JSS 1-3 Edudelight.com.pdf','Prevocational Studies','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('Yoruba JSS1-3 Edudelight.com.pdf','Yoruba Language','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('Business Studies JSS 1-3 Edudelight.com.pdf','Business Studies','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('CCA JSS 1-3 Edudelight.com.pdf','Cultural and Creative Arts','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('CRS JSS 1-3 Edudelight.com.pdf','Christian Religious Studies','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('English Language JSS1-3 Edudelight.com.pdf','English Language','Junior Secondary',array['JSS1','JSS2','JSS3']::text[]),
    ('Agricultural Science SS1 - SS3.pdf','Agricultural Science','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Biology SS1 - SS3.pdf','Biology','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Chemistry SS1 - SS3.pdf','Chemistry','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('CHRISTIAN RELIGIOUS STUDIES SS1 - SS3.pdf','Christian Religious Studies','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Civic Education SS1 - SSS3.pdf','Civic Education','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Commerce SS1 - SS3.pdf','Commerce','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Data Processing SS1 - SS3.pdf','Data Processing','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('ECONOMICS SS1 -SS3.pdf','Economics','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('English Language SS1 - SS3.pdf','English Language','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Financial Accounting SS1 - SS3.pdf','Financial Accounting','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('GEOGRPAHY SS1 - SS3.pdf','Geography','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Government SS1 - SS3.pdf','Government','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Literature in English SS1 - SS3.pdf','Literature in English','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Mathematics SS1 - SS3.pdf','Mathematics','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Physics SS1 - SS3.pdf','Physics','Senior Secondary',array['SS1','SS2','SS3']::text[]),
    ('Yoruba Language SS1 - SS3.pdf','Yoruba Language','Senior Secondary',array['SS1','SS2','SS3']::text[])
)
insert into public.scheme_documents(source_id, framework_id, original_filename, subject_name, education_level, class_scope, publisher_copy, authority_claim, provenance_status, extraction_status)
select sr.id, cf.id, d.original_filename, d.subject_name, d.education_level, d.class_scope, 'Edudelight.com', 'Lagos State Ministry of Education / Lagos State Government', 'supplied', 'registered'
from docs d cross join source_row sr
join public.curriculum_frameworks cf on cf.source_id=sr.id and cf.education_level=d.education_level and cf.version_label='supplied-copy-2026-08-17'
on conflict (framework_id, original_filename) do nothing;

create or replace function public.stage_scheme_entries(target_document_id uuid, target_entries jsonb, extraction_method text default 'structured_import') returns jsonb
language plpgsql security definer set search_path = public as $$
declare doc public.scheme_documents%rowtype; batch_id uuid; item jsonb; inserted_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then raise exception 'Platform curriculum admin permission required.'; end if;
  if extraction_method not in ('parsed_text','vision','manual','structured_import') then raise exception 'Unsupported extraction method.'; end if;
  if jsonb_typeof(target_entries) <> 'array' then raise exception 'Entries must be a JSON array.'; end if;
  select * into doc from public.scheme_documents where id=target_document_id; if not found then raise exception 'Scheme document not found.'; end if;
  insert into public.scheme_ingestion_batches(document_id,status,extraction_method,created_by) values(target_document_id,'staged',extraction_method,auth.uid()) returning id into batch_id;
  for item in select value from jsonb_array_elements(target_entries) loop
    if coalesce(item->>'class_level','') not in ('JSS1','JSS2','JSS3','SS1','SS2','SS3') then raise exception 'Invalid class level.'; end if;
    if coalesce(item->>'term','') not in ('First Term','Second Term','Third Term') then raise exception 'Invalid term.'; end if;
    if nullif(btrim(item->>'topic'),'') is null then raise exception 'Topic is required.'; end if;
    if nullif(btrim(item->>'normalized_key'),'') is null then raise exception 'normalized_key is required.'; end if;
    insert into public.scheme_entries(document_id,batch_id,class_level,term,week_label,week_number,subject_name,component_name,topic,learning_objectives,learning_activities,embedded_core_skills,learning_resources,source_page,source_reference,normalized_key)
    values(target_document_id,batch_id,item->>'class_level',item->>'term',coalesce(nullif(item->>'week_label',''),'Unspecified'),nullif(item->>'week_number','')::integer,coalesce(nullif(item->>'subject_name',''),doc.subject_name),nullif(item->>'component_name',''),item->>'topic',coalesce(item->'learning_objectives','[]'::jsonb),coalesce(item->'learning_activities','[]'::jsonb),coalesce(item->'embedded_core_skills','[]'::jsonb),coalesce(item->'learning_resources','[]'::jsonb),nullif(item->>'source_page','')::integer,nullif(item->>'source_reference',''),item->>'normalized_key')
    on conflict (document_id,normalized_key) do update set batch_id=excluded.batch_id,class_level=excluded.class_level,term=excluded.term,week_label=excluded.week_label,week_number=excluded.week_number,subject_name=excluded.subject_name,component_name=excluded.component_name,topic=excluded.topic,learning_objectives=excluded.learning_objectives,learning_activities=excluded.learning_activities,embedded_core_skills=excluded.embedded_core_skills,learning_resources=excluded.learning_resources,source_page=excluded.source_page,source_reference=excluded.source_reference,review_status='pending',review_note=null,reviewed_by=null,reviewed_at=null,updated_at=now();
    inserted_count := inserted_count + 1;
  end loop;
  update public.scheme_ingestion_batches set row_count=inserted_count,status='review' where id=batch_id;
  update public.scheme_documents set extraction_status='staged',updated_at=now() where id=target_document_id;
  return jsonb_build_object('batch_id',batch_id,'row_count',inserted_count);
end; $$;

create or replace function public.review_scheme_entry(target_entry_id uuid, target_status text, review_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare entry_row public.scheme_entries%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_platform_access_admin() then raise exception 'Platform curriculum admin permission required.'; end if;
  if target_status not in ('approved','rejected') then raise exception 'Review status must be approved or rejected.'; end if;
  update public.scheme_entries set review_status=target_status,review_note=nullif(btrim(review_note),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=target_entry_id returning * into entry_row;
  if not found then raise exception 'Scheme entry not found.'; end if;
  update public.scheme_documents d set extraction_status=case when target_status='approved' then 'reviewed' else d.extraction_status end,updated_at=now() where d.id=entry_row.document_id;
  return jsonb_build_object('entry_id',entry_row.id,'status',target_status);
end; $$;

create or replace function public.get_scheme_ingestion_intelligence(target_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.has_workspace_role(target_workspace_id,array['owner','admin','leader','teacher']) then raise exception 'School curriculum permission required.'; end if;
  select jsonb_build_object(
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'filename',d.original_filename,'subject',d.subject_name,'education_level',d.education_level,'class_scope',d.class_scope,'provenance_status',d.provenance_status,'extraction_status',d.extraction_status,'entries',(select count(*) from public.scheme_entries e where e.document_id=d.id),'pending',(select count(*) from public.scheme_entries e where e.document_id=d.id and e.review_status='pending'),'approved',(select count(*) from public.scheme_entries e where e.document_id=d.id and e.review_status='approved')) order by d.education_level,d.subject_name) from public.scheme_documents d),'[]'::jsonb),
    'summary',jsonb_build_object('documents',(select count(*) from public.scheme_documents),'junior_documents',(select count(*) from public.scheme_documents where education_level='Junior Secondary'),'senior_documents',(select count(*) from public.scheme_documents where education_level='Senior Secondary'),'entries',(select count(*) from public.scheme_entries),'pending_review',(select count(*) from public.scheme_entries where review_status='pending'),'approved_entries',(select count(*) from public.scheme_entries where review_status='approved'))
  ) into result;
  return result;
end; $$;

revoke all on function public.stage_scheme_entries(uuid,jsonb,text), public.review_scheme_entry(uuid,text,text), public.get_scheme_ingestion_intelligence(uuid) from public, anon;
grant execute on function public.stage_scheme_entries(uuid,jsonb,text), public.review_scheme_entry(uuid,text,text), public.get_scheme_ingestion_intelligence(uuid) to authenticated;
