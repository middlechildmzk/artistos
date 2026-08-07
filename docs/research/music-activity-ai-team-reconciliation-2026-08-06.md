# ArtistOS Music Activity Intelligence: AI-Team Reconciliation

Accessed: 2026-08-06

Status: research synthesis only. This does not establish provider authorization, contractual rights, source health, or production verification.

## Inputs reviewed

- Three uploaded provider reports covering Soundcharts, Songstats, Chartmetric, Viberate, ACRCloud, MetaBrainz sources, YouTube and related vendors.
- A Claude response supplied in the project conversation.
- A separate Kimi contact-sourcing output, which is unrelated to Music Activity Intelligence and is excluded from this decision.
- Current official provider documentation and live ArtistOS release identity data.

## Verified proving-ground identity

ArtistOS live data currently records:

- Artist: Middle Child
- Release: Never Alone
- ISRC: `QT6EX2615333`
- UPC: `882877618355`
- Spotify track ID: `4CzteKxZWpQw81hZPbUXj1`
- Release date: 2026-07-31

Any report using placeholder identifiers or unrelated Spotify IDs must not be used for provider resolution or test execution.

## Consensus decision

### First licensed pilot: Soundcharts

Soundcharts remains the first-choice licensed pilot because current official documentation verifies:

- a credential-free, limited sandbox dataset;
- 1,000 free production requests after account creation, without a credit card;
- self-serve monthly plans starting at $50 for 10,000 requests;
- song resolution by ISRC and platform ID;
- current song statistics, playlist entries and reach, chart ranks, radio broadcasts, audience and related identifiers;
- a usage endpoint for quota and rate-limit monitoring;
- a Python SDK, MCP access and optional data feeds.

Current public pricing:

| Plan | Monthly price | Included requests |
|---|---:|---:|
| Starter | $50 | 10,000 |
| Developer | $250 | 500,000 |
| Startup | $500 | 4,000,000 |
| Business | $900 | 10,000,000 |
| Scale | $1,700 | 20,000,000 |
| Enterprise | $4,500 | 60,000,000 |

The 1,000-request free production allowance is suitable for one tightly controlled Middle Child proof. It is not enough for a multi-artist production service.

### Specialist radio layer: ACRCloud

ACRCloud remains the likely second provider when direct fingerprint monitoring is justified. Official documentation verifies:

- 50,000+ indexed radio and TV stations;
- music monitoring with ISRC and UPC in results;
- custom-content monitoring through a private database;
- real-time monitoring results, callbacks and historical-results access;
- a 14-day trial without a credit card;
- commercial capacity and pricing shown after login.

Do not assume a generic recognition request automatically provides broad TikTok or YouTube UGC monitoring. Broadcast projects, file recognition and platform-specific UGC coverage are separate product questions that must be confirmed.

### Songstats: credible technical alternative, rights unresolved

The Songstats RapidAPI listing is real and currently publishes:

| Plan | Monthly price | Included requests |
|---|---:|---:|
| Basic | $0 | 20/day |
| Pro | $99.99 | 600/day |
| Ultra | $499.99 | 4,000/day |
| Mega | $999.99 | 10,000/day |

The listing exposes artist, track, activity, current-stat, historical-stat, audience, catalog, playlist and source endpoint groups.

However, the following claims in one uploaded report are not verified by the public listing or a provider contract:

- standard-plan multi-tenant SaaS rights;
- unrestricted raw-response caching;
- indefinite historical retention;
- customer-facing redistribution;
- Artist Brain derivative-use rights.

Therefore Songstats moves from `unverified/contact only` to `technically available, rights unresolved`. It is a valid low-cost comparison pilot only after the provider confirms product-use rights in writing.

### Chartmetric and Viberate

- Chartmetric officially publishes API access from $350/month. Consumer-dashboard subscriptions and trials do not establish API or redistribution rights.
- Viberate officially publishes API tiers starting at €300/month, with 60 calls/minute and three months of historical data at the entry tier.
- Both remain alternatives if Soundcharts coverage or contract terms are inadequate.

## Important corrections to uploaded reports

### MusicBrainz

Two distinct issues must not be collapsed:

1. MusicBrainz core database data is distributed under CC0 and can be downloaded and used broadly.
2. The free hosted MusicBrainz web service is documented as free for non-commercial use; commercial users are directed to commercial plans or contact.

ArtistOS may evaluate the service during development, but must not treat the free hosted API as an unrestricted commercial production dependency.

