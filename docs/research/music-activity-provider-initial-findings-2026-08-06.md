# ArtistOS Music Activity Intelligence: Initial Provider Findings

Accessed: 2026-08-06

Status: research findings, not provider authorization or production verification.

## Executive recommendation

### Closed-alpha stack

1. **ArtistOS-owned data**: ArtistOS Links, fan capture, campaign activity, placements, outcomes and imports.
2. **Free/open companion signals**: YouTube public discovery, YouTube Analytics for owned channels, Audius, ListenBrainz after exact MusicBrainz identity confirmation, and public Apple/chart data where terms permit.
3. **First licensed pilot**: Soundcharts using its free 1,000-request production allowance after an owner-created developer account and rights confirmation.
4. **Specialist radio layer later**: ACRCloud when direct fingerprint monitoring and station callbacks justify the cost and catalog-upload obligations.
5. **Alternatives**: Viberate for a lower-cost daily-refreshed API, or Chartmetric for a broader mature dataset if its contract explicitly allows the ArtistOS product use case.

Do not build production around Last.fm or MusicBrainz free web-service access until commercial-use permission is confirmed. Do not use TikTok Research API as a commercial product dependency.

## Provider matrix

| Provider | Current documented access | Coverage and cadence | Public price or trial | Product-rights status | Recommendation |
|---|---|---|---|---|---|
| Soundcharts | REST API, no-registration sandbox, free production token | Song resolution by ISRC; playlist entries/reach; radio spins; charts; audience and social data. Described as real-time/high-frequency, but source-specific cadence must be verified. | Sandbox free. 1,000 free production requests, no card. Paid API pricing is quote-based. | Public docs do not establish multi-tenant display, caching, retention after cancellation or redistribution rights. Written confirmation required. | **Pilot first.** Existing ArtistOS adapter already fits its identity model. |
| Chartmetric | REST API, MCP and data shares | Artist, track, playlist, chart, social, radio and sync data. Chartmetric explicitly says its API should not be treated as real-time for live applications. | API from US$350/month. Consumer plans and trials are separate from API rights. | Terms restrict unauthorized extraction and competing-product use. Developer/custom agreement must explicitly authorize ArtistOS. | **Negotiate as alternative**, not the first free pilot. |
| Viberate | Music Data API and custom delivery | Daily-refreshed artists, tracks, playlists, streaming/social channels and events. | 14-day trial. Published API tiers start at €300/month with 3 months history and 60 calls/minute. | Public pricing does not resolve multi-tenant redistribution, caching and derived-alert rights. | **Budget alternative** when daily cadence is sufficient. |
| ACRCloud | Broadcast-monitoring API, callbacks and historical-results API | Direct radio/TV fingerprint monitoring, custom catalog or ACRCloud music database, station selection and recognition evidence. | Paid capacity; public pages do not provide a simple closed-alpha price. | Requires catalog/reference-data and branding review. ACRCloud publishes mandatory attribution rules for API-powered monitoring. | **Specialist phase-two radio provider.** |
| BMAT Vericast | REST-style API and managed monitoring | Audio recognition, broadcast monitoring, UGC/rights workflows, uploads, evidence and thousands of channels. | Quote-only enterprise engagement. | Rights-oriented enterprise contract required. | **Monitor for rights/revenue phase**, not closed-alpha analytics. |
| Radiomonitor | Managed airplay service | Strong radio-chart and airplay positioning across multiple territories. Public API documentation was not found. | Quote/contact only. | Unknown until direct commercial inquiry. | **Monitor**, do not implement yet. |
| Songstats | Dashboard and public marketing mention a Developer API | Claims real-time alerts for playlist positions, charts, feature placements and cross-platform metrics. | Public API pricing and developer contract were not located in this pass. | Insufficient public documentation for backend commitment. | **Contact and verify**, but not first choice. |

## Free and open companion sources

### ListenBrainz

- No credential is required for public popularity endpoints.
- Provides total listen count, listener count and top recordings for an exact MusicBrainz artist ID.
- Coverage reflects listens submitted to ListenBrainz, not total DSP consumption.
- ArtistOS already has a credential-free adapter.
- Middle Child cannot be synced until an exact MusicBrainz artist ID is confirmed. Name-only matching is prohibited.

### MusicBrainz

- Useful for canonical artists, releases, recordings, ISRCs and URL relationships.
- The free web service is documented for non-commercial use.
- Commercial ArtistOS use requires a commercial plan or written permission.
- Use as an identity-review source during development, not as an assumed free production dependency.

### Last.fm

- Useful for public listeners, playcounts, top tracks and similar artists.
- Last.fm instructs commercial and research users to contact it before using the API.
- The existing ArtistOS adapter should remain disabled for commercial rollout until permission is recorded.

### Audius

- Public REST/SDK access supports users, tracks, playlists and platform-specific play counts.
- Suitable as a free platform-specific signal.
- Audius play counts do not represent total DSP streams or royalties.

### YouTube

- YouTube Data API can search public videos, channels and playlists, then retrieve video statistics.
- Search is quota-expensive relative to video lookups; cache discovery cursors and retrieve known videos by ID.
- YouTube Analytics requires OAuth and applies to owned channels/content.
- Public-search matches must retain query, title/description evidence, channel identity and match confidence.

