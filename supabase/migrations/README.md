# ArtistOS Supabase migrations

This directory is the required source-control location for every forward database change.

## Current production state

The `artistos-core` production project contains 40 entries in `supabase_migrations.schema_migrations`, spanning `20260711232934_artistos_core_foundation` through `20260729005831_marketplace_rls_performance`.

The canonical repository now includes the original recovered migration sequence plus the seven production migrations applied after the canonical ArtistOS rollout:

- `20260728222022_artistos_release_command_center_compatibility`
- `20260728222113_artistos_release_foundation_advisor_hardening`
- `20260728222155_seed_existing_artistos_release_links`
- `20260728223443_minimize_fan_consent_evidence`
- `20260729003724_artistos_marketplace_identity`
- `20260729005648_marketplace_function_grants`
- `20260729005831_marketplace_rls_performance`

The marketplace tables are recovered as production history, not an instruction to expose an open marketplace. The approved consolidation blueprint still postpones that product surface until the closed-alpha golden path is proven.

See `../REMOTE_MIGRATION_HISTORY.md` for the verified ledger and `../../docs/ARTISTOS_CONSOLIDATION_BLUEPRINT.md` for product sequencing.

## Rules

1. Never edit or rename a migration that has been applied to any shared environment.
2. Never manually insert a version into `supabase_migrations.schema_migrations`.
3. Recovered historical SQL must use the exact production version and name.
4. Compare each recovered file's normalized SQL hash with the production `statements` value before marking it verified.
5. Rehearse privilege, RLS, trigger, function, and destructive changes against a disposable Supabase branch before production.
6. Use one migration per coherent forward change.
7. Application code that depends on a migration may not merge until the migration exists here.
8. Do not revoke direct state-column privileges until all existing writers use the approved transition functions.
9. Database capability does not determine product launch order. Dormant schema remains inaccessible in the UI until its roadmap gate is approved.

## Recovery status

- Remote ledger captured: 40/40.
- Canonical migration files present: 40/40.
- Exact normalized-content verification: pending CI/live reconciliation for the seven newest recovered files.
- Clean-database replay: required before merge.
- Production data changes in this branch: none.