### ListenBrainz

ListenBrainz public popularity endpoints can be read without a key, but ArtistOS still requires an exact MusicBrainz identity and must confirm the applicable data/service terms for commercial product use. Coverage represents submitted ListenBrainz listens, not total DSP listening.

### YouTube quota and storage

Current YouTube documentation uses granular quota buckets:

- `search.list`: default 100 calls/day in its own bucket; each call costs 1 search quota unit;
- `videos.list`: 1 unit per request;
- most other read endpoints share a default 10,000-unit daily allocation.

The older statement that every search costs 100 units is no longer current under the June 2026 quota model.

Public statistical API data generally must be refreshed or deleted within 30 days unless the API client receives approval under YouTube's additional derived-metrics policy. ArtistOS must preserve source timestamps and refresh compliance rather than indefinitely caching public counters by default.

### Placeholder identity values

One uploaded report used a placeholder ISRC and an unrelated Spotify track ID. The only current ArtistOS proving-ground identifiers are the verified values recorded above.

## Rights gate

No shortlisted provider's public documentation conclusively grants all rights ArtistOS needs for a multi-tenant product:

- display to independent customer workspaces;
- raw payload caching;
- post-termination retention;
- customer exports;
- historical derived observations;
- alerts and recommendations;
- embeddings or Artist Brain use;
- provider record and evidence redistribution.

A single-artist Middle Child proof reduces the immediate redistribution risk, but it does not override provider terms. Written confirmation remains required before customer number two or any paid multi-tenant rollout.

## Provider outreach questions

Send the same written questions to Soundcharts and Songstats before paid production use:

1. May ArtistOS display provider-derived observations to multiple independent artist customers?
2. May ArtistOS cache raw responses, and for how long?
3. May ArtistOS retain normalized historical observations after cancellation?
4. May ArtistOS create and display alerts, summaries, confidence scores and recommendations?
5. May customers export provider-derived observations?
6. What attribution, logo and source-link requirements apply?
7. What correction, deletion and revocation obligations apply?
8. May the data be used for embeddings or reviewable Artist Brain learning?
9. Are provider record IDs, evidence URLs and screenshots redistributable?
10. Which endpoints and refresh cadences are included in the proposed plan?

## Engineering decision

Continue with the vendor-independent Music Activity contract and unified Insights feed.

Prepare adapters in this order:

1. ArtistOS-owned Link, campaign, placement and Proof activity.
2. Soundcharts production-token pilot, gated by explicit account creation and rights review.
3. YouTube public discovery candidate queue after YouTube Data API v3 is enabled.
4. Audius public adapter.
5. ListenBrainz only after exact MusicBrainz identity confirmation.
6. ACRCloud only after the fingerprint/catalog and station-monitoring pilot is approved.
7. Songstats comparison adapter only after a RapidAPI key is supplied and product-use rights are clarified.

Do not create accounts, enter trials, purchase plans, upload masters, or store provider credentials without explicit owner approval.

## Primary sources

- Soundcharts pricing: https://developers.soundcharts.com/pricing
- Soundcharts API portal and free access: https://developers.soundcharts.com/
- Soundcharts song endpoints: https://developers.soundcharts.com/api/reference/song/summary
- Soundcharts usage endpoint: https://developers.soundcharts.com/documentation/reference/usage-quotas/monitor-api-quota-and-rate-limits
- Songstats RapidAPI pricing: https://rapidapi.com/songstats-app-songstats-app-default/api/songstats/pricing
- Songstats RapidAPI endpoints: https://rapidapi.com/songstats-app-songstats-app-default/api/songstats
- ACRCloud broadcast monitoring: https://acrcloud.com/broadcast-monitoring/
- ACRCloud custom-content tutorial: https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-custom-content
- Chartmetric pricing: https://chartmetric.com/pricing
- Viberate API pricing: https://www.viberate.com/music-data-api/pricing/
- MusicBrainz API FAQ: https://musicbrainz.org/doc/MusicBrainz_API/FAQ
- MusicBrainz data licenses: https://musicbrainz.org/doc/About/Data_License
- YouTube Data API overview: https://developers.google.com/youtube/v3/getting-started
- YouTube search endpoint: https://developers.google.com/youtube/v3/docs/search/list
- YouTube video endpoint: https://developers.google.com/youtube/v3/docs/videos/list
- YouTube developer data-storage policies: https://developers.google.com/youtube/terms/developer-policies
