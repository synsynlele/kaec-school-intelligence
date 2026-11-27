create function public.get_my_parent_fee_links()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('workspace',p.workspace_id,'learners',coalesce((
    select jsonb_agg(jsonb_build_object('id',s.id,'name',s.display_name,'school',k.school_id,'learner',k.khpos_learner_id)
      order by s.display_name,s.id)
    from private.learning_parent_links l
    join public.students s on s.id=l.learner_id and s.workspace_id=p.workspace_id and s.active
    left join private.khpos_imported_learners k on k.student_id=s.id and k.workspace_id=s.workspace_id
    where l.parent_id=p.id
  ),'[]'::jsonb))
  from private.learning_parent_accounts p
  join public.workspaces w on w.id=p.workspace_id and w.access_status='active' and w.workspace_type='school'
  where p.id=auth.uid() and p.activated_at is not null and p.revoked_at is null;
$$;
revoke all on function public.get_my_parent_fee_links() from public,anon;
grant execute on function public.get_my_parent_fee_links() to authenticated;
