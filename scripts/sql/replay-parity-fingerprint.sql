-- Replay parity fingerprint for the public schema: every column (name, type,
-- nullability) and every RLS policy (name, command). Run read-only against
-- production and against a replayed database; the values must be equal.
select
  md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, '|' order by table_name, column_name)) as public_columns_md5,
  count(*)::int as public_columns,
  (select md5(string_agg(tablename || '.' || policyname || ':' || cmd, '|' order by tablename, policyname)) from pg_policies where schemaname = 'public') as public_policies_md5,
  (select count(*)::int from pg_policies where schemaname = 'public') as public_policies,
  (select count(*)::int from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as public_tables,
  (select count(*)::int from information_schema.tables where table_schema = 'public' and table_type = 'VIEW') as public_views
from information_schema.columns
where table_schema = 'public';
