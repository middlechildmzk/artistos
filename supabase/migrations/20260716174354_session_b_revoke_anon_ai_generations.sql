-- SESSION B FOLLOW-UP: ai_generations was created after the Session A
-- lockdown and inherited default anon grants. RLS already blocked anon
-- (authenticated-only policies), but this restores the zero-anon-grant
-- posture. Idempotent.
-- ROLLBACK (not recommended): GRANT SELECT ON public.ai_generations TO anon;
REVOKE ALL ON public.ai_generations FROM anon;
