-- =====================================================================
-- SESSION A RLS LOCKDOWN (reproducible record of the release-candidate
-- security pass applied 2026-07-16). Idempotent: safe to re-run.
-- WHAT IT DOES
--   1. Revokes ALL anonymous (anon) access to public schema data
--   2. Makes authenticated read-only (SELECT) via grants
--   3. Scopes every read policy to authenticated only
--   4. Makes contactable_fans run as security_invoker so it respects
--      the RLS of fans/suppressions (suppression exclusion preserved
--      by the view's WHERE NOT EXISTS clause, unchanged)
-- VERIFICATION (run after applying; expected values in comments):
--   SELECT count(*) FROM information_schema.role_table_grants
--     WHERE table_schema='public' AND grantee='anon';          -- = 0
--   SELECT count(*) FROM pg_policies
--     WHERE schemaname='public' AND 'anon' = ANY(roles);       -- = 0
--   SELECT count(*) FROM pg_policies
--     WHERE schemaname='public' AND 'authenticated'=ANY(roles);-- >= 16
-- ROLLBACK (only if intentionally reopening anon read access):
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
--   ALTER VIEW public.contactable_fans SET (security_invoker = false);
--   -- and recreate policies with TO anon, authenticated per table.
-- =====================================================================
ALTER VIEW public.contactable_fans SET (security_invoker = true);
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fans','people','properties','suppressions','organizations','tasks','import_batches','artists','releases','campaigns','interactions','submission_endpoints','outcomes','relationship_signals','risk_events','source_records'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_read_all', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||'_read_all', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
