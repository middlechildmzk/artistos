# ArtistOS production rollout gate

This runbook begins only after migration recovery, historical replay, schema-drift verification, pending migration rehearsal, and authenticated end-to-end testing all pass.

## Preconditions

Required evidence:

- all 28 historical migration files are committed and match the reviewed manifest
- clean historical `supabase db reset --local` passes
- linked historical schema drift is empty or every line is documented and approved
- pending runtime, evidence, Brain v2, and Knowledge Graph migrations replay successfully from zero
- workspace isolation and storage isolation tests pass
- database advisors have no unresolved security blocker
- authenticated E2E gate passes for owner, viewer, and second-workspace identities
- Brain v1-to-v2 reconciliation report has zero unexplained loss or confidence promotion
- rollback owner and decision authority are named before rollout begins

## Required artifacts

Store these with the rollout record:

- exact source commit SHA
- ordered migration filenames and hashes
- historical replay summary
- pending migration rehearsal summary
- schema-drift SQL and review outcome
- database advisor output
- E2E report
- Brain reconciliation report
- backup identifier and creation time
- rollout start and completion times
- reviewer and operator identities

## Stop conditions

Stop immediately when any of the following occurs:

- a migration version or hash differs from the reviewed source
- the linked project contains an unreviewed migration
- a migration requires history repair
- a workspace isolation assertion fails
- a capability write bypass is discovered
- an approval or idempotency invariant fails
- a Brain v1 record cannot be reconciled without silent loss
- a database advisor reports a new critical security issue
- the application cannot complete login, onboarding, release, campaign, or CRM smoke tests

Do not improvise around a stop condition. Return to rehearsal, produce a new reviewed change, and restart the gate.

## Rollout sequence

1. Freeze migration changes on the rollout commit.
2. Create and verify a production backup using the platform-supported backup mechanism.
3. Record the current migration ledger and schema digest.
4. Confirm the application version currently serving production.
5. Apply only the reviewed pending migrations, in source-controlled order.
6. Re-read the migration ledger and confirm exact versions and names.
7. Verify required tables, columns, constraints, functions, indexes, grants, policies, and storage rules.
8. Run workspace-isolation smoke assertions.
9. Deploy the matching application commit.
10. Run authenticated smoke tests for owner and viewer roles.
11. Verify capability audit, approval, idempotency, evidence, and Brain writes.
12. Inspect application logs, database logs, and advisors.
13. Keep Brain v1 intact during the observation period.
14. Record completion only after all evidence is attached and reviewed.

## Rollback boundary

Database rollback must use a separately reviewed plan. Never delete migration ledger rows or use migration repair as an operational shortcut.

Application rollback may return traffic to the prior application commit when the new schema is backward compatible. If a migration is not backward compatible, rollout is not authorized until an explicit forward-fix and restore plan is rehearsed.

Brain v1 remains the rollback source until Brain v2 parity is verified and separately approved.

## Post-rollout observation

During the initial observation period, monitor:

- failed capability invocations
- duplicate or conflicting idempotency keys
- approval replay attempts
- cross-workspace authorization failures
- RLS denials outside expected negative tests
- evidence records without valid source lineage
- Brain claims created without review state
- opportunity records without workspace or evidence linkage
- elevated database errors or latency

No legacy table removal, autonomous external execution, or connector expansion belongs in the initial rollout.
