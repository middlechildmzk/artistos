# Kimi Network Intelligence Research Reconciliation

## Status

Source report: `ArtistOs_Network_Intelligence_Report.pdf`, received August 4, 2026.

The report is useful discovery input, not verified production data. It includes individual emails, named contacts, commercial directory claims, platform counts, prices, and proposed API integrations. Those details must not be bulk-imported or treated as current without source-level and record-level verification.

The raw report is intentionally not committed because the canonical repository is public and the report contains individual contact information. This document preserves the product and source findings without republishing the contact list.

## Additions to the canonical taxonomy

The report adds or strengthens these source and target families:

1. SoundCloud and repost communities
   - Repost networks
   - Genre promotion channels
   - Official SoundCloud distribution or discovery programs

2. Podcasts and audio shows
   - Music interview and review podcasts
   - DJ mix and genre-show submission routes
   - Podcast-friendly music licensing and permissions

3. Music PR and campaign agencies
   - Publicists
   - Radio promotion firms
   - Creator and social campaign agencies
   - Referral and service-provider relationships

4. DJ record pools
   - Electronic, dance, urban, and open-format pools
   - Submission or servicing routes
   - Membership and eligibility requirements

5. Submission gateways
   - SubmitHub
   - Groover
   - Musosoup
   - Daily Playlists
   - Playlist Push
   - Soundplate
   - One Submit
   - SongTools

6. Commercial intelligence providers
   - Playlist and curator intelligence
   - Creator and media contact datasets
   - Sync directories
   - Venue and festival directories
   - Industry roster and relationship databases

These are not all target verticals. Some are source providers or execution gateways. ArtistOS should preserve that distinction so a directory, a curator, a playlist, and a submission route do not collapse into one record type.

## Verified source-level findings

### artist.tools

Official documentation currently advertises:

- 113,000+ playlist and curator contacts for Artist Access
- CSV export at Industry Access
- Developer Access in beta
- Developer rate limits of 1 request per second and 10,000 requests per day
- Developer pricing of $250 monthly or $1,980 annually

Decision: **high-priority licensed API candidate**.

Correction to the report: the report combines the $15 Artist plan with API access and cites 158,000 contacts. The official pricing documentation places API access in the separate Developer tier and currently advertises 113,000+ contacts.

Required before integration:

- obtain current API terms and data-use license
- confirm storage, caching, contact display, and downstream outreach rights
- use playlist and curator stable IDs
- preserve bot and quality signals as source claims, not ArtistOS facts
- run one real request and record a Proof receipt

### SubmitHub

SubmitHub is a structured submission platform with its own terms and authenticated workflows. No public developer API was verified during this review.

Decision: **external workflow and partnership candidate**, not an API integration claim.

ArtistOS may support:

- public profile and submission-policy research where permitted
- campaign preparation
- budget and credit tracking
- external portal handoff
- response, feedback, placement, and outcome logging

Direct submission requires an officially supported integration and explicit user approval.

### Groover

Official Groover materials currently describe more than 3,000 active curators and professionals, guaranteed feedback rules, and connections across playlists, radio, blogs, labels, booking, and other industry roles. No public developer API was verified during this review.

Decision: **external workflow and business-development candidate**.

ArtistOS should not represent Groover as API-connected until Groover provides supported partner access and a real provider request succeeds.

### Feedspot

Official Feedspot pages advertise bulk Excel or CSV delivery and large creator/media datasets, including:

- 500,000 Instagram influencers
- 100,000 TikTok creators
- 150,000 YouTube creators
- 220,000 blogs
- additional podcast, journalist, and media-contact datasets

Decision: **licensed dataset candidate requiring enhanced review**.

Required before purchase or ingestion:

- obtain sample rows and field definitions
- confirm music-specific coverage
- document collection basis and geography
- confirm redistribution and multi-workspace use rights
- test identity accuracy, email status, freshness, and duplicate rate
- prevent consumer or personal addresses from being treated as business contacts

The report's broad contact-universe counts cannot be added together because these datasets overlap and official marketing totals vary by product page.

### !earshot Distro

!earshot Distro is operated for Canadian campus and community radio. Its public station and show-contact pages include preferred genres, accepted formats, submission methods, instructions, dates, and explicit warnings against irrelevant or unsolicited attachments.

