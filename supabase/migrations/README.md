# ArtistOS Supabase migrations

This directory is the required source-control location for every forward database change.

## Current production state

As of 2026-09-28, the shared `artistos-core` production project contains **55** migration-ledger entries.

ArtistOS source control contains **47** migration files:
- 44 match live migration versions exactly.
- 3 have the same migration names and canonically identical SQL as production, but different version timestamps.
- 8 later live migrations are BVSS-owned and are being recovered in `middlechildmzk/middle-child-experience`, not duplicated here.

The ArtistOS application therefore has real production-bearing schema/data, but full database reproducibility remains blocked until the ordered **cross-repo** migration history is explicitly manifested and clean-replayed.

See `../../docs/PRODUCTION_AUTHORITY_2026-09-28.md` for the current reconciliation and `../../docs/ARTISTOS_CONSOLIDATION_BLUEPRINT.md` for product sequencing.

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

- Live ledger captured: 55 migrations.
- ArtistOS migration files present: 47.
- Exact-version matches: 44.
- Timestamp-only / same-name / canonical-SQL-equal divergences: 3.
- BVSS-owned live migrations: 8, source recovery in the BVSS repo.
- Clean cross-repo replay: still required.
- Production data changes in this reconciliation: none.
