# Artist Knowledge Graph and Curator Graph

## Purpose

This is the shared intelligence layer for ArtistOS. It connects releases, recordings, content, campaigns, contacts, curators, creators, playlists, usage, rights, metrics, evidence, and learned outcomes without collapsing them into one generic CRM record.

The first implementation is intentionally foundational. It creates canonical entities, evidence-backed links, multi-lane opportunity searches, source observations, multidimensional scores, and an authenticated review workspace. It does not claim that automated web discovery, enrichment, or outreach execution already exists.

## Core principles

1. **Canonical identity before automation.** A person, organization, playlist, channel, submission route, and social profile may represent one connected opportunity. They must remain separate entities that can be resolved and linked.
2. **Evidence before trust.** Every material discovery and score must preserve its source, observation time, retrieval time, freshness, confidence, and evidence lineage.
3. **Facts are not inferences.** Verified facts, supported inferences, weak signals, unknowns, stale facts, and conflicts remain distinguishable.
4. **Scores are explainable.** Overall fit is never a follower-count shortcut. Feature contributions and evidence are first-class records.
5. **Search is multi-lane.** Playlist, media, creator, radio, DJ, sync, collaborator, and industry lanes can run independently and be compared.
6. **Human review precedes promotion and outreach.** Search execution begins plan-first. CRM promotion and consequential actions remain reviewable.
7. **Workspace isolation is mandatory.** Every graph, search, opportunity, observation, and score feature is workspace scoped with RLS.

## Data model

### `knowledge_entities`

Canonical nodes for:

- artists and aliases
- recordings and releases
- assets and content
- campaigns
- people and organizations
- channels and playlists
- opportunities and submission routes
- contact points and social profiles
- relationships and interactions
- usages, metrics, rights, territories, and platform accounts

`canonical_key` supports deterministic deduplication where a stable identifier exists. Probabilistic resolution should create reviewable candidate matches rather than silently merging records.

### `knowledge_entity_links`

Typed relationships between entities. Examples:

- person `works_at` organization
- organization `operates` playlist
- playlist `featured` recording
- creator `used` recording
- opportunity `targets` release
- social profile `belongs_to` person
- submission route `accepts_for` channel

Links preserve confidence, validity windows, attributes, and evidence identifiers.

### `opportunity_searches`

Stores calibrated search intake and independent search lanes. Initial execution modes are:

- `plan_only`
- `human_operated`

No row implies autonomous external execution.

### `opportunities`

Reviewable curator, creator, media, sync, radio, collaborator, and industry opportunities. Each can reference canonical graph entities and existing CRM people or organizations.

The initial scoring dimensions are:

- fit
- legitimacy
- reach quality
- accessibility
- relationship potential
- risk

### `opportunity_source_observations`

Append-oriented observations from official integrations, user imports, public sources, research providers, or human review. Raw and normalized payloads are both preserved with normalization version, observed time, retrieval time, freshness, confidence, and evidence.

### `opportunity_score_features`

Feature-level explanations behind scores. A future score such as `86` must be reconstructable from evidence-backed contributions, not treated as an opaque model output.

## Discovery pipeline

```text
Approved intake
→ multi-lane strategy
→ source adapters
→ raw observations
→ parsing and normalization
→ deterministic/probabilistic identity resolution
→ enrichment
→ freshness and legitimacy review
→ feature-level scoring
→ human review
→ CRM promotion
→ campaign assignment
→ outcome evidence
→ learning observation
```

## Initial Never Alone proof

The first practical proof should use the `Never Alone` release and create six lanes:

1. melodic bass and future bass playlists
2. electronic music publications and blogs
3. YouTube channels
4. short-form creators
5. DJs, radio, and mix channels
6. sync and creator-safe usage opportunities

Acceptance criteria:

- at least 100 discovered records
- duplicate identities grouped for review
- source and last-verified dates visible
- legitimacy and risk flags visible
- feature-level fit explanations
- approved records promotable into existing CRM records
- no outreach without explicit human approval
- outcomes feed evidence and learning observations

## Next implementation slices

### Slice 1: Runtime capabilities

Add typed capabilities and handlers for:

- `opportunity.create_search`
- `opportunity.approve_search`
- `opportunity.record_discovery`
- `opportunity.review`
- `opportunity.promote_to_crm`

All writes must use validation, authorization, policy, idempotency, audit, evidence, and workspace constraints.

### Slice 2: Source adapter contract

Create a provider-neutral adapter interface supporting:

- connection health
- initial and incremental collection
- pagination and cursors
- rate-limit reporting
- retry classifications
- raw payload preservation
- normalization versions
- evidence generation
- revocation

The first source should be a compliant public or user-imported dataset rather than an undocumented platform dependency.

### Slice 3: Identity resolution review

Implement deterministic keys first:

- platform IDs
- verified URLs
- normalized domains
- normalized emails
- stable playlist or channel identifiers

Probabilistic matches must show reasons, confidence, conflicting fields, and rollback lineage.

### Slice 4: CRM promotion

Promotion should reuse existing `people`, `organizations`, `submission_endpoints`, `interactions`, and campaign flows. The graph remains the discovery and identity layer; the CRM remains the relationship operating layer.

## Explicit non-claims

This foundation does not yet provide:

- automated search across all platforms
- scraping of restricted sources
- contact-data enrichment
- audio fingerprint recognition
- automatic legitimacy conclusions
- automatic outreach
- autonomous campaign execution

Those features require approved sources, adapter implementations, production verification, and capability-runtime enforcement.
