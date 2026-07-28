# ArtistOS Consolidation Blueprint

Status: Canonical working plan
Date: 2026-07-26

## 1. Company Architecture

ArtistOS is one connected creator-network platform with three reinforcing engines:

1. Inbound growth: StackBuilder, education, free tools, templates, SEO/GEO, case studies.
2. Internal network intelligence: discover, resolve, verify, enrich, qualify, contact, invite, claim, activate.
3. Core creator product: Artist Graph, Creator Studio, Release Workspace, Campaign Intelligence, relationships, outcomes, and learning.

Middle Child remains the artist brand, proving ground, and case-study engine. SourcingOS remains commercially separate while its provenance, entity-resolution, trust, qualification, and outreach patterns are reused internally.

## 2. Canonical Product Model

### Persistent root

The Artist Graph is the durable top-level identity.

- identity and aliases
- catalog and releases
- brand memory
- goals and preferences
- collaborators and organizations
- audience and fans
- relationships
- campaign history
- lessons learned

### Primary workflow

The Release Workspace is the main recurring user experience.

- audio and versions
- artwork and assets
- lyrics
- metadata
- contributors and Rights Lite
- timeline and readiness
- Creator Studio outputs
- promotion campaign
- outreach and placements
- results and retrospective

### Differentiating module

Campaign Intelligence is embedded in the Release Workspace.

- explainable matching
- opportunity evidence cards
- freshness and provenance
- verification state
- private risk indicators
- outreach CRM
- response and placement tracking
- outcome learning

## 3. Shared Data Foundation

Use the existing `artistos-core` Supabase project as the canonical database unless a later migration audit finds a blocking defect.

Existing public tables already cover much of the target model:

- `workspaces`, `workspace_members`
- `artists`, `artist_platform_profiles`
- `releases`, `release_platform_links`, `assets`
- `campaigns`, `campaign_targets`, `campaign_metrics`
- `people`, `organizations`, `properties`
- `interactions`, `relationship_signals`, `tasks`
- `submission_endpoints`, `playlist_placements`
- `source_records`, `verification_events`, `risk_events`, `suppressions`
- `outcomes`
- `fans`
- `ai_generations`
- import and platform support tables

All public tables observed on 2026-07-26 had RLS enabled. RLS presence does not prove policy correctness; a policy and advisor audit remains mandatory.

## 4. Canonical Entity Lifecycle

Every discovered person, organization, channel, playlist, artist, or opportunity should move through explicit states:

`discovered -> researched -> verified -> qualified -> contacted -> replied -> invited -> claimed -> registered -> active -> partner`

Possible terminal or safety states:

`inactive`, `stale`, `suppressed`, `rejected`, `duplicate`, `do_not_contact`

A claimed profile must never expose private CRM notes, enriched contact details, internal risk reasoning, or licensed data.

## 5. Product Surfaces

### ArtistOS Home

- current release
- readiness score
- next deadline
- recommended next action
- campaign activity
- relationships requiring attention
- recent content and tools

### Creator Studio

Creator Music Prompts becomes ArtistOS Creator Studio / Creator Assist.

Initial capabilities:

- structured Suno and Udio prompt builders
- continuation and remix prompts
- lyric and theme assistance
- genre, mood, and positioning assistance
- visual concept and video-prompt generation
- short-form content plans
- Spotify pitch and release-description generation
- mix/master checklist and measured technical checks

Do not present AI inference as measured audio fact. Deep audio diagnosis, mastering, stem intelligence, and model training remain postponed until independently validated.

### Release Workspace

- create and manage release
- upload or link assets
- metadata and artwork validation
- lyrics and contributor completion
- distributor-ready checklist
- timeline and deadline calculation
- Creator Studio outputs
- campaign plan
- post-release retrospective

### Campaign Intelligence

CuratorFit / CuratorOS capabilities become this module.

- playlists, blogs, channels, influencers, radio, DJs, press, sync, and partner opportunities
- fit explanations
- source and freshness
- verification and trust state
- private risk flags
- submission endpoints and rules
- personalized pitch assistance
- manual approval before sending
- campaign CRM and outcome tracking

### Public Knowledge and Acquisition

StackBuilder becomes the public knowledge, tools, and workflow engine.

- educational clusters
- free tools
- templates
- calculators
- comparisons
- workflow stacks
- original research
- affiliate recommendations where appropriate and disclosed

Every free tool should have a save-to-workspace conversion path.

### Internal Network Intelligence

Adapt proven SourcingOS patterns into a private ArtistOS operations console.

Core workflows:

- Discover
- Resolve
- Verify
- Enrich
- Qualify
- Engage
- Invite
- Claim
- Activate
- Retain

Initial lanes:

- supply: curators, playlist owners, channel owners, influencers, blogs, radio, DJs, sync contacts, partners
- demand: artists, bands, producers, managers, labels, agencies, creator teams

## 6. Repository Disposition

Initial observed repositories:

