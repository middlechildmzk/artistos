# ArtistOS Music Activity Intelligence provider research prompt

You are a specialist research analyst supporting ArtistOS, an evidence-first operating system for independent artists.

## Assignment

Determine the best lawful and technically viable data-provider strategy for ArtistOS Music Activity Intelligence.

ArtistOS needs to show artists a source-visible, continuously updated picture of where their music is:

- streamed or listened to;
- added to, removed from, or moved within playlists;
- played on terrestrial, satellite, college, internet, or community radio;
- charting;
- posted or used on YouTube, TikTok, Instagram, Facebook, SoundCloud, Audius, and other creator platforms;
- mentioned in articles, videos, podcasts, newsletters, communities, and social posts;
- driving first-party link clicks, fan capture, campaign outcomes, and measurable downstream activity.

This is provider and rights research, not product ideation. ArtistOS already has a source-agnostic observation model, capability runtime, authorization, idempotency, approvals, evidence, audit receipts, source catalog, workspace isolation, and Insights interface.

## Providers to investigate

At minimum, investigate:

1. Soundcharts
2. Chartmetric
3. Songstats
4. Viberate
5. ACRCloud
6. BMAT
7. Radiomonitor
8. Songkick or Bandsintown only where they add relevant live-event intelligence
9. Relevant TikTok, Instagram, YouTube UGC, social-listening, news, web-monitoring, and audio-recognition vendors with legitimate commercial APIs
10. Legitimate free or open sources that can complement the licensed layer, including ListenBrainz, MusicBrainz, Audius, YouTube Data API, Apple Music catalog/charts, Last.fm, and public chart sources

Do not assume a consumer subscription includes API access. Do not infer rights from marketing pages.

## Research questions

For every provider, verify:

### Coverage

- Exact platforms, territories, station types, charts, playlists, social networks, publications, and content formats covered
- Track-level versus artist-level coverage
- ISRC, UPC, platform-ID, provider-ID, canonical-URL, metadata, and fingerprint matching support
- Playlist additions, removals, position history, curator identity, reach, and historical depth
- Radio spin timestamps, station identity, geography, duration, confidence, and fingerprint evidence
- YouTube, Shorts, TikTok, Reels, UGC, official-sound usage, links, mentions, and audio matches
- Charts, public counters, audience metrics, and comparable-artist intelligence
- Historical backfill and maximum lookback period

### Technical access

- Current API availability and application process
- Exact relevant endpoint families
- Authentication model
- Webhooks, callbacks, polling, exports, bulk endpoints, and incremental cursors
- Refresh cadence by source and data type
- Quotas, concurrency, pagination, rate limits, and overage behavior
- Sandbox, trial, free tier, sample data, or free production allowance
- SDKs, MCP servers, data feeds, cloud delivery, and export formats
- Provider identity-resolution workflow
- Error, source-health, correction, and revocation support

### Commercial and legal rights

- Current pricing, minimum contract, setup fees, overages, and whether pricing is public or quote-only
- Whether a closed-alpha SaaS product may use the API
- Multi-tenant use rights
- Whether ArtistOS may cache raw responses and for how long
- Whether ArtistOS may retain historical observations after a subscription ends
- Whether ArtistOS may display raw values, derived metrics, alerts, summaries, and evidence URLs to customers
- Redistribution, sublicensing, attribution, logo, branding, and source-label requirements
- Deletion, correction, revocation, and data-subject obligations
- Restrictions on model training, embeddings, derived intelligence, competitor comparison, exports, and customer downloads
- Whether public data is licensed for commercial reuse or merely visible on a website
- Whether audio fingerprints or reference recordings may be uploaded and retained

### Product fit

Evaluate each provider for:

- Middle Child as the proving-ground artist
- independent electronic, future bass, melodic bass, EDM, creator-content, radio, playlist, and sync workflows
- a closed alpha with limited budget
- source-visible evidence and explainable confidence
- mobile-friendly alerts and 15-minute artist work sessions
- future multi-tenant scale without rebuilding the ArtistOS data model

## Evidence standards

Use current primary sources wherever possible:

- official API documentation;
- official pricing pages;
- official terms, developer agreements, data licenses, privacy documentation, and retention policies;
- official support articles;
- direct written provider confirmation when documentation is incomplete.

For each material claim include:

- source title;
- source URL;
- access date;
- exact relevant language or a careful paraphrase;
- confidence: verified, supported, uncertain, or vendor-claim-only;
- whether the claim is contractual, documented technical behavior, marketing language, or inference.

Do not present search snippets, old reviews, affiliate articles, or unsourced claims as verified access. When sources conflict, flag the conflict rather than selecting the more favorable answer.

## Required distinctions

Keep these acquisition classes separate:

- owned first-party data;
- artist-authorized provider data;
- public platform data;
- licensed commercial data;
- imported reports;
- fingerprint-matched observations;
- manually verified evidence;
- inferred or probable matches.

Keep these statuses separate:

- available;
- configured;
- authorized;
- provider verified;
- source healthy;
- historically backfilled;
- production verified.

Never describe a sandbox, trial, credential, successful build, or sample response as production verification.

## Required deliverables

### 1. Executive recommendation

Recommend:

- the best first licensed provider for ArtistOS;
- the best radio or fingerprint provider;
- the best free/open companion sources;
- the smallest credible closed-alpha stack;
- which capabilities should be deferred.

### 2. Provider matrix

For every provider include:

- coverage;
- relevant endpoints or delivery methods;
- cadence;
- historical depth;
- identity method;
- free/trial access;
- estimated cost;
- contract status;
- multi-tenant rights;
- caching/retention rights;
- display/redistribution rights;
- attribution requirements;
- implementation complexity;
- key limitations;
- evidence links;
- recommendation: pilot, negotiate, monitor, or reject.

### 3. Rights and risk memo

Identify:

- unresolved licensing questions;
- prohibited or risky collection methods;
- scraping or terms-of-use concerns;
- data that ArtistOS may observe but should not store or redistribute;
- owner approvals and legal review required before production use.

### 4. Technical adapter brief

For the top three providers, provide:

- authentication flow;
- entity-resolution flow;
- recommended polling or webhook cadence;
- endpoints mapped to ArtistOS observation kinds;
- idempotency keys;
- pagination and retry behavior;
- source-health monitoring;
- raw-payload retention recommendation;
- correction and deletion handling;
- expected environment variables;
- provider-specific tests;
- production-verification checklist.

### 5. Pilot plan

Design a Middle Child / “Never Alone” pilot that:

- starts with verified ISRC and platform IDs;
- avoids name-only matching;
- measures playlists, radio, charts, video/social usage, mentions, and first-party ArtistOS Link outcomes;
- labels all sources and freshness;
- defines false-positive review;
- defines success criteria, cost ceiling, rollback, and owner actions.

## Decision rule

Prefer the smallest stack that provides reliable, lawful, explainable coverage. Do not recommend recreating a vendor’s restricted dataset through unsupported scraping, account farming, deceptive access, or terms violations.

Do not create accounts, start trials, accept contracts, upload recordings, purchase plans, or submit credentials. Report the exact owner action required for each next step.
