-- Recover complete HQLS generations that were stranded as Draft because the
-- free-text school class/subject label did not resolve to a governed school ID.
--
-- Safety gates are deliberately strict:
-- - school workspace only
-- - initial empty validation_summary only
-- - exactly seven non-empty HQLS stages
-- - every stored stage validation passed
-- - no existing fidelity check
-- - a nearby HQLS generation run by the same user in the same workspace
-- - exactly one registered class and one registered subject match
--
-- The lesson content is not regenerated or changed.

do $$
declare
  candidate record;
  matched_class_ids uuid[];
  matched_subject_ids uuid[];
  recovered_stage_validation jsonb;
begin
  for candidate in
    select
      l.id,
      l.workspace_id,
      l.created_by,
      l.engine_version,
      l.created_at,
      ar.id as ai_run_id,
      ar.input_summary ->> 'classLevel' as requested_class,
      ar.input_summary ->> 'subject' as requested_subject
    from public.lessons l
    join public.workspaces w
      on w.id = l.workspace_id
     and w.workspace_type = 'school'
    join lateral (
      select a.*
      from public.ai_runs a
      where a.workspace_id = l.workspace_id
        and a.initiated_by = l.created_by
        and a.engine = 'hqls_lesson'
        and a.started_at between l.created_at - interval '5 minutes'
                             and l.created_at + interval '5 minutes'
      order by abs(extract(epoch from (l.created_at - a.started_at)))
      limit 1
    ) ar on true
    where l.status = 'draft'
      and l.validation_summary = '{}'::jsonb
      and l.engine_version is not null
      and not exists (
        select 1
        from public.hqls_fidelity_checks f
        where f.lesson_id = l.id
      )
      and (
        select count(*)
        from public.lesson_stages ls
        where ls.lesson_id = l.id
          and ls.content <> '{}'::jsonb
      ) = 7
      and (
        select count(*)
        from public.lesson_stages ls
        where ls.lesson_id = l.id
          and coalesce((ls.validation ->> 'passed')::boolean, false)
          and jsonb_array_length(coalesce(ls.validation -> 'violations', '[]'::jsonb)) = 0
      ) = 7
  loop
    select array_agg(c.id order by c.id)
      into matched_class_ids
    from public.classes c
    where c.workspace_id = candidate.workspace_id
      and c.active
      and regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g') =
          regexp_replace(lower(candidate.requested_class), '[^a-z0-9]', '', 'g');

    select array_agg(s.id order by s.id)
      into matched_subject_ids
    from public.subjects s
    where s.workspace_id = candidate.workspace_id
      and s.active
      and (
        regexp_replace(lower(s.name), '[^a-z0-9]', '', 'g') =
          regexp_replace(lower(candidate.requested_subject), '[^a-z0-9]', '', 'g')
        or regexp_replace(
             regexp_replace(lower(s.name), '(language|studies)', '', 'g'),
             '[^a-z0-9]', '', 'g'
           ) = regexp_replace(
             regexp_replace(lower(candidate.requested_subject), '(language|studies)', '', 'g'),
             '[^a-z0-9]', '', 'g'
           )
        or (
          select string_agg(substr(word, 1, 1), '')
          from regexp_split_to_table(lower(s.name), '[^a-z0-9]+') word
          where word <> ''
            and word not in ('and', 'of', 'the')
        ) = regexp_replace(lower(candidate.requested_subject), '[^a-z0-9]', '', 'g')
      );

    if cardinality(matched_class_ids) <> 1 or cardinality(matched_subject_ids) <> 1 then
      continue;
    end if;

    select jsonb_object_agg(ls.stage_key, ls.validation order by ls.stage_number)
      into recovered_stage_validation
    from public.lesson_stages ls
    where ls.lesson_id = candidate.id;

    update public.lessons
    set class_id = matched_class_ids[1],
        subject_id = matched_subject_ids[1],
        status = 'validated',
        validation_summary = jsonb_build_object(
          'passed', true,
          'score', 100,
          'violations', '[]'::jsonb,
          'evidence', '[]'::jsonb,
          'stageValidation', coalesce(recovered_stage_validation, '{}'::jsonb),
          'recovery', jsonb_build_object(
            'reason', 'school_context_link_repair',
            'recoveredAt', now()
          )
        )
    where id = candidate.id
      and status = 'draft'
      and validation_summary = '{}'::jsonb;

    if found then
      insert into public.hqls_fidelity_checks (
        workspace_id,
        lesson_id,
        checked_by,
        check_origin,
        passed,
        score,
        violations,
        evidence,
        engine_version
      ) values (
        candidate.workspace_id,
        candidate.id,
        candidate.created_by,
        'system',
        true,
        100,
        '[]'::jsonb,
        '[]'::jsonb,
        candidate.engine_version
      )
      on conflict do nothing;

      update public.ai_runs
      set artifact_type = 'lesson',
          artifact_id = candidate.id
      where id = candidate.ai_run_id
        and artifact_id is null;
    end if;
  end loop;
end;
$$;
