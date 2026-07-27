# ArtistOS Foundation Audit

## Executive verdict

ArtistOS has a strong application architecture and an unsafe database delivery state. The source-controlled capability runtime, evidence layer, Artist Brain, and Opportunity Intelligence work must not be deployed until the repository can reproduce the existing production database from a clean environment.

## Critical production blockers

### C1. Runtime tables are not present in the live database

The source-controlled runtime expects capability, evidence, and Artist Brain tables that are not currently present in the live ArtistOS database. Static architecture tests do not prove that runtime invocations can execute against the deployed schema.

**Blocks production:** Yes.

### C2. Applied migration history is absent from source control

The live `supabase_migrations.schema_migrations` ledger contains 28 applied migrations. The canonical branch initially contained only three newer, unapplied files. The applied and committed sets were disjoint.

The first committed migration references existing `workspaces` and `artists` tables but no committed migration creates those dependencies. A clean `supabase db reset` therefore cannot rebuild the current database.

**Blocks production:** Yes. This must be corrected before pending migrations are rehearsed or applied.

### C3. Static CI was green without database replay

The existing CI correctly preserves process exit codes through `set -o pipefail`, but it tests source architecture only. It does not establish migration-history reconciliation, clean database replay, linked schema parity, authenticated RLS behavior, or runtime execution against the schema.

**Blocks production:** Yes.

## Independently verified ledger

The connected `artistos-core` Supabase project contains 28 applied migrations, from:

- `20260711232934_artistos_core_foundation`
- through `20260727144623_add_agent_execution_control_plane_v2`

A reviewed manifest is stored at `supabase/REMOTE_MIGRATION_MANIFEST.json`. It records each migration's exact version, name, SQL length, raw ledger hash, and normalized SQL hash.

## Recovery tooling added

### Manifest reconciliation

`scripts/check-remote-migration-manifest.mjs` fails when an applied migration is missing, renamed, shortened, expanded, or changed. Newer pending migrations are reported separately from historical divergence.

### Deterministic ledger exporter

`scripts/export-remote-migrations.mjs` uses `psql` and `SUPABASE_DB_URL` to perform one read-only query against `supabase_migrations.schema_migrations`. It writes the 28 migration files under their exact historical names only after matching each row to the reviewed manifest hash. It preserves pending migrations and never repairs migration history.

### End-to-end recovery workflow

`scripts/recover-remote-migrations.sh` supports either deterministic direct export through `SUPABASE_DB_URL` or the official `supabase migration fetch --linked` path.

It then restores pending files, runs manifest reconciliation, lists linked migration status, performs `supabase db reset --local`, runs workspace-isolation assertions, and runs local database advisors.

It contains no `db reset --linked`, `db push`, migration repair, production DDL, or production data writes.

### CI gate

Migration reconciliation runs before dependency installation. While historical files are absent, CI fails at one clear gate and skips unrelated tests rather than generating cascading noise.

## Direct application database access

Direct `.from(...)` calls exist in application code. This should be assessed by operation type:

- Consequential writes must route through typed capabilities so authorization, policy, idempotency, approval, evidence, and audit controls cannot be bypassed.
- Read models may query directly when they remain workspace-scoped, RLS-protected, and non-consequential.
- Sensitive or derived reads should move toward typed query capabilities where centralized policy and observability provide value.

A blanket prohibition on all direct reads would conflate command and query responsibilities.

## Required recovery sequence

1. Export or fetch the exact 28 historical migrations.
2. Require the manifest reconciliation gate to report historical parity.
3. Preserve the three pending runtime migrations and any later pending graph migration.
4. Run `supabase db reset --local` from zero.
5. Run workspace-isolation tests and database advisors.
6. Compare local replay output with the linked database and document any legitimate environment-managed differences.
7. Rehearse pending migrations on a disposable database.
8. Verify runtime capabilities against the disposable schema.
9. Only then plan production application.

## Prohibited shortcuts

Do not fabricate a baseline migration, mark migrations applied without replaying them, use migration repair to conceal missing files, apply pending migrations directly to production, merge PR #22 as deployable schema work before reconciliation, or treat a successful TypeScript build as database verification.

## Current delivery state

- PR #22: useful architecture work, blocked from deployment
- PR #23: active migration-recovery and audit work
- Production migrations applied by this work: none
- Production schema writes performed by this work: none
- Clean replay: not yet proven

## Exit criteria

The foundation becomes eligible for deployment rehearsal only when all 28 historical migration files are source-controlled, names and hashes match the reviewed ledger, pending files are the only local-only migrations, clean local reset succeeds, workspace RLS assertions pass, database advisors are reviewed, runtime tables and capabilities work on a disposable database, and rollback plus production rehearsal steps are documented.
