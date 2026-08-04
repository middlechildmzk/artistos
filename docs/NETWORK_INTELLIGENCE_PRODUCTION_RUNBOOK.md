# Network Intelligence production migration runbook

## Scope

This runbook governs migration `20260804143000_network_intelligence_contact_safety.sql` and the corresponding Network Intelligence application changes in PR #41.

It does not authorize migration, merge, production deployment, outreach, repository visibility changes, or any other consequential action. Each requires explicit human approval against an exact SHA.

## Reviewed candidate

- Repository: `middlechildmzk/artistos`
- Branch: `agent/network-intelligence-v1`
- Candidate SHA at runbook creation: `0b0bc50bb1b388c66c587c36822cae64d414c121`
- Supabase project: `artistos-core`
- Supabase ref: `myrtdfyjoxvtubusrrmf`
- Vercel project: `artistos-next`
- Migration: `20260804143000_network_intelligence_contact_safety.sql`

If the branch head changes, rerun all verification and update this runbook evidence before approval.

## What the migration changes

The migration is additive except for two controlled data corrections:

1. It preserves the prior `people.consent_status` in `consent_status_original` and reclassifies the inherited label `Active - imported from opt-in/download/old list` as `Public business contact; outreach not authorized`.
2. It backfills null `people.verification_status` values to `unverified` where an email exists.

It also:

- records legacy import column definitions that existed live but were not tracked
- adds a typed, fail-closed contact permission state
- marks suppressed people through workspace-scoped email identity
- normalizes organization categories without erasing historical display types
- creates suppression-safe `security_invoker` views
- denies anonymous access to those views
- enforces non-null workspace identity on Network Intelligence tables

## Current production preflight evidence

Read-only preflight on August 4, 2026 returned:

- active people: 5,684
- inherited consent labels to preserve and reclassify: 5,628
- null person verification states to backfill: 5,628
- active people matching suppression: 1
- null workspace rows across affected Network Intelligence tables: 0

These values are evidence for review, not permanent constants. Rerun the preflight immediately before migration.

## Required roles

- Migration approver: Dan Larson or explicitly delegated owner
- Migration executor: identified before execution
- Rollback owner: identified before execution
- Production smoke-test owner: identified before execution

The same person may hold multiple roles, but every role must be explicitly recorded.

## Gate 1: exact source verification

Before approval:

1. Record the exact branch head SHA.
2. Confirm PR #41 remains based on the intended `main` SHA.
3. Confirm GitHub Actions passes:
   - migration manifest reconciliation
   - capability and architecture tests
   - TypeScript
   - production build
   - historical migration replay
   - pending migration replay
   - workspace-isolation assertions
   - Network Intelligence safety-schema assertions
4. Confirm the exact Vercel preview is READY.
5. Confirm preview runtime logs contain no relevant warning, error, or fatal event.
6. Complete authenticated browser QA on desktop and approximately 390px width.

A green preview is not production verification.

## Gate 2: production backup and recovery evidence

Before applying the migration:

1. Confirm Supabase recovery capability and retention applicable to the project plan.
2. Export the affected person columns for the workspace:
   - `id`
   - `workspace_id`
   - `email`
   - `normalized_email`
   - `consent_status`
   - `verification_status`
   - `archived_at`
3. Export suppressions with `workspace_id`, normalized email, reason, and timestamp.
4. Save the output of `scripts/sql/network-intelligence-production-preflight.sql`.
5. Record the backup/export location, timestamp, executor, and rollback owner.
6. Confirm `scripts/sql/network-intelligence-consent-data-recovery.sql` has the reviewed expected row count.

Do not put exported contact data in GitHub, CI artifacts, chat, or public storage.

## Gate 3: read-only preflight

Run:

`script/sql/network-intelligence-production-preflight.sql`

Correct path:

`scripts/sql/network-intelligence-production-preflight.sql`

Approval must stop if:

- the live migration ledger no longer matches the reviewed manifest
- any affected table has null `workspace_id`
- the inherited-label or verification-backfill counts differ materially from the approved evidence without explanation
- suppression matching is unavailable or ambiguous
- production data changed after approval in a way that invalidates the reviewed row counts

## Gate 4: migration approval

The approval record must name:

- exact migration filename
- exact commit SHA
- expected affected-row counts
- migration executor
- rollback owner
- smoke-test owner
- recovery source
- approved execution window

Approval to merge code does not automatically approve the database migration. Approval to migrate does not automatically approve production deployment.

## Gate 5: apply migration

Apply only the tracked migration through the canonical Supabase migration workflow. Do not paste an edited variant into the SQL editor.

Immediately capture:

- migration result
- live migration-ledger entry
- start and completion timestamps
- executor
- any warning or error

If execution fails, stop. Do not edit the migration in place after a partial production attempt. Determine transaction state and recovery path first.

## Gate 6: post-migration verification

Run:

`scripts/sql/network-intelligence-production-postflight.sql`

Required results:

- migration ledger contains `20260804143000`
- remaining inherited consent labels: 0
- preserved inherited consent history matches the approved preflight count
- remaining null verification states for emailed people: 0
- suppressed people appear blocked
- all four contact-state views use `security_invoker=true`
- anon has no select access to the views
- authenticated has select access subject to underlying RLS
- all affected workspace columns remain non-null
- organization categories are populated

Then run authenticated owner, viewer, and outsider checks. Confirm suppressed contacts and `needs_verification` routes remain non-actionable.

## Gate 7: merge and production deployment

Only after successful post-migration verification:

1. Reconfirm the exact reviewed code SHA.
2. Merge that SHA through the approved PR.
3. Deploy that same SHA to production.
4. Confirm production alias and deployment ID.
5. Check runtime logs.
6. Complete authenticated desktop and approximately 390px smoke tests.
7. Confirm no route exposes a suppressed email or bypasses campaign assignment.

Do not promote a different commit than the approved commit.

## Recovery strategy

### Application failure after migration

Roll back the Vercel deployment to the previously verified production SHA. The migration is additive and can remain while the application is rolled back, provided post-migration RLS and view checks passed.

### Consent-classification correction must be reversed

Use the reviewed data-only recovery script:

`scripts/sql/network-intelligence-consent-data-recovery.sql`

The script:

- checks the expected preserved-row count
- restores only the original consent text where appropriate
- keeps typed execution permission fail-closed
- keeps suppression authoritative
- does not drop columns, views, constraints, or indexes

Run post-recovery count checks and preserve the evidence.

### Database migration fails or integrity checks fail

Stop rollout. Do not merge or deploy. Determine whether the migration transaction rolled back fully. Use the approved Supabase recovery path if database state cannot be reconciled safely. The rollback owner decides recovery execution with owner approval.

## First production workflow after rollout

Use the radio wedge only.

1. Select one source-visible radio target.
2. Review identity, submission policy, route state, freshness, and suppression.
3. Assign it to the correct release campaign.
4. Submit manually only after human approval.
5. Record the exact completed outreach with evidence.
6. Track reply, follow-up, deliverable, and outcome.
7. Confirm the interaction and outcome are connected to release, campaign, target, route, and evidence.

Do not manufacture an interaction merely to satisfy a readiness gate.

## Deferred follow-up

- Address the 13 pre-existing Supabase advisor performance warnings in a separate migration.
- Decide whether the public repository should become private for closed alpha.
- Reconcile historical outcomes before treating them as verified learning.
- Resume broad contact sourcing only after import, identity, suppression, and correction workflows are production-verified.
