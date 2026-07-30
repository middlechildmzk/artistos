# ArtistOS Source Connections

## Objective

Turn Music Intelligence from a manual snapshot screen into a source-visible operating layer that combines owned-channel APIs, artist-dashboard exports, ArtistOS Links, fan consent, campaigns, placements, and Proof.

## First production slice

### Google + YouTube

ArtistOS supports a Google OAuth web-server flow with offline access and these read-only scopes:

- `openid`
- `userinfo.email`
- `youtube.readonly`
- `yt-analytics.readonly`

The sync stores:

- channel subscribers when the count is public
- lifetime channel views
- video count
- 28-day views
- 28-day watch minutes
- 28-day average view duration
- 28-day subscriber gains
- 28-day subscriber losses

Tokens are stored in the existing `oauth_connections` table using a versioned AES-256-GCM envelope. Existing legacy token ciphertext cannot be assumed to use the same key or format and therefore requires a deliberate reconnect.

Required server environment variables:

- `ARTISTOS_PUBLIC_ORIGIN`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `ARTISTOS_TOKEN_ENCRYPTION_KEY`

`ARTISTOS_PUBLIC_ORIGIN` must be a persistent HTTPS hostname. Do not use a one-off Vercel deployment URL because Google requires an exact redirect URI and the ArtistOS login session plus OAuth state cookie must remain on the same hostname throughout the flow.

The Google Cloud project must enable:

- YouTube Data API v3
- YouTube Analytics API

The authorized redirect URI must be exactly:

`${ARTISTOS_PUBLIC_ORIGIN}/api/integrations/google/callback`

The connection must be launched from that same configured origin. ArtistOS therefore sends preview users to the stable origin before starting Google authorization.

### Universal metric export import

ArtistOS accepts a bounded CSV format for platforms that do not expose appropriate artist analytics APIs.

Accepted columns:

- `platform`
- `metric`
- `value`
- `date`
- optional `artist`
- optional `release`
- optional `source_url`

Imports are limited to 5 MB and 2,000 rows. A SHA-256 digest is used as the capability idempotency key so repeating the exact same export does not create a second import. Each successful import creates an evidence receipt in ArtistOS Proof.

## Provider boundaries

### Spotify

The public Spotify Web API remains useful for catalog identity, releases, tracks, and URLs. It is not treated as a source for Spotify for Artists streams, monthly listeners, or audience analytics. Those metrics require an artist-dashboard export or a licensed data provider.

### Apple Music for Artists, DistroKid, TikTok, Meta, Bandcamp

These sources enter the first slice through exports unless an approved OAuth/API application is configured. ArtistOS labels imported data as export-derived and preserves the reporting date and source URL.

### Chartmetric, Soundcharts, Viberate

These are paid licensed sources. ArtistOS can add adapters after the workspace has valid API credentials and terms that permit storage and display. The Sources page labels them as paid-key connectors rather than implying that public access exists.

## Security and trust boundaries

- No provider secret uses a `NEXT_PUBLIC_` environment variable.
- OAuth state is stored in an HTTP-only, same-site cookie and validated on callback.
- OAuth authorization and callback remain on the configured stable hostname.
- Tokens are encrypted before database storage.
- Business writes use the common capability runtime, workspace authorization, audit logging, and durable idempotency.
- Imported metrics create Proof receipts.
- Source URLs, retrieval dates, connection errors, freshness, and profile identity remain visible.
- No automated posting, spending, outreach, or destructive action is introduced.

## Product flow

`Source connection or export -> canonical artist identity -> dated metric snapshot -> Music Intelligence -> release and campaign attribution -> Proof -> Artist Brain recommendation`

## Next connectors

1. Configure and verify YouTube against the real Middle Child channel.
2. Import Spotify for Artists and DistroKid exports for Never Alone and Mercy.
3. Add Meta OAuth for the connected professional account.
4. Add TikTok OAuth or approved exports.
5. Add an email provider adapter for subscriber and campaign metrics.
6. Add paid intelligence adapters only after credentials and licensing are available.
7. Schedule approved read-only sync jobs and freshness alerts.
