-- Export the live migration ledger with the exact applied statements.
--
-- Read-only. Run against the shared artistos-core project, save the result as
-- JSON, and pass it to scripts/build-cross-repo-migration-manifest.mjs
-- (--ledger). Canonical hashes are computed in JavaScript by
-- scripts/lib/migration-canon.mjs (canonicalStatements), the same function
-- that hashes source files, so the normalization exists in exactly one place.

select json_agg(
  json_build_object('version', version, 'name', name, 'statements', statements)
  order by version
) as ledger
from supabase_migrations.schema_migrations;
