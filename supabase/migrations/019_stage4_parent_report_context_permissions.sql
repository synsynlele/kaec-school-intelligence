-- KAEC School Intelligence — Stage 4 parent-report context permissions
--
-- Migration 015 deliberately restricted authenticated diagnosis updates to an
-- explicit column allow-list. Migration 018 later introduced academic_session
-- and term for the parent report. Extend only that allow-list so the invoker
-- RPC can persist report context without restoring unrestricted table UPDATE.

grant update (academic_session, term)
on public.diagnoses
to authenticated;