Decision: **high-value public radio source and external submission gateway**.

Important boundary: availability and upload eligibility are Canada-focused. ArtistOS must show territory and eligibility before recommending it.

### The Sync Report

The official site currently advertises search access to more than 400 music supervisors plus television, film, advertising, brand, studio, and production contacts. Six-month access is listed at $99.95.

Decision: **paid licensed directory candidate**.

Correction to the report: the official public page currently says 400+ music supervisors, not 600+.

### Indie on the Move

Official pricing describes an open venue database with paid booking details, festival and conference details, advanced search, emailing, templates, and analytics.

Decision: **high-priority live-booking directory and workflow candidate**.

Current official pricing reviewed:

- Premium: $13.99 monthly or $119.90 annually
- Deluxe: $39.99 monthly or $335.90 annually

Required before integration: verify whether data may be exported into ArtistOS and whether outreach must remain inside Indie on the Move.

### FestivalNet

FestivalNet advertises more than 26,000 events, paid access to full event contacts, list exports, and musician or performer opportunity workflows.

Decision: **licensed festival and event-source candidate**.

Current official membership information reviewed:

- Pro: $15 monthly, $30 quarterly, or $60 annually
- exports cost an additional amount per record

ArtistOS must not import or redistribute paid contact records without explicit license rights.

### The Unsigned Guide

Official pages advertise more than 8,500 UK music-industry contacts across 50 areas, including more than 2,600 live-industry contacts and more than 520 record-label listings.

Decision: **strong UK licensed-directory candidate**.

Current official pricing reviewed:

- £5.99 monthly
- £10.99 quarterly
- £32.99 annually

### ROSTR

ROSTR advertises rosters, relationships, contacts, signings, tour and festival directories, and information on 15,000+ labels, agencies, publishers, and management companies. Contact details require Pro access. No public API was verified during this review.

Decision: **licensed intelligence and relationship-source candidate**, pending terms and access review.

## Record-level policy for the attached contact lists

Individual contacts from the report must enter a quarantine or review queue, never the live sendable network directly.

For each proposed record:

1. Resolve the organization or property using a canonical website, verified platform URL, or stable external ID.
2. Verify that the person or contact route still appears on an official or permitted source.
3. Record the exact source URL, observed date, and acquisition class.
4. Classify the route as public business, licensed, user-imported, inferred, stale, failed, or suppressed.
5. Never promote an inferred address to verified without deliverability and identity evidence.
6. Respect no-unsolicited-material and portal-only policies.
7. Keep the contact private to the workspace.
8. Require human approval before any submission, email, DM, spend, or upload.

## Product implications

The Network Intelligence source registry should now model:

- source family
- target verticals covered
- acquisition class
- public, licensed, partner, or account-authorized access
- API availability: unverified, documented, configured, authorized, provider-verified
- stable identifiers and available fields
- license and redistribution restrictions
- cost and entitlement owner
- territory and eligibility
- refresh cadence
- source freshness and health
- privacy and platform risk
- import mode: API, CSV, manual, public directory, or external handoff
- review requirement

The target record should separately model:

- organization
- person
- property such as playlist, channel, station, publication, show, venue, or pool
- submission endpoint
- evidence
- interaction and outcome

## Recommended acquisition order

1. !earshot public station and show data, with Canadian eligibility visible
2. Official websites, mastheads, submission pages, and public business routes
3. artist.tools developer-access evaluation and license review
4. MusicFibre review-queue import
5. Indie on the Move and FestivalNet licensing conversations
6. SubmitHub and Groover partnership or handoff design
7. The Sync Report, The Unsigned Guide, ROSTR, and Feedspot sample-data and license review
8. Direct-contact verification from the attached report only after the parent source is approved

## Not accepted as production truth

The following remain unverified or unsuitable for direct import:

- the report's 200,000+ total-contact estimate
- named playlist follower counts without canonical platform IDs and observation dates
- individual emails without current official evidence
- claims that SubmitHub or Groover expose public APIs
- commercial directory data without license rights
- generic press addresses represented as music-submission routes
- follower or subscriber counts without source and observed date
- any recommendation to scrape profiles, reveal-gated emails, login-only pages, or paywalled contact records
