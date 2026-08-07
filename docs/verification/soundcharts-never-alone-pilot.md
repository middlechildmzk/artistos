# Soundcharts Never Alone pilot verification

As of 2026-08-07.

## Identity

- Artist: Middle Child
- Release: Never Alone
- ArtistOS release ID: `47210a7f-d595-4ec4-8d7b-639e0049dd16`
- ISRC: `QT6EX2615333`
- UPC: `882877618355`
- Spotify track ID: `4CzteKxZWpQw81hZPbUXj1`

## Provider state

- Soundcharts is configured in the live workspace with encrypted credentials.
- Artist-level provider verification succeeded on 2026-08-07.
- Soundcharts artist UUID: `11e81bbd-e265-d4ac-bac4-a0369fe50396`.
- Artist-level sync stored four entitled observations with no endpoint errors.
- The artist-level Spotify playlist request returned 100 entries at the configured request limit. That is not asserted to be the artist's total playlist count.

## Release-level provider result

The user ran the ISRC-level Never Alone pilot.

Verified live database state after that run:

- 56 licensed playlist placement rows are attached to the Never Alone release.
- Playlist names, observed entry dates, and track positions were normalized for those rows.
- Playlist follower values were not returned/normalized on the stored placement rows, so null values must not be presented as zero reach.
- No Soundcharts radio-spin Proof records are currently stored for Never Alone.
- No Soundcharts chart-entry Proof records are currently stored for Never Alone.
- A verified `soundcharts_release_pilot_sync` Proof receipt exists.

The first reach request was parsed by an earlier generic numeric collector and stored pagination values such as `page_limit`, `page_offset`, and `page_total`. Those values are not playlist reach and must not be displayed as reach metrics.

## Corrected reach contract

The release adapter now treats the Soundcharts Spotify playlist-reach endpoint as a typed time series and accepts the documented item fields:

- `date`
- `playlistCount`
- `playlistReach`
- `playlistEditorialCount`
- `playlistEditorialReach`
- `playlistUserCount`
- `playlistUserReach`

Normalized ArtistOS metrics are:

- `spotify_playlist_count`
- `spotify_playlist_reach`
- `spotify_playlist_editorial_count`
- `spotify_playlist_editorial_reach`
- `spotify_playlist_user_count`
- `spotify_playlist_user_reach`

Pagination keys are excluded from generic metric normalization.

A new explicit release refresh is required to populate this corrected reach history. ArtistOS does not spend the user's remaining Soundcharts allowance automatically.

## Insights UX

Insights now uses a music-intelligence hierarchy modeled on useful patterns from specialist analytics products while retaining ArtistOS evidence boundaries:

1. release identity and headline KPIs;
2. playlist-count and playlist-reach trend charts;
3. recent playlist additions with position/date/source context;
4. cross-platform audience observations;
5. compact provider health and explicit refresh control;
6. the broader source-visible Music Activity ledger below.

Provider credentials and maintenance remain under Settings → Data sources.

## Verification boundary

- Exact implementation branch: `agent/artistos-music-activity-v1`
- Production deployment: not performed
- Schema migration for this UX/parser pass: none
- Raw Soundcharts response bodies retained: no
- Corrected playlist-reach history populated: not yet; requires one user-triggered refresh
- Multi-tenant Soundcharts display/caching/retention rights: not contractually confirmed
