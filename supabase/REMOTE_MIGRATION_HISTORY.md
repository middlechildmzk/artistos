# Remote Migration History Recovery

ArtistOS production has 28 applied Supabase migrations that are now preserved byte-for-byte in source control before any pending runtime, evidence, Brain, or graph migration is deployed.

## Recovery status

Recovery completed on July 28, 2026.

- recovered files: 28 of 28
- first migration: `20260711232934_artistos_core_foundation`
- last migration: `20260727144623_add_agent_execution_control_plane_v2`
- reviewed manifest: `supabase/REMOTE_MIGRATION_MANIFEST.json`
- recovery commit: `56369c2fae2c011a954ab63dfd69ac9496001987`
- production mutations performed: none

The historical files match the reviewed production ledger by version, name, byte length, and raw SHA-256.

## Reviewed production ledger

The reviewed manifest is:

`supabase/REMOTE_MIGRATION_MANIFEST.json`

It records each applied migration's version, name, SQL character length, raw ledger SHA-256, and normalized SQL SHA-256.

The reviewed range is:

- first: `20260711232934_artistos_core_foundation`
- last: `20260727144623_add_agent_execution_control_plane_v2`

## Recovery methods

### Preferred deterministic export

Provide a read-only production database connection string and run:

```bash
SUPABASE_DB_URL='postgresql://...' bash scripts/recover-remote-migrations.sh
```

This uses `psql` to perform one SELECT from `supabase_migrations.schema_migrations`, verifies every row against the reviewed manifest, and writes the exact historical filenames.

### Supported Supabase CLI fetch

Without `SUPABASE_DB_URL`, authenticate the Supabase CLI and run:

```bash
bash scripts/recover-remote-migrations.sh
```

The workflow links project `myrtdfyjoxvtubusrrmf` and runs `supabase migration fetch --linked`.

## Safety guarantees

The workflow preserves pending local migrations before recovery, restores them afterward, verifies names, lengths, and hashes, performs local-only database reset, runs workspace-isolation assertions, and runs local database advisors.

The workflow does not contain:

- `supabase db reset --linked`
- `supabase db push`
- `supabase migration repair`
- production DDL
- production data writes

## CI behavior

`.github/workflows/ci.yml` runs historical reconciliation before dependency installation. With all 28 historical files committed, CI allows reviewed pending migrations but continues to reject missing, renamed, resized, or modified historical migrations.

## Required evidence before deployment

1. Manifest reconciliation passes.
2. `supabase migration list --linked` shows only reviewed pending migrations as local-only.
3. `supabase db reset --local` succeeds from zero.
4. Workspace-isolation assertions pass.
5. Database advisors are reviewed.
6. Linked schema drift is reviewed and unexplained drift is zero.
7. Pending migrations are rehearsed on a disposable database.
8. Authenticated runtime and failure-path tests pass.

No production deployment is authorized until all eight conditions are satisfied.

## Historical caution

Several applied migrations intentionally widened access before later migrations hardened it. They must be replayed only in an isolated database and in full order. Do not apply individual recovered historical migrations to production.
