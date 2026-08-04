# Network Source Runtime V1

**Status:** implemented on `agent/network-source-runtime-v1`; pending CI, isolated migration replay, authenticated preview verification, merge, migration, and production rollout.

## Purpose

Network Source Runtime V1 converts a human search request into an explainable source plan, executes only approved adapters, preserves raw observations and evidence, suggests likely existing entities, and stops at a review queue. It extends the existing Opportunity Intelligence and capability runtime rather than creating a parallel sourcing system.

## First executable lane

The initial proof supports:

- **Wikidata:** CC0 public identity discovery through the documented Wikimedia Action API.
- **YouTube Data API v3:** public channel identity, descriptions, stable channel IDs, and audience signals when the server-only `YOUTUBE_DATA_API_KEY` is configured.

Wikidata results are identity leads only. YouTube results are public platform metadata only. Neither adapter claims a submission route, contact permission, or outreach authority.

## Flow

1. A signed-in workspace contributor creates a search plan with explicit lanes and sources.
2. The source registry rejects unregistered or non-executable sources before a run begins.
3. A second explicit human action executes the stored plan.
4. Each adapter returns normalized candidates and the original source payload.
5. ArtistOS creates source observations, evidence records, and feature-level score explanations.
6. Deterministic matching compares stable IDs where available, canonical URLs, and normalized exact names.
7. Matches remain suggestions. No automatic merge occurs.
8. A human records create, enrich, verify, quarantine, reject, or possible-merge intent.
9. CRM promotion is a separate capability that always requires approval.
10. Sending, scraping, spending, and autonomous outreach remain outside this runtime.

## Safety boundaries

- Source execution is human-operated and workspace-scoped.
- Provider policy is code-enforced.
- TikTok Research API remains ineligible for commercial discovery.
- SubmitHub and Groover remain external handoffs.
- No service-role credential is exposed to clients.
- `YOUTUBE_DATA_API_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix.
- New runtime tables use RLS and deny anonymous access.
- Source results never become CRM targets automatically.
- `merge_existing` cannot execute through the promotion capability.
- CRM promotion is approval-gated and optional campaign assignment remains human-selected.

## Data model

The runtime extends:

- `opportunity_searches` for provider-neutral plans and last-run summaries.
- `opportunity_source_observations` for raw and normalized source evidence.
- `opportunities` for review, source policy, identity-match, and eligibility state.
- `opportunity_score_features` for explainable scoring.

It adds:

- `opportunity_search_runs` for auditable executions.
- `opportunity_match_candidates` for reviewable deterministic match suggestions.

## Configuration

Wikidata requires no credential. It requires a meaningful User-Agent and respectful rate handling.

YouTube requires:

```text
YOUTUBE_DATA_API_KEY=<server-only key>
```

The adapter remains visible as `configuration_required` and is skipped when the key is absent.

## Verification required before any production claim

- Capability and architecture tests.
- TypeScript and production build.
- Full historical and pending migration replay.
- RLS and anonymous-access assertions.
- Exact-preview runtime-log check.
- Authenticated desktop and approximately 390px browser QA.
- One controlled plan → source run → match review → approval request proof.
- Explicit migration, merge, and production rollout approval.

## Not implemented in V1

- Search engines or unrestricted open-web crawling.
- Protected-page or CAPTCHA scraping.
- MusicBrainz commercial integration.
- TikTok commercial discovery.
- Marketplace profile ingestion.
- Automatic contact enrichment.
- Automatic identity merges.
- Autonomous CRM import, outreach, sending, spending, or submission.
