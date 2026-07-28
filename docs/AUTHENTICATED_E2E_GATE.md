# ArtistOS authenticated end-to-end gate

This gate runs only after historical migration recovery, clean local replay, workspace-isolation SQL, database advisors, and linked historical schema-drift verification have succeeded.

## Required identities

- Workspace owner: can create and approve consequential work.
- Same-workspace viewer: can read permitted workspace data but cannot perform managed writes.
- Second-workspace user: cannot read or mutate the first workspace.

Validate configuration first:

```bash
node scripts/check-e2e-environment.mjs
```

Never commit passwords, session state, service-role keys, or production database credentials.

## Required journeys

### Authentication and onboarding

1. Unauthenticated protected routes redirect to login.
2. Valid login succeeds.
3. Invalid password fails without exposing account existence or internal errors.
4. Repeated login attempts do not bypass protection.
5. A new user receives exactly one workspace and owner membership.
6. Re-running onboarding is idempotent and does not create duplicate workspaces or artists.

### Workspace isolation

1. Owner can read their releases, campaigns, contacts, Brain records, evidence, approvals, and opportunities.
2. Same-workspace viewer can read allowed records.
3. Viewer cannot invoke editor/owner capabilities.
4. Second-workspace user cannot read first-workspace records by URL, identifier, query modification, or direct API request.
5. Storage paths outside the caller's workspace are denied.

### Capability runtime

1. Release, campaign, CRM, task, evidence, Brain, and planner writes use capability invocation.
2. A repeated idempotency key returns the prior result and creates no duplicate row.
3. Unauthorized capability invocation is denied and audited.
4. Approval-required actions remain pending until approved.
5. Approval executes once and cannot be replayed.
6. Failed actions preserve an auditable failure state without partial business writes.

### Release and campaign flow

1. Create or select a release.
2. Create a campaign through the runtime.
3. Add a release asset through the runtime.
4. Update a task and verify persisted state.
5. Assign a CRM target to the campaign.
6. Log outreach and verify relationship/follow-up synchronization.

### Evidence and Artist Brain

1. Create an evidence record with source and retrieval metadata.
2. Create a semantic memory or claim linked to evidence.
3. Weak or conflicting information remains reviewable and is not promoted to verified fact.
4. Review a claim and verify reviewer, timestamp, and prior state are preserved.
5. Legacy Brain v1 backfill is idempotent and produces a reconciliation report.

### Opportunity Intelligence

1. Create a plan-only opportunity search.
2. Record a raw observation and normalized observation with lineage.
3. Review and score an opportunity with feature-level explanation.
4. Promote an approved opportunity into CRM/campaign context.
5. No autonomous scraping, outreach, or external execution occurs.

### Failure paths

1. Duplicate submissions do not create duplicates.
2. Stale approval links or already-executed approvals fail safely.
3. Missing evidence produces a clear validation failure.
4. Network or provider errors do not leave an action falsely marked complete.
5. Browser refresh during mutation does not replay the write.
6. Deleted or inaccessible targets cannot be mutated by guessed IDs.

## Evidence package

Store these as short-lived CI artifacts or a private test report:

- test run summary
- failed-step screenshots
- browser console errors
- network failures with secrets redacted
- capability receipt IDs
- approval and audit record IDs
- workspace-isolation assertions
- database advisor output
- linked historical schema-diff summary

## Exit criteria

Production rollout remains blocked unless:

- every required journey passes
- there is no cross-workspace data exposure
- consequential writes are capability-backed
- idempotency and approval replay protections pass
- historical schema drift is empty or fully explained
- all remaining defects have an owner and explicit release decision
