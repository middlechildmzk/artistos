# Soundcharts / Never Alone pilot runbook

Status: implementation runbook. This does not authorize account creation, spending, production deployment, or multi-tenant customer display.

## Canonical proving-ground identity

- Artist: Middle Child
- Release: Never Alone
- ArtistOS release ID: `47210a7f-d595-4ec4-8d7b-639e0049dd16`
- ISRC: `QT6EX2615333`
- UPC: `882877618355`
- Spotify track ID: `4CzteKxZWpQw81hZPbUXj1`
- Release date: `2026-07-31`

Do not replace these values with name-only search results, placeholders, or inferred matches.

## Owner setup

1. Create or sign in to the Soundcharts developer dashboard.
2. Confirm that the account displays the free 1,000-request production allowance.
3. Create a dedicated API client for the ArtistOS preview pilot.
4. Copy the client ID and client secret once. Never paste either secret into chat, source control, screenshots, client-side code, or logs.
5. In the ArtistOS Preview deployment, open **Connections → Soundcharts**.
6. Enter the client ID and client secret. Add the Soundcharts team ID only when the account has multiple teams or token creation requires it.
7. Select **Validate and save Soundcharts**. This exchanges the credentials for a short-lived bearer token and stores the client credentials encrypted in the workspace connection.
8. Open **Insights → Soundcharts release pilot**.
9. Confirm that **Never Alone · QT6EX2615333** is selected.
10. Select **Run controlled release sync** once.

## Expected request sequence

The first controlled run may call:

1. Song resolution by ISRC
2. Song identifiers
3. Current song statistics
4. Spotify playlist entries
5. Spotify playlist reach
6. Radio spins since release date
7. Radio spin counts
8. Spotify chart entries
9. Apple Music chart entries
10. Shazam chart entries
11. YouTube chart entries
12. Team usage and quota health

Each request normally consumes one API call except the usage endpoint, which Soundcharts documents as free. Endpoint availability depends on the active entitlement. A 403 or 404 from one optional endpoint is recorded as unavailable and does not invalidate successful responses from other endpoints.

## ArtistOS write boundary

The controlled run may write only:

- release-scoped `metric_snapshots`;
- deduplicated `playlist_placements`;
- radio-spin and chart-entry `evidence_records`;
- one release-pilot summary Proof receipt;
- capability idempotency and audit records;
- Soundcharts connection health, endpoint availability, quota summary, and release UUID mapping.

The pilot does not retain raw Soundcharts response bodies. It stores normalized fields, provider record IDs, source URLs, timestamps, confidence, and endpoint status.

## Verification checklist

After the run, verify:

- the returned Soundcharts UUID is attached to the exact ArtistOS release ID;
- the summary Proof receipt cites ISRC `QT6EX2615333`;
- available, unavailable, and failed endpoints are counted separately;
- metrics are release-scoped rather than presented as generic artist totals;
- playlists are not duplicated when the same provider record is observed again;
- radio and chart events have deterministic observation keys;
- no raw provider payload appears in Proof metadata;
- Insights shows source, freshness, evidence, and the correct release;
- Vercel runtime logs contain no secret values or unhandled errors;
- API usage remains within the approved allowance.

## Stop conditions

Stop the pilot and do not retry repeatedly when:

- ISRC resolution returns a different ISRC;
- Soundcharts reports the ISRC as ambiguous or blacklisted;
- authentication fails after one credential recheck;
- quota is unexpectedly exhausted;
- endpoint responses contradict the canonical Spotify identity;
- the provider terms or written response prohibit the intended closed-alpha display;
- a response contains personal data or fields outside the approved storage boundary.

## Commercial rights gate

Before ArtistOS exposes Soundcharts-derived observations to a second artist workspace, obtain written answers covering:

1. multi-tenant end-user display;
2. raw response caching and duration;
3. historical observation retention after cancellation;
4. derived alerts, summaries, confidence scores, and recommendations;
5. customer exports;
6. source attribution and branding;
7. correction, deletion, and revocation duties;
8. embeddings or Artist Brain derivative use;
9. evidence URLs and provider identifiers;
10. endpoint coverage and supported refresh cadence.

A successful token request or Never Alone sync proves provider access for that account. It does not prove redistribution rights or production readiness.
