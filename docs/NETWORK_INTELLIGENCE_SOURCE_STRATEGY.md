# Network Intelligence Source Strategy

## Status

This document captures AI-team research as **discovery input**, not verified production truth. Every source, directory, contact, count, API claim, access method, and compliance interpretation must be verified before use.

ArtistOS must not import or expose records solely because they appeared in an AI-generated list. Each record requires provenance, identity review, freshness, and an allowed acquisition basis.

## Product goal

Build a recruiter-style music-industry sourcing system inside the existing ArtistOS graph:

`Artist → Release → Campaign → Target → Person / Organization / Property → Submission Route → Interaction → Deliverable → Proof → Outcome → Artist Brain`

The system should help artists find and qualify legitimate opportunities across music, media, creators, radio, sync, and live industries without creating a parallel CRM or autonomous outreach engine.

## Canonical target verticals

1. Streaming and playlist curators
   - DSP editorial teams
   - Independent playlist owners
   - Brand playlists
   - Curator networks and submission portals
   - Playlist properties linked to people or organizations

2. Media and press
   - Publications, blogs, newsletters, podcasts
   - Writers, editors, critics, and producers
   - Regional and genre-specific outlets

3. Radio and audio broadcasting
   - College, community, public, commercial, satellite, and internet radio
   - Program directors, music directors, hosts, producers, and submission desks

4. Video and social creators
   - YouTube promotion and review channels
   - TikTok and Instagram creators
   - Theme pages, music discovery accounts, visual creators, and agencies

5. Sync and visual media
   - Music supervisors
   - Production libraries and publishers
   - Trailer houses
   - Advertising music buyers
   - Game audio and music teams

6. Live booking
   - Venues, talent buyers, festivals, campus programmers, and booking agents

7. Industry representatives
   - Label and publishing A&R
   - Managers, management companies, entertainment attorneys, and related professional partners

8. Service and resource organizations
   - Promotion, distribution, education, licensing, creator tools, and other resources discovered through sources such as MusicFibre

## Acquisition classes

### A. Official APIs

Preferred when terms permit the intended ArtistOS use.

Examples may include Spotify catalog identity, YouTube account-authorized data, Ticketmaster discovery, Last.fm, ListenBrainz, and other reviewed providers.

Required controls:
- provider-specific terms review
- exact identity binding
- server-side secrets
- bounded requests and rate limits
- source URL and capture time
- provider state recorded as configured, authorized, or verified

### B. Licensed or paid directories

Examples may include industry registries, venue and booking databases, creator databases, or commercial intelligence platforms.

Required controls:
- documented license and permitted downstream use
- no redistribution beyond license rights
- source attribution and access period
- workspace-level entitlements where applicable

### C. Gateway marketplaces and submission portals

Examples include curated submission platforms and approved external portals.

ArtistOS should store public profile metadata, fit, submission policy, campaign history, evidence, spend, response, and outcome. Final submissions remain human-controlled unless a supported API and explicit approval exist.

### D. Editorial and public directories

Examples include station directories, publication lists, association directories, public mastheads, event speaker rosters, and resource directories.

These are seed sources only. Entries must be deduplicated, identity-verified, freshness-checked, and linked to the original source.

### E. Public profile discovery

ArtistOS may identify business contact routes intentionally published by the account owner, such as:
- official website contact pages
- submission forms
- public business email addresses
- management or agency links
- public bio-link destinations
- channel About-page business contacts where access is permitted

ArtistOS must not bypass platform controls, evade login walls, defeat anti-bot measures, harvest private data, or infer personal contact data from hidden or unrelated sources.

## Required data model

Use existing ArtistOS entities before adding schema:

### Organization
- canonical and display name
- organization type
- website and primary source
- geography
- trust, risk, activity, and verification state
- relationship stage and next action

### Property
Represents a playlist, channel, station, publication, social account, podcast, venue, library, or similar asset.

