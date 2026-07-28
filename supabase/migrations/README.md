# ArtistOS Supabase migrations

This directory is now the required source-control location for every forward database change.

## Current production state

The `artistos-core` production project contains 28 entries in `supabase_migrations.schema_migrations`, spanning `20260711232934_artistos_core_foundation` through `20260727144623_add_agent_execution_control_plane_v2`.

Those migrations were applied before their SQL files were committed to the canonical consolidation branch. The database history therefore exists, but the repository history is incomplete. This is a P0 reproducibility defect, not permission to create a new synthetic baseline and forget the original sequence.

See `../REMOTE_MIGRATION_HISTORY.md` for the verified ledger.

## Rules

1. Never edit or rename a migration that has been applied to any shared environment.
2. Never manually insert a version into `supabase_migrations.schema_migrations`.
3. Recovered historical SQL must use the exact production version and name.
4. Compare each recovered file's normalized SQL hash with the production `statements` value before marking it verified.
5. Rehearse privilege, RLS, trigger, function, and destructive changes against a disposable Supabase branch before production.
6. Use one migration per coherent forward change.
7. Application code that depends on a migration may not merge until the migration exists here.
8. Do not revoke direct state-column privileges until all existing writers use the approved transition functions.

## Recovery status

- Remote ledger captured: complete, 28/28.
- Historical SQL extraction: in progress.
- Hash verification: pending.
- Clean-database replay: pending.
- Evidence, memory, autonomy, ownership, and MCP migrations: blocked until replay passes.

No production schema was changed while establishing this directory.