### TikTok

- Display API supports an authorized user's profile and videos.
- Video query verifies that requested videos belong to the authorized user.
- It is not a broad commercial UGC search API.
- Research API access is a separate restricted program and should not be treated as an ArtistOS product source.

## Technical conclusions

### Stable ArtistOS adapter contract

Every provider adapter should output the existing Music Activity observation shape:

- canonical workspace, artist and release IDs;
- ISRC, platform track ID or provider recording ID;
- event kind;
- provider and acquisition class;
- provider record ID and source URL;
- match method, confidence and review state;
- event and observation timestamps;
- cadence and freshness;
- territory and subject identity;
- metrics;
- evidence ID and raw-payload metadata boundary.

Provider responses must not be rendered directly by Insights.

### Polling plan for a Soundcharts pilot

For one proving-ground artist and one current release:

- Resolve song by ISRC once and cache the Soundcharts UUID.
- Check current playlist entries every 6 hours during the first 30 release days, then daily.
- Check radio spins and chart entries hourly only when the plan and quota support it; otherwise every 6 hours.
- Fetch audience/streaming snapshots daily.
- Store incremental provider record IDs and event timestamps to prevent duplicate observations.
- Monitor quota headers and stop before exhaustion.
- Record endpoint-level errors without marking the whole provider successful.

The free 1,000-request allowance is enough for a tightly scoped proof, not a multi-artist production service.

### Rights questions requiring written answers

Before customer-facing production use, ask each shortlisted vendor:

1. May ArtistOS display raw and derived data to multiple independent artist workspaces?
2. May ArtistOS cache raw responses? For how long?
3. May ArtistOS retain historical observations after the API subscription ends?
4. May ArtistOS generate alerts, summaries, confidence scores and recommendations from the data?
5. May users export provider-derived observations?
6. What source attribution and branding are required?
7. What corrections, deletion and revocation obligations apply?
8. May provider data be used in embeddings or Artist Brain learning, or only transient analytics?
9. Are screenshots, evidence URLs and provider record IDs redistributable?
10. Which endpoints are included in the proposed plan, and what refresh cadence is contractually supported?

## Official sources reviewed

### Soundcharts

- API access, sandbox and 1,000 free production requests: https://help.soundcharts.com/en/articles/10091349-how-can-i-get-access-to-soundcharts-api
- API overview: https://help.soundcharts.com/en/articles/3190633-does-soundcharts-have-an-api
- API plans: https://help.soundcharts.com/en/articles/10104294-what-are-the-api-subscription-levels
- Rate-limit documentation: https://help.soundcharts.com/en/articles/10126090-is-there-a-rate-limit-on-soundcharts-api
- Song by ISRC: https://developers.soundcharts.com/api/reference/song/get-song-by-isrc
- Playlist entries: https://developers.soundcharts.com/api/reference/song/get-playlist-entries
- Radio spins: https://developers.soundcharts.com/api/reference/song/get-radio-spins

Note: two Soundcharts help articles surfaced conflicting 5,000/minute and 10,000/minute rate-limit statements. ArtistOS should use the lower figure until the account dashboard or contract confirms the current limit.

### Chartmetric

- API overview: https://chartmetric.com/features/developer-api
- API quickstart: https://apidocs.chartmetric.com/
- Pricing: https://chartmetric.com/pricing
- Terms: https://chartmetric.com/terms-of-service
- API help center: https://help.chartmetric.com/en/collections/Chartmetric%20API

### Viberate

- API overview: https://www.viberate.com/music-data-api/
- API pricing: https://www.viberate.com/music-data-api/pricing/
- InstantMatch/custom matching: https://www.viberate.com/web-data-collection/

### ACRCloud

- Broadcast monitoring: https://acrcloud.com/broadcast-monitoring/
- Music monitoring tutorial: https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music
- Custom-content monitoring tutorial: https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-custom-content
- Branding requirements: https://acrcloud.com/branding/

### BMAT

- Product workspace and Vericast API: https://www.bmat.com/workspace/
- Record-label monitoring: https://www.bmat.com/vericast-record-labels/
- Publisher monitoring: https://www.bmat.com/vericast-publishers/

### Open and platform sources

- ListenBrainz popularity API: https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html
- MusicBrainz API commercial-use FAQ: https://musicbrainz.org/doc/MusicBrainz_API/FAQ
- Last.fm API introduction: https://www.last.fm/api/intro
- Audius developer overview: https://docs.audius.co/developers/introduction/overview/
- Audius tracks: https://docs.audius.co/sdk/tracks/
- YouTube Data API: https://developers.google.com/youtube/v3/docs
- YouTube search: https://developers.google.com/youtube/v3/docs/search/list
- YouTube Analytics: https://developers.google.com/youtube/analytics/
- TikTok Display API: https://developers.tiktok.com/doc/display-api-overview/

## Current decision

Proceed with the source-independent ArtistOS activity model and free sandbox verification. Prepare a narrowly scoped Soundcharts production-token pilot, but do not create the provider account or ingest licensed data until Dan explicitly approves the signup and the vendor confirms the closed-alpha display/caching use case.