Minimum fields:
- platform and property type
- canonical external ID and URL
- name and owner relationship
- genre, mood, territory, language, and audience tags
- followers or subscribers with source and observed date
- average views or engagement only when source-visible
- activity and freshness
- submission preference
- verification and contradiction state

### Person
- canonical identity
- role, company, and beat or remit
- public business contact route
- email verification state
- relationship and suppression state
- source and freshness

### Submission endpoint
- email, form, portal, postal, or other route
- official source URL
- free or paid
- requirements and accepted formats
- released or unreleased policy
- typical turnaround when sourced
- last verified date

### Evidence
Every material field should be traceable to evidence containing:
- source URL
- source type
- observed date
- capture method
- confidence
- verification status
- correction, revocation, and contradiction state

## Contactability rules

A contact route is not the same as permission to send.

Required states:
- public business contact
- user-imported contact
- licensed contact
- inferred contact pattern
- verified deliverable
- stale or failed
- suppressed

ArtistOS must never label an inferred email as verified. Name-only matching is prohibited. Suppression must be rechecked immediately before any outreach action.

## Quality and fit scoring

Scores must be explainable and source-visible. Do not create one opaque number.

Candidate dimensions:
- identity confidence
- source quality
- freshness
- activity
- genre and mood fit
- territory and audience fit
- release-stage fit
- submission availability
- contactability
- prior relationship
- prior response and outcomes
- risk indicators

Playlist and channel evaluation should distinguish:
- audience size from actual engagement
- current activity from historical size
- editorial, algorithmic, brand, independent, and network ownership
- source-visible metrics from estimates
- organic discovery from paid placement claims

## Compliance and safety

Before operationalizing any source family, obtain legal review appropriate to the market and use case. AI-generated legal summaries are not authoritative.

Baseline product rules:
- no automated mass outreach
- no scraping that violates access controls or platform terms
- no hidden personal-data enrichment
- no payola, deceptive placement, artificial streaming, or guaranteed-result claims
- explicit approval before sending, spending, publishing, or submitting
- unsubscribe and suppression enforcement
- retention, correction, and deletion workflows
- separate fan marketing consent from industry-contact status
- maintain a source and lawful-use record for imported datasets

## Phased implementation

### Phase 1: Search and qualification
- recruiter-style cross-entity search
- music-specific vertical and platform filters
- public contact-route filters
- target profile workspace
- campaign handoff

### Phase 2: Source registry and import review
- source catalog with acquisition class, license, terms, refresh method, and risk
- MusicFibre and other directory imports into a review queue
- duplicate detection and canonical identity matching
- approve, reject, merge, or quarantine actions

### Phase 3: Evidence-backed enrichment
- official website and public profile link discovery
- contact and submission-route extraction from permitted pages
- freshness checks
- corrections and contradictions
- no autonomous emailing

### Phase 4: Saved sourcing workflows
- saved searches
- named target lists
- release-fit scoring
- find-more-like-this
- bulk campaign assignment with explicit approval

### Phase 5: Outcome learning
- response, acceptance, placement, deliverable, and outcome tracking
- source and contact quality learning
- Artist Brain recommendations for the next release

## Research backlog from the AI team

The following source families should be evaluated, not assumed:
- SubmitHub and Groover public profiles and permitted integrations
- Spotify and other DSP catalog metadata and public playlist fields
- Hype Machine and public music-blog directories
- college, community, and internet radio directories
- public YouTube channel and website business-contact routes
- creator databases and licensed influencer datasets
- public sync associations, credits, libraries, and agency directories
- venue, festival, campus, management, booking, and A&R directories
- public mastheads, staff pages, social bios, and submission guidelines

For each candidate source, record:
- owner and URL
- acquisition class
- access and license terms
- fields available
- stable identifiers
- update frequency
- coverage and bias
- cost
- privacy and platform risk
- allowed use in ArtistOS
- verification test and owner action
