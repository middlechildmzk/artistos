# Soundcharts Never Alone pilot

## Canonical release identity

- Artist: Middle Child
- Release: Never Alone
- Release date: 2026-07-31
- ArtistOS release ID: `47210a7f-d595-4ec4-8d7b-639e0049dd16`
- ISRC: `QT6EX2615333`
- UPC: `882877618355`
- Spotify track ID: `4CzteKxZWpQw81hZPbUXj1`

Do not use artist-name or title matching for this pilot.

## Current Soundcharts authentication documentation

Soundcharts' current Getting Started and Authorization pages recommend OAuth-style client credentials for new integrations: create a `client_id` and `client_secret`, exchange them for a short-lived bearer token, and use that token on API calls.

A March 12, 2026 Soundcharts Help Center article still documents the free 1,000-production-request credentials as `x-app-id` and `x-api-key` values. Because both are first-party Soundcharts sources and may reflect a credential transition, ArtistOS accepts either pair:

1. `client_id` + `client_secret` -> short-lived bearer token, preferred for new integrations.
2. `x-app-id` + `x-api-key` -> legacy request headers, used only when the token exchange rejects the supplied pair and a bounded legacy validation request succeeds.

Credentials remain encrypted server-side. Legacy credentials are never written into a pseudo token outside process memory and raw Soundcharts response bodies are not retained.

## Owner setup

1. Sign up or sign in to Soundcharts.
2. Confirm the account shows the 1,000-request free production allowance.
3. Create or retrieve the API credential pair shown by the Soundcharts console.
4. Enter the pair into ArtistOS Connections. Do not paste secrets into chat, GitHub, logs, screenshots, or client-side code.
5. Run one controlled release sync for Never Alone from Insights.

## Expected pilot observations

The release pilot attempts entitled Soundcharts endpoints for:

- recording identity and cross-platform IDs
- current song statistics
- Spotify playlist entries and playlist reach
- radio spins and radio play counts
- Spotify, Apple Music, Shazam, and YouTube chart entries
- provider usage/quota health

Each endpoint is independent. HTTP 403 or 404 is recorded as unavailable, not fabricated as zero and not treated as failure of every other endpoint.

## Storage boundary

ArtistOS may store only normalized release-scoped observations and Proof receipts during this pilot:

- metric snapshots
- deduplicated playlist placements
- radio-spin Proof records
- chart-entry Proof records
- endpoint/source health
- quota usage
- one summary sync receipt

Do not retain raw provider response bodies.

## Production and rights boundary

A successful pilot proves only technical access and observed coverage for this ArtistOS workspace. It does not prove multi-tenant SaaS display rights, caching rights, post-termination retention, customer export rights, or Artist Brain derivative-use rights. Written provider confirmation remains required before licensed Soundcharts data is offered to other ArtistOS customers.

No purchase, plan upgrade, production rollout, or destructive change is authorized by this runbook.
