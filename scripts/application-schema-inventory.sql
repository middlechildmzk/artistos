-- Compact diagnostic inventory for ArtistOS-owned application relations.
-- This is intentionally read-only and excludes extension-owned objects.

with app_relations as (
  select c.oid, n.nspname as schema_name, c.relname, c.relkind,
         c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'
    )
), relation_stats as (
  select
    r.schema_name,
    r.relname,
    r.relkind,
    r.relrowsecurity,
    r.relforcerowsecurity,
    (select count(*)::int from pg_attribute a where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped) as columns,
    (select count(*)::int from pg_constraint c where c.conrelid = r.oid) as constraints,
    (select count(*)::int from pg_index i where i.indrelid = r.oid) as indexes,
    (select count(*)::int from information_schema.role_table_grants g
      where g.table_schema = r.schema_name and g.table_name = r.relname
        and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')) as grants
  from app_relations r
)
select jsonb_pretty(jsonb_build_object(
  'schema_version', 1,
  'relations', (
    select jsonb_agg(
      jsonb_build_object(
        'schema', schema_name,
        'name', relname,
        'kind', relkind,
        'rls', relrowsecurity,
        'force_rls', relforcerowsecurity,
        'columns', columns,
        'constraints', constraints,
        'indexes', indexes,
        'grants', grants
      ) order by schema_name, relname
    )
    from relation_stats
  ),
  'app_bucket', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types
    ) order by id), '[]'::jsonb)
    from storage.buckets
    where id = 'app'
  )
));
