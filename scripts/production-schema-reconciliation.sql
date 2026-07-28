-- Read-only-recovery companion for disposable replay only.
--
-- Production inventory verified on 2026-07-28 shows that two relations created
-- by 20260714104403 are no longer present even though no corresponding drop is
-- recorded in supabase_migrations.schema_migrations. Replaying the recovered
-- ledger therefore requires this explicit reconciliation step to reproduce the
-- current production application schema.
--
-- Never apply this file to production. It only removes local replay objects.

drop table if exists public.industry_contacts;
drop table if exists public.playlists;
