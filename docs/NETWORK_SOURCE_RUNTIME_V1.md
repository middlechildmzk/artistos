# Network Source Runtime V1

**Status:** implemented on `agent/network-source-runtime-v1`; Wikidata-only preview candidate after audit corrections. Pending CI, isolated migration replay, authenticated preview verification, merge, migration, and production rollout.

## Purpose

Network Source Runtime V1 converts a human search request into an explainable source plan, executes only approved adapters, preserves raw observations and evidence, suggests likely existing entities, and stops at a review queue. It extends the existing Opportunity Intelligence and capability runtime rather than creating a parallel sourcing system.

## First executable lane

The controlled preview proof supports:

- **Wikidata:** CC0 public identity discovery through the documented Wikimedia Action API.
- **YouTube Data API v3:** adapter code exists, but execution is blocked by source policy until ArtistOS has approved retention, refresh-or-delete, quota, and compliance controls.

Wikidata search hits are weak identity leads only. They do not prove entity type, current activity, legitimacy, submission eligibility, contact permission, or outreach authority.

## Flow

1. A signed-in workspace editor creates a search plan with explicit lanes and sources.
2. The source registry rejects unregistered, policy-blocked, or disabled sources before a run begins.
3. A second explicit human action executes the stored plan.
4. Each executable adapter returns normalized candidates and the original source payload.
5. ArtistOS appends source observations, evidence records, and source-supported score explanations.
6. Deterministic matching prioritizes stable source IDs and canonical URLs. Name-only similarity never clears the match threshold.
7. Matches remain suggestions. No automatic merge occurs.
8. A human records create, enrich, verify, quarantine, reject, or possible-merge intent.
9. Matched entity IDs are rechecked against the active workspace.
10. CRM promotion is a separate capability that always requires approval.
11. Sending, scraping, spending, and autonomous outreach remain outside this runtime.

## Audit corrections

- UI actions use form-render nonces and semantic idempotency keys, so double submission replays instead of re-running providers.
- Promotion never uses wildcard or name-only database matching.
- Campaign targets explicitly receive the actor workspace, and the historical single-workspace column default is removed by the pending migration.
- Discoveries remain `weak`, `unreviewed`, and freshness `unknown` until corroborating evidence exists.
- Missing legitimacy, reach, accessibility, relationship, and risk evidence remain null rather than receiving synthetic scores.
- Source observations are append-only per run.
- Failed executions close the search and run as failed rather than remaining stuck in `running`.
- Viewers can read runtime rows but cannot create or mutate source runs or match suggestions.

## Safety boundaries

- Source execution is human-operated and workspace-scoped.
- Provider policy is re-evaluated at plan creation and execution.
- YouTube execution is code-blocked.
- TikTok Research API remains ineligible for commercial discovery.
- SubmitHub and Groover remain external handoffs.
- No service-role credential is exposed to clients.
- `YOUTUBE_DATA_API_KEY`