- `artistos`: canonical application candidate; retain and audit
- `curatorfit`: merge campaign, directory, claim, application, admin, trust, and CRM concepts
- `sourcingos-unified`: reuse patterns and selected internal components; keep public product separate
- `creator-music-prompts2` and other Creator Music Prompts generations: compare, extract best prompt/data/UI assets, archive duplicates
- `localstackai`: evaluate as StackBuilder ancestor / acquisition engine
- `middle-child-experience`: remain separate artist experience and proof brand
- `middlechildstudio` / `mcstudio`: verify purpose and archive or merge duplicates

No repository should be deleted until content, deployments, data dependencies, and unique assets are verified.

## 7. Deployment Disposition

Observed Vercel projects include multiple ArtistOS/Aristos variants, probes, tests, CuratorFit, Creator Music Prompts, StackBuilder, SourcingOS, and Middle Child experiences.

Rules:

1. Select one canonical ArtistOS production project.
2. Preserve preview deployments for migration testing.
3. Label or remove obsolete probes only after env-var, domain, and dependency review.
4. Do not expose service-role keys or internal-only operations to public clients.
5. Add health, analytics, error monitoring, and release annotations before public traffic tests.

## 8. Golden Path for the First Alpha

### Artist journey

`content/free tool -> account -> artist profile -> release -> readiness -> Creator Studio -> campaign recommendations -> outreach tracking -> outcome -> retrospective -> next release`

### Curator / creator journey

`discovered -> resolved -> verified -> personally contacted -> invited -> claims profile -> sets preferences -> receives relevant opportunities -> records outcome -> relationship strengthens`

## 9. First Alpha Scope

Must ship:

- auth and workspace membership
- multi-role identity/profile
- artist profile and basic Brand Memory
- release creation and asset/metadata entry
- deterministic readiness checklist
- initial Creator Studio tools using structured workflows
- manually curated opportunities with evidence cards
- campaign CRM
- profile invitation and claim flow
- private internal notes and public profile separation
- retrospective and outcome capture
- product analytics

Explicitly postponed:

- open marketplace
- autonomous outreach
- own distribution service
- full publishing/royalty administration
- advanced audio models
- guaranteed placements or streams
- public accusations of botting
- broad label enterprise features
- non-music creator expansion

## 10. Security and Trust Requirements

- RLS on all exposed tables with ownership/role predicates
- no authorization based on user-editable metadata
- service-role keys server-only
- signed URLs and private buckets for unreleased audio
- explicit non-training promise for user music unless separately opted in
- auditable AI generations
- human approval before outbound messages
- evidence, retrieval date, freshness, confidence, contradiction, reviewer state, and permitted use for material claims
- suppression and do-not-contact enforcement
- export/delete/account controls
- legal disclaimers for Rights Lite and promotion outcomes

## 11. Inbound Growth Plan

First content/tool clusters:

1. Release preparation and DistroKid readiness
2. Spotify pitching and curator outreach
3. AI music prompting and Creator Studio workflows
4. Mixing/mastering checks and release audio preparation
5. Artwork, Canvas, visual, and short-form content workflows

First free tools:

- Spotify pitch character checker and builder
- release timeline calculator
- metadata completeness checker
- artwork validator
- lyric formatter
- release checklist generator
- structured music prompt builder
- campaign budget planner
- one-sheet generator

## 12. Outbound Seeding Plan

Build a small high-quality network before an open marketplace.

Initial target:

- 25-50 verified curators/media/creator partners in a narrow related-genre cluster
- 5-10 concierge alpha artists with an upcoming release
- manually reviewed evidence and contact history
- personal outreach and invitation, not mass automation

## 13. Metrics and Decision Gates

Acquisition:

- organic visits
- tool starts/completions
- visitor-to-account conversion
- source and cost per signup

Activation:

- profile complete
- release created
- readiness completed
- first Creator Studio output saved
- first opportunity viewed
- first campaign action recorded

Value:

- time saved
- errors caught
- recommendation relevance
- pitch usefulness
- response and placement outcomes

Retention:

- repeat tool use
- between-release activity
- next release created
- relationship and CRM updates

Revenue:

- free-to-paid conversion
- per-release versus monthly-plan performance
- churn and cancellation reasons

Do not expand major scope until users complete the golden path, return for another release, and demonstrate willingness to pay.

## 14. Implementation Order

### Phase A: Truth inventory

- repository and branch audit
- Vercel project/domain/env audit
- Supabase schema/policy/storage audit
- Drive/vault/content/data inventory
- duplicate and dependency map

### Phase B: Shared foundation

- canonical design system
- entity and role model
- artist/release/relationship/evidence contracts
- permissions and public/private boundaries
- analytics event taxonomy

### Phase C: Golden path

- onboarding
- artist profile
- release workspace
- readiness
- Creator Studio
- campaign recommendations and CRM
- outcome/retrospective

### Phase D: Network intelligence

- import/discovery
- entity resolution
- qualification and evidence
- outreach and invitations
- claim flow

### Phase E: Acquisition

- first content cluster
- free tools
- save-to-account conversion
- onboarding email flow
- Middle Child case study

### Phase F: Closed alpha

- concierge artists
- verified partners
- observe sessions
- test pricing
- publish evidence-backed findings

## 15. Non-Negotiable Build Rule

Do not build another isolated feature. Every feature must attach to the shared identity, release, relationship, evidence, or outcome system and strengthen either the inbound or outbound flywheel.
