create table private.learning_parent_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);

create table private.learning_parent_links (
  parent_id uuid not null references private.learning_parent_accounts(id) on delete cascade,
  learner_id uuid not null references public.students(id) on delete cascade,
  primary key (parent_id, learner_id)
);
create index learning_parent_links_learner_idx on private.learning_parent_links(learner_id);

create table private.learning_passport_photos (
  learner_id uuid primary key references public.students(id) on delete cascade,
  jpeg text not null,
  updated_by uuid references auth.users(id) on delete set null
);

alter table private.learning_parent_accounts enable row level security;
alter table private.learning_parent_links enable row level security;
alter table private.learning_passport_photos enable row level security;

create function private.can_manage_learning_families(school_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(private.has_workspace_role(school_id, array['owner','admin']), false)
    and exists (select 1 from public.workspaces w where w.id = school_id
      and w.workspace_type = 'school' and w.access_status = 'active')
$$;

create function public.get_learning_family_setup(school_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_learning_families(school_id) then raise exception 'School administrator access is required.'; end if;
  return jsonb_build_object(
    'learners', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.display_name, 'class_name', c.name, 'has_photo', photo.learner_id is not null)
      order by s.display_name, s.id)
      from public.students s left join public.classes c on c.id = s.class_id and c.workspace_id = s.workspace_id
      left join private.learning_passport_photos photo on photo.learner_id = s.id
      where s.workspace_id = school_id and s.active), '[]'::jsonb),
    'parents', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name,
      'username', p.username, 'status', case
        when p.revoked_at is not null then 'Revoked'
        when p.activated_at is not null then 'Active'
        when p.expires_at <= now() then 'Expired'
        else 'Awaiting activation' end,
      'learners', coalesce((select jsonb_agg(s.display_name order by s.display_name)
        from private.learning_parent_links l join public.students s on s.id=l.learner_id
        where l.parent_id = p.id and s.workspace_id = school_id), '[]'::jsonb))
      order by p.display_name, p.id)
      from private.learning_parent_accounts p where p.workspace_id = school_id), '[]'::jsonb)
  );
end;
$$;

create function public.register_learning_parent(
  school_id uuid, parent_id uuid, parent_name text, learner_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  login_name text;
begin
  if not private.can_manage_learning_families(school_id) then raise exception 'School administrator access is required.'; end if;
  if cardinality(learner_ids) is null or cardinality(learner_ids) not between 1 and 30
    or length(btrim(coalesce(parent_name, ''))) not between 1 and 120
    or exists (select 1 from unnest(learner_ids) learner_id where not exists (
      select 1 from public.students s where s.id=learner_id and s.workspace_id=school_id and s.active
    )) then raise exception 'Enter a parent name and select active learners from this school.'; end if;

  select u.email into login_name from auth.users u
    where u.id = parent_id and u.raw_app_meta_data->>'ksi_parent_school' = school_id::text
      and u.email like '%@parents.ksi.name.ng';
  if login_name is null then raise exception 'The school-issued identity could not be verified.'; end if;

  insert into private.learning_parent_accounts (id, workspace_id, username, display_name, created_by)
    values (parent_id, school_id, login_name, btrim(parent_name), auth.uid());
  insert into private.learning_parent_links (parent_id, learner_id)
    select distinct parent_id, learner_id from unnest(learner_ids) learner_id;
end;
$$;

create function public.revoke_learning_parent(school_id uuid, account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_learning_families(school_id) then raise exception 'School administrator access is required.'; end if;
  update private.learning_parent_accounts set revoked_at = coalesce(revoked_at, now())
    where id = account_id and workspace_id = school_id;
  if not found then raise exception 'Parent account unavailable.'; end if;
end;
$$;

create function public.get_my_learning_parent_status()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p.revoked_at is not null or w.access_status <> 'active' then 'unavailable'
    when p.activated_at is not null then 'active'
    when p.expires_at > now() then 'temporary'
    else 'unavailable' end
  from private.learning_parent_accounts p join public.workspaces w on w.id=p.workspace_id
  where p.id = auth.uid()
$$;

create function public.activate_learning_parent(account_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update private.learning_parent_accounts set activated_at = now()
    where id = account_id and revoked_at is null and activated_at is null and expires_at > now();
  return found;
end;
$$;

create function private.learning_report_parent_can_read(target_learner uuid, school_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.learning_parent_accounts p
    join private.learning_parent_links l on l.parent_id = p.id
    join public.workspaces w on w.id = p.workspace_id
    join auth.sessions session on session.id::text = auth.jwt()->>'session_id'
      and session.user_id = p.id and session.created_at > p.activated_at
    where p.id = auth.uid() and p.workspace_id = school_id and l.learner_id = target_learner
      and p.revoked_at is null and p.activated_at is not null
      and w.workspace_type = 'school' and w.access_status = 'active'
  )
$$;

create function public.get_my_parent_learning_results()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', r.snapshot->>'title', 'published_at', r.recorded_at,
    'learner_id', s.id, 'learner_name', coalesce(scores.value->>'name', s.display_name),
    'maxima', r.snapshot->'maxima', 'scores', scores.value - 'id' - 'name' - 'revision' - 'editable'
  ) order by s.display_name, r.recorded_at desc, c.id), '[]'::jsonb)
  from private.learning_parent_accounts p
  join private.learning_parent_links l on l.parent_id=p.id
  join public.students s on s.id=l.learner_id and s.workspace_id=p.workspace_id and s.active
  join private.learning_cbts c on c.workspace_id=s.workspace_id
  join private.learning_result_reviews r on r.cbt_id=c.id and r.action='published'
  cross join lateral jsonb_array_elements(r.snapshot->'roster') scores
  where p.id=auth.uid() and private.learning_report_parent_can_read(s.id,s.workspace_id)
    and scores.value->>'id'=s.id::text
