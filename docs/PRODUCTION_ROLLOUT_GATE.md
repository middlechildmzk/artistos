# ArtistOS production rollout gate

This runbook begins only after migration recovery, historical replay, schema-drift verification, pending migration rehearsal, Brain reconciliation, authenticated end-to-end testing, and strict release-evidence validation all pass.

## Preconditions

Required evidence:

- all 28 historical migration files are committed and match the reviewed manifest
- clean historical `supabase db reset --local` passes
- linked historical schema drift is empty or every line is documented and approved
- pending runtime, evidence, Brain v2, and Knowledge Graph migrations replay successfully from zero
- workspace isolation and storage isolation tests pass
- database advisors have no unresolved security blocker
- authenticated E2E gate passes for owner, viewer, and second-workspace identities
- Brain v1-to-v2 reconciliation report has zero unexplained loss, duplicates, or confidence promotion
- `npm run readiness:validate-evidence` passes
- `artifacts/release-readiness/report.json` reports `GO` for the exact release commit
- rollback owner and decision authority are named before rollout begins

## Required artifacts

Store these with the rollout record:

- exact source commit SHA
- ordered migration filenames and hashes
- migration-manifest SHA-256 digest
- historical replay summary
- pending migration rehearsal summary
- schema-drift SQL and review outcome
- database advisor output
- authenticated E2E report with completed journeys
- Brain reconciliation report and exception list
- release-readiness JSON and Markdown reports
- commit-specific production approval
- backup identifier and creation time
- rollout start and completion times
- reviewer, operator, and rollback-owner identities

## Stop conditions

Stop immediately when any of the following occurs:

- a migration version or hash differs from the reviewed source
- the linked project contains an unreviewed migration
- a migration requires history repair
- a workspace isolation assertion fails
- a capability write bypass is discovered
- an approval or idempotency invariant fails
- a Brain v1 record cannot be reconciled without explicit exception handling
- Brain reconciliation produces duplicates or confidence promotion
- authenticated E2E evidence contains a missing or failed journey
- approval commit differs from the rollout commit
- approval manifest digest differs from the reviewed manifest
- a database advisor reports a new critical security issue
- the application cannot complete login, onboarding, release, campaign, or CRM smoke tests

Do not improvise around a stop condition. Return to rehearsal, produce a new reviewed change, and restart the gate.

## Rollout sequence

1. Freeze migration changes on the rollout commit.
2. Calculate and record the migration-manifest digest.
3. Generate and validate all readiness evidence.
4. Create and verify a production backup using the platform-supported backup mechanism.
5. Record the current migration ledger and schema digest.
6. Confirm the application version currently serving production.
7. Confirm operator, reviewer, rollback owner, and decision authority.
8. Apply only the reviewed pending migrations, in source-controlled order, through the separately authorized production procedure.
9. Re-read the migration ledger and confirm exact versions and names.
10. Verify required tables, columns, constraints, functions, indexes, grants, policies, and storage rules.
11. Run workspace-isolation smoke assertions.
12. Deploy the matching application commit.
13. Run authenticated smoke tests for owner and viewer roles.
14. Verify capability audit, approval, idempotency, evidence, and Brain writes.
15. Inspect application logs, database logs, and advisors.
16. Keep Brain v1 intact during the observation period.
17. Record completion only after all evidence and digests are attached and reviewed.

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

## Authorization boundary

The command center evaluates evidence but never authorizes production mutation. A human-reviewed, commit-specific approval remains mandatory after every automated gate reports success.
