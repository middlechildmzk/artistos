# ArtistOS Music Data API Sprint — 2026-07-30

## Decision

Build a layered source stack instead of buying overlapping enterprise feeds immediately.

1. **Owned first-party sources:** YouTube, Kit, ArtistOS Links, fan consent, campaign and outcome data.
2. **Dashboard exports:** Spotify for Artists, Apple Music for Artists, DistroKid, Meta and TikTok.
3. **Low-cost market intelligence:** Soundcharts free production allowance first.
4. **Free/open enrichment:** Last.fm, ListenBrainz, MusicBrainz and Ticketmaster where licensing and terms permit.
5. **Paid escalation:** Chartmetric only after measuring missing coverage; Viberate API is deferred at its current entry price.

## Provider assessment

| Source | Access | Useful data | ArtistOS role | Constraint |
|---|---|---|---|---|
| Soundcharts | 1,000 free production requests, sandbox, then paid | Artist and song audience, Spotify monthly listeners, playlist entries, charts, radio, social audience | Primary pilot market-intelligence adapter | Credentials and endpoint entitlements required |
| Kit | Existing account API token | Subscribers, broadcasts, opens, clicks, unsubscribes | First-party audience and release conversion | User API token required |
| YouTube Data + Analytics | Google OAuth | Subscribers, channel views, videos, 28-day views/watch time/subscriber movement | Owned-channel source | Google app credentials and APIs must be enabled |
| Last.fm | Free API key | Artist listeners/playcount, track playcount, similar artists, charts | Public popularity and similarity signal | API key; not a replacement for DSP analytics |
| ListenBrainz | Public read APIs | Popularity, listens-derived statistics, similar artists, recommendations | Open popularity and discovery signal | Coverage depends on ListenBrainz submissions |
| MusicBrainz | No key for non-commercial web service; commercial use requires plan/contact | Canonical artist, release, recording, ISRC, barcode and relationship metadata | Identity and catalog reconciliation | One request/second; commercial terms must be resolved |
| Ticketmaster Discovery | Free developer key | Events, venues, attractions, ticket links | Live-event and market opportunity intelligence | API key; event coverage varies |
| Apple Music API | Apple developer token | Public catalog, charts, playlists, artist/release identity | Catalog and chart enrichment | Apple Developer Program membership and token setup; not Apple Music for Artists analytics |
| Spotify Web API | OAuth/client credentials | Catalog, releases, tracks, URLs, user-authorized library/playlist data | Catalog identity only | Development-mode restrictions; artist followers/popularity removed in Feb 2026; no S4A metrics |
| Chartmetric | Paid/licensed | Deep cross-platform, playlists, charts, competitors | Second-stage licensed adapter | Paid contract/key |
| Viberate | API starts at €300/month | Cross-platform artist/track/playlist/festival data | Deferred | Cost overlaps Soundcharts/Chartmetric |

## Build order

1. Generic encrypted API-credential capability and source-health model.
2. Soundcharts credentials and sync pilot using the canonical Spotify artist ID.
3. Kit credentials and subscriber/broadcast stats sync.
4. Last.fm and Ticketmaster key-based adapters.
5. ListenBrainz public popularity adapter.
6. MusicBrainz identity reconciliation with strict rate limiting and licensing guard.
7. Scheduled read-only syncs and freshness alerts after manual syncs pass.
8. Compare Soundcharts coverage against Chartmetric before purchasing another licensed feed.

## Trust rules

- Never label an export or public counter as private artist analytics.
- Preserve source URL, retrieved time, date represented, confidence and contradiction state.
- Keep provider secrets server-side and encrypted.
- Use audited, idempotent capabilities for every write.
- Separate workspace-shared source identities from user-specific OAuth credentials.
- Never scrape or bypass provider access controls when an API/export is unavailable.
