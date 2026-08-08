-- KAEC School Intelligence — Saved Work RPC anonymous-execution hardening
--
-- These SECURITY DEFINER RPCs are intentionally callable by authenticated
-- workspace members and enforce auth.uid(), workspace membership and artifact
-- authority internally. Anonymous execution is unnecessary and must stay closed.

revoke execute on function public.list_archived_saved_work(uuid) from anon;
revoke execute on function public.manage_saved_artifact(text, uuid, text) from anon;
