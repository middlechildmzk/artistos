# ArtistOS foundation audit — 2026-07-27

## Verdict

The current foundation is architecturally promising but operationally unsafe to deploy.

The capability runtime, policy engine, evidence model, Artist Brain v2, architecture tests, and honest CI exit codes are meaningful work. However, the deployed database and the source-controlled migration history are not reconciled.

## Critical blockers

### C1. Runtime tables are not present in the live database

The current runtime depends on tables introduced by the three committed migrations:

- `capability_idempotency`
- `capability_audit_log`
- `capability_approvals`
- `evidence_records`
- `brain_memories`
- `brain_claims`
- `brain_claim_evidence`
- `brain_learning_observations`

A read-only audit reported that none of these tables exists in the live database and none of the three committed migration versions appears in the migration ledger.

**Impact:** the first real capability invocation can fail even while static CI remains green.

**Gate:** do not apply these migrations to production until C2 is resolved and the full chain is rehearsed on a disposable database.

### C2. The repository cannot currently reconstruct the database

The live migration ledger reportedly contains 28 historical migrations while `supabase/migrations/` contains only three pending migrations. The sets are disjoint.

The committed migrations reference foundational tables such as `public.workspaces` and `public.artists`, but the migrations that create those tables are not present in source control.

**Impact:** clean replay, disaster recovery, disposable database testing, RLS verification, and reliable onboarding are blocked.

**Required sequence:**

1. Export all historical ledger entries with exact version, name, and statements.
2. Recover each migration as a source-controlled file.
3. Normalize and hash-compare every recovered file with the ledger.
4. Run `supabase db reset` against a clean local database.
5. Confirm a schema diff against the linked database is empty before applying new migrations.

### C3. Application routes still access Supabase directly

The audit found multiple `.from(` calls under `app/`. This means the capability runtime is not yet the exclusive mutation and policy boundary.

Read-only page queries may remain direct temporarily if explicitly accepted, but all consequential writes must flow through the capability runtime. The repository should distinguish read-model access from command execution rather than claiming all database access is capability-mediated.

## High-priority follow-up

- Commit a package lockfile and switch CI from `npm install` to `npm ci`.
- Ensure SQL RLS tests are actually executed by CI.
- Add cross-workspace denial tests.
- Replace unconstrained evidence UUID arrays with relational support edges where provenance requires referential integrity.
- Add explicit support links for learned memories and causal links for episodic memories.
- Add a durable job queue and claim/lease behavior before platform connector work.

## Positive findings

- CI uses real pipeline exit codes with `set -o pipefail`.
- Diagnostic uploads use `if: always()` without masking failures.
- The migration README accurately identifies reproducibility as a P0 concern.
- Brain confidence and freshness states are enforced in SQL.
- Evidence links for claims use a strong relational pattern.
- Memory corrections are versioned rather than destructively overwritten.

## Immediate engineering order

1. Recover and reconcile the historical migration chain.
2. Add the reconciliation check as a CI gate using a reviewed ledger snapshot.
3. Prove clean replay and empty schema diff.
4. Rehearse the pending runtime, evidence, Brain, and graph migrations on a disposable database.
5. Only then apply reviewed migrations and resume connector and Curator Graph implementation.

No production migration should be applied from this branch.
