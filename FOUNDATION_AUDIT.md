# ArtistOS Foundation Audit

## Executive verdict

The application architecture is promising, but production database history is not reproducible from source control. This is a production blocker.

## Verified facts

- The live `artistos-core` Supabase migration ledger contains 28 historical migrations.
- The canonical repository branch originally contained only three newer migrations.
- The historical and repository migration sets were disjoint.
- The runtime, evidence, Artist Brain, and Artist Knowledge Graph migrations are not recorded in the live ledger.
- Static CI previously passed because it did not validate database history or perform a database replay.

## Production blockers

### C1. Runtime schema is not applied

The capability, evidence, and Artist Brain tables targeted by the canonical runtime are not present in the live database. Production execution must not be enabled until migrations are rehearsed and deliberately applied.

### C2. Historical migration chain is absent from source control

The repository cannot rebuild the live database from zero until all 28 historical migrations are recovered under their exact versions and names.

### C3. Clean replay has not been proven

`supabase db reset --local`, workspace-isolation assertions, advisors, and schema-drift verification remain mandatory gates.

## Recovery controls added

- `supabase/REMOTE_MIGRATION_MANIFEST.json` contains the reviewed version, name, byte hash, and byte length for all 28 live-ledger migrations.
- `scripts/check-remote-migration-manifest.mjs` fails when a historical file is missing, renamed, resized, or changed.
- `.github/workflows/ci.yml` now runs migration reconciliation before dependency installation, tests, TypeScript, and build.
- `scripts/recover-remote-migrations.sh` uses the official `supabase migration fetch --linked` path, verifies the fetched files, and replays them against isolated local Supabase.

## Required sequence

1. Run `scripts/recover-remote-migrations.sh` on a machine with Docker, the Supabase CLI, and authorized project access.
2. Review and commit the 28 recovered historical migration files without cosmetic changes.
3. Confirm the manifest gate passes.
4. Confirm clean local database reset succeeds.
5. Run workspace-isolation SQL and database advisors.
6. Produce and review a linked schema diff; unexplained drift must be zero.
7. Rehearse the pending runtime, evidence, Brain, and Knowledge Graph migrations on an isolated database.
8. Run authenticated end-to-end workflows.
9. Only then prepare a reviewed production rollout.

## Safety boundary

No production migration, history repair, branch merge, or production deployment is authorized by this audit or recovery tooling.
