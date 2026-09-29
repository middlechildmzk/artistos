-- Capture the live migration ledger with a canonical SQL hash per migration.
--
-- Read-only. Run against the shared artistos-core project and save the result
-- when refreshing supabase/CROSS_REPO_MIGRATION_MANIFEST.json.
--
-- Normalization must stay byte-for-byte identical to canonicalSql() in
-- scripts/lib/migration-canon.mjs: strip /* */ and -- comments, drop every
-- semicolon, collapse whitespace, trim.

with ledger as (
  select
    version,
    name,
    coalesce(array_length(statements, 1), 0) as statement_count,
    btrim(
      regexp_replace(
        replace(
          regexp_replace(
            regexp_replace(array_to_string(statements, E'\n'), '/\*.*?\*/', '', 'g'),
            '--[^\n]*', '', 'g'
          ),
          ';', ''
        ),
        '\s+', ' ', 'g'
      )
    ) as canon
  from supabase_migrations.schema_migrations
)
select
  row_number() over (order by version) as replay_order,
  version,
  name,
  statement_count,
  length(canon) as canonical_chars,
  encode(sha256(convert_to(canon, 'UTF8')), 'hex') as canonical_sha256
from ledger
order by version;
