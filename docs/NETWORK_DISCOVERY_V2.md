# Network Discovery V2

## Status

Network Discovery V2 is a dependent implementation built from the fully verified Network Source Runtime V1 head. It is not merged, live-migrated, provider-authorized, or production-deployed.

## Product objective

Turn public source discovery into one evidence-first identity graph:

`Search intent → source plan → approved adapters → source observations → identity cluster → deterministic match suggestions → human review → approval request`

The unit of value is not a raw search result. It is a reviewable candidate whose source, stable IDs, URLs, confidence, conflicts, freshness, policy state, and cost are visible.

## Implemented source lanes

### Wikidata

- CC0 public entity discovery.
- Search results are enriched through a batched entity lookup.
- Preserves QID, instance-of classification, official websites, and supported external identifiers.
- Uses a descriptive User-Agent, caching, bounded results, timeout, response-size limit, and one retry for rate-limit or service-unavailable responses.
- Does not imply current activity, legitimacy, submission eligibility, consent, or outreach permission.

### Radio Browser

- Public internet-radio directory discovery.
- Preserves stable station UUID, homepage, stream URL, tags, country, state, language, last-check time, and stream-health state.
- Uses call-sign search when present; otherwise it uses a bounded genre/context tag.
- Treats service availability as best-effort and directory membership as non-actionable identity evidence.

## Cross-source identity clustering

Candidates cluster only when they share an approved stable identity URL or a source-specific stable external identity. Name similarity alone cannot create a cluster or clear the existing-record match threshold.

A clustered candidate preserves:

- one deterministic cluster key
- all corroborating source slugs
- one append-only observation per source and run
- one evidence record per observation
- source-specific external IDs
- official identity URLs
- contradictions and match reasons

Cross-source corroboration strengthens identity confidence only. It does not increase legitimacy, outreach permission, submission eligibility, or relationship strength.

## Request and cost transparency

Every plan records:

- query variants
- compatible sources per lane
- skipped or policy-blocked sources
- estimated source requests
- source cost labels

Every run records actual adapter-reported request count and source cost summary. These are operational transparency fields, not billing guarantees.

## Blocked roadmap sources

- YouTube Data API: blocked pending retention, refresh/delete, quota, derived-metric, and policy approval.
- X API: blocked pending paid-access budget and commercial storage/display review.
- MusicBrainz hosted API: blocked pending commercial plan or approved mirror architecture.
- Podcast Index: blocked pending credential, attribution, storage, refresh, and commercial-use review.

No Bluesky integration is included in this roadmap.

## Safety boundaries

This implementation does not:

- scrape protected pages
- bypass access controls
- enrich private contact data
- infer marketing consent
- create, merge, or contact CRM entities automatically
- send outreach
- spend money
- apply production migrations

CRM promotion remains separately approval-gated. Identity merge remains a future dedicated workflow.

## Controlled proof

The first proof should use Wikidata and Radio Browser only against a small radio batch:

1. Create one radio source plan.
2. Inspect query variants and request estimate.
3. Run approved sources explicitly.
4. Confirm separate source observations and evidence records.
5. Confirm shared official homepages produce one identity cluster.
6. Review one existing-record enrichment, one verify-more result, and one rejection.
7. Request CRM promotion for one accepted result and confirm it stops at approval.
8. Do not approve, import, send, merge, or deploy to production during the proof.
