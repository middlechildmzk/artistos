# ArtistOS Supabase migrations

This directory is the required source-control location for every forward database change.

## Current production state

As of 2026-09-28, the shared `artistos-core` production project contains **56** migration-ledger entries.

ArtistOS source control contains **47** migration files:
- 44 match live migration versions exactly.
- 3 have the same migration names and canonically identical SQL as production, but different version timestamps.
- 9 later live migrations are BVSS-owned and are being recovered in `middlechildmzk/middle-child-experience`, not duplicated here.

The ArtistOS application therefore has real production-bearing schema/data, but full database reproducibility remains blocked until the ordered **cross-repo** migration history is explicitly manifested and clean-replayed.

See `../../docs/PRODUCTION_AUTHORITY_2026-09-28.md` for the current reconciliation and `../../docs/ARTISTOS_CONSOLIDATION_BLUEPRINT.md` for product sequencing.

## Cross-repo manifest (authoritative replay order)

`../CROSS_REPO_MIGRATION_MANIFEST.json` is the ordered authority for every migration in the shared `artistos-core` ledger, whichever repository owns it.

- `applied`: all 56 live migrations, in replay order, with owning repository, repository path, canonical production filename, statically derived dependencies, the 3 timestamp aliases, and the live canonical SQL hash each source file must match.
- `replay_prerequisites`: the three non-migration steps a clean database needs (Supabase platform objects, the pre-ledger fixture embedded in `scripts/verify-local-supabase.sh`, and `scripts/production-schema-reconciliation.sql`).
- `production_fingerprint`: public columns and policies captured from production; a full replay must reproduce it exactly (`tests/cross-repo-migration-manifest.test.mjs`).
- `pending`: migrations committed in either repository but not yet applied, with the tranche that authorizes them.

Commands:

```bash
npm run db:manifest:check -- --repo middle-child-experience=../middle-child-experience
npm run db:replay:assemble -- --repo middle-child-experience=../middle-child-experience --out /tmp/replay/supabase/migrations
BVSS_REPO_DIR=../middle-child-experience npm test
```

### Two-repository merge protocol

This manifest is the authority. A migration owned by another repository is declared here first:

1. Author the migration on a branch in its owning repository.
2. Open a PR here adding it to `pending` with its canonical hash (`node -e` over `scripts/lib/migration-canon.mjs`, or rebuild with `scripts/build-cross-repo-migration-manifest.mjs`). CI checks the sibling repository's `main`, where the file has not landed yet: the gate PASSES and reports the entry as "declared pending, not yet landed". It still FAILS for any sibling migration file that exists but is undeclared, and for any landed file whose hash differs.
3. Merge this PR.
4. The owning repository's CI checks its migration files against this manifest on `main` and fails on anything undeclared or mismatched. Merge it.
5. Before applying pending migrations to production, run the gate with `--require-pending-landed` so every pending entry must exist and hash-match.
6. After applying, re-export the ledger with `scripts/sql/live-migration-ledger-statements.sql`, rebuild with `scripts/build-cross-repo-migration-manifest.mjs --ledger <export.json> ...` (entries move from `pending` to `applied`), and recapture `production_fingerprint` with `scripts/sql/replay-parity-fingerprint.sql`.

No branch names are hard-coded; every check runs against the sibling's `main` or a supplied checkout.

### Canonical hashing (version 2, literal-aware)

`scripts/lib/migration-canon.mjs` lexes PostgreSQL: string, E-string, dollar-quoted and quoted-identifier contents are preserved byte-for-byte, while comments, whitespace and statement-separator formatting outside literals are normalized. Changing a literal (for example `'a;b'` to `'ab'`) always changes the hash; unterminated literals or comments fail the gate. The live side is hashed by the same JavaScript over the exported `statements`, so there is one implementation. Version 1 (regex-based) hashes were replaced on 2026-09-29 by re-exporting the live ledger and rebuilding; the builder refuses to write unless every live entry matches exactly one source file.

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

- Live ledger captured: 56 migrations.
- ArtistOS migration files present: 47.
- Exact-version matches: 44.
- Timestamp-only / same-name / canonical-SQL-equal divergences: 3.
- BVSS-owned live migrations: 9, source recovery in the BVSS repo.
- Clean cross-repo replay: still required.
- Production data changes in this reconciliation: none.
