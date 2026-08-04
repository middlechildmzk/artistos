# Network Intelligence Ingestion Policy V1

## Scope

This policy governs research sources, public business contacts, submission routes, APIs, marketplaces, licensed datasets, and import candidates used by ArtistOS Network Intelligence.

## Non-negotiable rules

1. A public email or form is evidence of a business route, not consent for automated outreach.
2. Fan consent and industry-contact status remain separate.
3. Suppression is authoritative and is rechecked immediately before every consequential action.
4. No name-only automatic matching. Prefer stable IDs, canonical URLs, verified domains, official company IDs, and reviewable merges.
5. Source classes remain visible: owned, imported, public, licensed, manual, inferred, official API, open dataset, marketplace, and historical.
6. No scraping behind login walls, CAPTCHA, protected email reveals, anti-bot controls, or paid access.
7. Marketplaces remain external handoffs unless a written integration agreement exists.
8. APIs require documented eligibility, scopes, authentication, rate limits, retention, attribution, correction, deletion, and commercial rights.
9. Research-only APIs are rejected when ArtistOS is ineligible or the use is incompatible.
10. No-unsolicited and closed routes are non-actionable. General contact channels cannot be used to bypass the policy.
11. Released tracks cannot be routed into unreleased-only demo or label portals.
12. Existing canonical records are enriched; research reports never authorize duplicate creation.
13. Raw contact exports, public emails, and licensed rows are not committed to the public repository.
14. Production imports require provenance, workspace scope, deduplication, current verification, terms review, rollback support, and explicit approval.
15. Sending, publishing, spending, deletion, rights changes, and production rollout remain human-approved actions.

## Disposition vocabulary

- `accept_verified_source`
- `accept_verified_route`
- `verify_official_source`
- `verify_official_route`
- `existing_record_review`
- `external_handoff`
- `partnership_required`
- `license_review`
- `quarantine_identity`
- `quarantine_policy`
- `reject_ineligible`
- `reject_no_unsolicited`

## Required evidence before import

- Canonical entity or source identity
- Current first-party URL
- Source and acquisition class
- Observation date and freshness
- Stable identifier where available
- Current submission/contact policy
- Released/unreleased and territory eligibility
- Pricing and rights terms
- Duplicate candidates and reviewed resolution
- Workspace and provenance fields
- Rollback path
- Human reviewer decision