$$;

create function public.save_learning_passport_photo(school_id uuid, target_learner uuid, photo_jpeg text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  image_bytes bytea;
begin
  if not private.can_manage_learning_families(school_id) then raise exception 'School administrator access is required.'; end if;
  perform 1 from public.students s where s.id=target_learner and s.workspace_id=school_id and s.active for share;
  if not found then raise exception 'Learner unavailable.'; end if;
  if photo_jpeg is null then
    delete from private.learning_passport_photos where learner_id=target_learner;
    return;
  end if;
  if octet_length(photo_jpeg) > 220000 or photo_jpeg !~ '^[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Upload a valid passport photo under 165 KB.';
  end if;
  image_bytes := decode(photo_jpeg, 'base64');
  if substring(image_bytes from 1 for 3) <> decode('ffd8ff','hex')
    or substring(image_bytes from octet_length(image_bytes)-1) <> decode('ffd9','hex')
  then raise exception 'Upload a valid JPEG passport photo.'; end if;

  insert into private.learning_passport_photos (learner_id, jpeg, updated_by)
    values (target_learner, photo_jpeg, auth.uid())
  on conflict (learner_id) do update set jpeg=excluded.jpeg, updated_by=excluded.updated_by;
end;
$$;

revoke all on function private.can_manage_learning_families(uuid),
  private.learning_report_parent_can_read(uuid,uuid) from public, anon, authenticated;
revoke all on function public.get_learning_family_setup(uuid), public.register_learning_parent(uuid,uuid,text,uuid[]),
  public.revoke_learning_parent(uuid,uuid), public.get_my_learning_parent_status(),
  public.get_my_parent_learning_results(), public.save_learning_passport_photo(uuid,uuid,text) from public, anon;
grant execute on function public.get_learning_family_setup(uuid), public.register_learning_parent(uuid,uuid,text,uuid[]),
  public.revoke_learning_parent(uuid,uuid), public.get_my_learning_parent_status(),
  public.get_my_parent_learning_results(), public.save_learning_passport_photo(uuid,uuid,text) to authenticated;
revoke all on function public.activate_learning_parent(uuid) from public, anon, authenticated;
grant execute on function public.activate_learning_parent(uuid) to service_role;

create function private.learning_result_report(assignment_id uuid, target_learner uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner public.students;
  result jsonb;
begin
  select * into learner from public.students where id=target_learner and active;
  if learner.id is null then return null; end if;

  select jsonb_build_object(
    'id', c.id, 'title', r.snapshot->>'title', 'published_at', r.recorded_at,
    'maxima', r.snapshot->'maxima',
    'scores', scores.value - 'id' - 'name' - 'revision' - 'editable',
    'administrative_comment', r.snapshot->'administrative_comments'->>(learner.id::text),
    'school_name', w.name, 'school_logo', w.logo_url,
    'passport_photo', photo.jpeg,
    'learner_name', coalesce(scores.value->>'name', learner.display_name),
    'class_name', cl.name,
    'academic_session', coalesce(nullif(d.academic_session, ''), a.blueprint->>'academicSession', cl.academic_session),
    'term', coalesce(nullif(d.term, ''), a.blueprint->>'term'),
    'diagnosis', case when d.id is not null then jsonb_build_object(
      'conciseDiagnosis', d.concise_diagnosis,
      'academicSkillStrengths', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.academic_strengths) v),
      'academicSkillChallenges', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.academic_challenges) v),
      'characterStrengths', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.character_strengths) v),
      'characterChallenges', (select coalesce(jsonb_agg(jsonb_build_object('statement', v->>'statement')), '[]'::jsonb) from jsonb_array_elements(d.character_challenges) v),
      'schoolAcademicActions', private.learning_report_actions(d.school_academic_actions),
      'parentAcademicActions', private.learning_report_actions(d.parent_academic_actions),
      'schoolCharacterActions', private.learning_report_actions(d.school_character_actions),
      'parentCharacterActions', private.learning_report_actions(d.parent_character_actions),
      'builderGrowthDirection', coalesce(d.builder_growth_direction, ''),
      'encouragementNote', coalesce(d.encouragement_note, '')
    ) end,
    'diagnosis_reviewed_at', d.reviewed_at, 'diagnosis_finalised_at', d.finalised_at,
    'diagnosis_mode', d.diagnosis_mode
  ) into result
  from private.learning_cbts c
  join private.learning_result_reviews r on r.cbt_id = c.id and r.action = 'published'
  join public.workspaces w on w.id = c.workspace_id
  left join private.learning_passport_photos photo on photo.learner_id = learner.id
  left join public.classes cl on cl.id = c.class_id and cl.workspace_id = c.workspace_id
  left join public.assessments a on a.id = c.assessment_id and a.workspace_id = c.workspace_id
  cross join lateral jsonb_array_elements(r.snapshot->'roster') scores
  left join lateral (
    select diagnosis.*
    from public.diagnoses diagnosis
    where diagnosis.workspace_id = c.workspace_id and diagnosis.student_id = learner.id
      and diagnosis.assessment_id = c.assessment_id and diagnosis.status = 'final'
      and diagnosis.reviewed_at is not null and diagnosis.finalised_at is not null
      and nullif(diagnosis.term, '') is not null
      and nullif(diagnosis.academic_session, '') is not null
    order by diagnosis.finalised_at desc, diagnosis.id
    limit 1
  ) d on true
  where c.id = assignment_id and c.workspace_id = learner.workspace_id
    and scores.value->>'id' = learner.id::text;
  return result;
end;
$$;


revoke all on function private.learning_result_report(uuid,uuid) from public, anon, authenticated;

create function public.get_my_learning_result_report(assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner public.students := private.learning_cbt_student();
begin
  if learner.id is null then raise exception 'An active learner account is required.'; end if;
  return private.learning_result_report(assignment_id,learner.id);
end;
$$;

create function public.get_my_parent_learning_report(assignment_id uuid,target_learner uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  school_id uuid;
begin
  select workspace_id into school_id from public.students where id=target_learner and active;
  if not private.learning_report_parent_can_read(target_learner,school_id) then return null; end if;
  return private.learning_result_report(assignment_id,target_learner);
end;
$$;
revoke all on function public.get_my_parent_learning_report(uuid,uuid) from public, anon;
grant execute on function public.get_my_parent_learning_report(uuid,uuid) to authenticated;
revoke all on function public.get_my_learning_result_report(uuid) from public, anon;
grant execute on function public.get_my_learning_result_report(uuid) to authenticated;
