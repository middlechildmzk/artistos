-- Deterministic ArtistOS-owned schema fingerprint.
-- Excludes extension-owned objects and data rows. Includes application
-- relations, columns, constraints, indexes, policies, functions, enums,
-- triggers, grants, and the private `app` storage bucket contract.

with app_relations as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, n.nspname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
    and not exists (
      select 1
      from pg_depend d
      where d.classid = 'pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'
    )
), objects(kind, descriptor) as (
  select
    'REL',
    format('REL|%s|%s|%s|rls=%s|force=%s', nspname, relname, relkind, relrowsecurity, relforcerowsecurity)
  from app_relations

  union all

  select
    'COL',
    format(
      'COL|%s|%s|%s|%s|%s|notnull=%s|default=%s',
      r.nspname,
      r.relname,
      a.attnum,
      a.attname,
      format_type(a.atttypid, a.atttypmod),
      a.attnotnull,
      coalesce(pg_get_expr(ad.adbin, ad.adrelid), '')
    )
  from pg_attribute a
  join app_relations r on r.oid = a.attrelid
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where r.relkind in ('r', 'p', 'v', 'm')
    and a.attnum > 0
    and not a.attisdropped

  union all

  select
    'CON',
    format('CON|%s|%s|%s|%s', r.nspname, r.relname, con.conname, pg_get_constraintdef(con.oid, true))
  from pg_constraint con
  join app_relations r on r.oid = con.conrelid

  union all

  select
    'IDX',
    format('IDX|%s|%s|%s|%s', n.nspname, t.relname, i.relname, pg_get_indexdef(i.oid))
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join app_relations r on r.oid = t.oid

  union all

  select
    'POL',
    format(
      'POL|%s|%s|%s|%s|%s|%s|%s|%s',
      p.schemaname,
      p.tablename,
      p.policyname,
      p.permissive,
      array_to_string(p.roles, ','),
      p.cmd,
      coalesce(p.qual, ''),
      coalesce(p.with_check, '')
    )
  from pg_policies p
  where (
      p.schemaname in ('public', 'private')
      and exists (
        select 1 from app_relations r
        where r.nspname = p.schemaname and r.relname = p.tablename
      )
    )
    or (p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'app_%')

  union all

  select
    'FUN',
    format(
      'FUN|%s|%s|%s|%s|security_definer=%s|volatility=%s|%s',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid),
      pg_get_function_result(p.oid),
      p.prosecdef,
      p.provolatile,
      pg_get_functiondef(p.oid)
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and not exists (
      select 1
      from pg_depend d
      where d.classid = 'pg_proc'::regclass
        and d.objid = p.oid
        and d.deptype = 'e'
    )

  union all

  select
    'ENUM',
    format('ENUM|%s|%s|%s', n.nspname, t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder))
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname in ('public', 'private')
    and not exists (
      select 1
      from pg_depend d
      where d.classid = 'pg_type'::regclass
        and d.objid = t.oid
        and d.deptype = 'e'
    )
  group by n.nspname, t.typname

  union all

  select
    'TRG',
    format('TRG|%s|%s|%s|%s', r.nspname, r.relname, t.tgname, pg_get_triggerdef(t.oid, true))
  from pg_trigger t
  join app_relations r on r.oid = t.tgrelid
  where not t.tgisinternal

  union all

  select
    'GRANT',
    format('GRANT|%s|%s|%s|%s', g.table_schema, g.table_name, g.grantee, g.privilege_type)
  from information_schema.role_table_grants g
  where g.table_schema in ('public', 'private')
    and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
    and exists (
      select 1 from app_relations r
      where r.nspname = g.table_schema and r.relname = g.table_name
    )

  union all

  select
    'BUCKET',
    format(
      'BUCKET|%s|public=%s|size=%s|mime=%s',
      id,
      public,
      coalesce(file_size_limit::text, ''),
      coalesce(array_to_string(allowed_mime_types, ','), '')
    )
  from storage.buckets
  where id = 'app'
), normalized as (
  select distinct kind, descriptor from objects
), categories as (
  select
    kind,
    count(*)::int as object_count,
    encode(digest(string_agg(descriptor, E'\n' order by descriptor), 'sha256'), 'hex') as sha256
  from normalized
  group by kind
), overall as (
  select
    count(*)::int as object_count,
    encode(digest(string_agg(descriptor, E'\n' order by descriptor), 'sha256'), 'hex') as sha256
  from normalized
)
select jsonb_pretty(
  jsonb_build_object(
    'schema_version', 1,
    'object_count', overall.object_count,
    'sha256', overall.sha256,
    'categories', (
      select jsonb_object_agg(
        kind,
        jsonb_build_object('object_count', object_count, 'sha256', sha256)
        order by kind
      )
      from categories
    )
  )
)
from overall;
