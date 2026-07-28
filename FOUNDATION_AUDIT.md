# ArtistOS foundation audit

## Executive result

ArtistOS has a strong source-controlled application and intelligence architecture, but production rollout remains blocked until the 28 historical Supabase migrations are recovered and proven from zero.

The recovery branch now contains deterministic recovery, replay, drift, pending-migration rehearsal, authenticated E2E, Brain transition, and release-readiness gates. No production migration, migration-history repair, or deployment is authorized by this branch.

## Verified production mismatch

- Production migration ledger: 28 historical migrations.
- Repository at audit start: 3 newer migrations.
- Capability runtime, evidence, Brain v2, and Knowledge Graph tables were not present in production.
- Production could not be reproduced from source control.

## Recovery controls

The branch now includes:

- `supabase/REMOTE_MIGRATION_MANIFEST.json`
- `scripts/check-remote-migration-manifest.mjs`
- `scripts/export-remote-migrations.mjs`
- `scripts/recover-remote-migrations.sh`
- `scripts/verify-schema-drift.sh`
- `scripts/rehearse-pending-migrations.sh`
- `tests/migration-recovery-safety.test.mjs`
- `tests/schema-drift-safety.test.mjs`
- `tests/pending-migration-rehearsal.test.mjs`

The recovery path preserves pending migrations, verifies historical hashes, replays locally, runs workspace isolation and advisors, and compares the historical baseline to the linked schema without mutating production.

## Runtime write boundary

Consequential application writes under `app/` must use the capability runtime. Direct RLS-scoped reads remain allowed. Regression tests prohibit direct insert, update, delete, upsert, and storage mutations in the application layer.

## Artist Brain transition

`artist_brain_facts` remains the Brain v1 historical store during recovery. Brain v2 becomes authoritative only after deterministic backfill, count reconciliation, evidence preservation, authenticated verification, and rollback approval.

No recovery or rollout step may drop or rewrite Brain v1.

## Release readiness command center

The branch now includes a unified readiness system:

- `scripts/artistos-release-readiness.sh`
- `scripts/generate-release-readiness-report.mjs`
- `scripts/validate-release-evidence.mjs`
- `.github/workflows/release-readiness.yml`
- `docs/RELEASE_READINESS_COMMAND_CENTER.md`

It produces structured event logs, Markdown and JSON readiness reports, SHA-256 evidence digests, and a deterministic `GO`, `BLOCKED`, or `NO_GO` result.

Strict evidence validation requires:

- completed passing authenticated E2E journeys
- exact Brain v1-to-v2 count reconciliation
- zero duplicate Brain v2 records
- zero confidence promotion
- approval bound to the exact release commit
- approval bound to the reviewed migration-manifest digest
- named approver and rollback owner

A `GO` result still does not authorize production mutation.

## Required sequence

1. Run `scripts/recover-remote-migrations.sh` in an authenticated environment.
2. Commit the 28 exact historical SQL files.
3. Turn the manifest and CI reconciliation gates green.
4. Prove historical clean replay.
5. Run workspace-isolation assertions and database advisors.
6. Prove zero unexplained linked historical schema drift.
7. Run `scripts/rehearse-pending-migrations.sh`.
8. Rehearse Brain v1-to-v2 backfill and reconciliation.
9. Run authenticated E2E workflows.
10. Validate final evidence with `npm run readiness:validate-evidence`.
11. Review the generated release-readiness report.
12. Follow `docs/PRODUCTION_ROLLOUT_GATE.md` through a separately approved rollout.

## Current decision

`BLOCKED`

Reason: the 28 historical SQL migration files have not yet been committed and authenticated recovery evidence does not yet exist.
