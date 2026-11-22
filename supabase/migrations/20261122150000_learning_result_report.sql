create function private.learning_report_actions(items jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('action', v->>'action', 'timeframe', v->>'timeframe')), '[]'::jsonb)
  from jsonb_array_elements(items) v
$$;
revoke all on function private.learning_report_actions(jsonb) from public, anon, authenticated;

