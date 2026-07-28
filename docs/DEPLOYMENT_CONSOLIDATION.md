# ArtistOS Deployment Consolidation

Date: 2026-07-26

## Canonical direction

Use `middlechildmzk/artistos` as the canonical application repository and `artistos-next` as the candidate canonical Vercel project for preview validation.

Do not delete or detach older deployments until their domains, environment variables, data dependencies, and unique features have been compared.

## Current relevant Vercel projects

### Candidate canonical

- `artistos-next`
  - Project ID: `prj_7fmrmgPO4z3hWiC2qX4vxZVoXYBe`
  - Framework: Next.js
  - Latest deployment state observed: READY
  - Candidate role: canonical preview and eventual production project

### Legacy / comparison

- `aristos`
  - Project ID: `prj_p4H6ECpMwioHVPXNmQjRltbB0PUe`
  - Framework: Next.js
  - Latest deployment state observed: READY
  - Candidate role: compare, migrate missing functionality, then archive

### Product sources to absorb, not preserve as separate customer products

- `curatorfit` -> Campaign Intelligence
- `creator-music-prompts2` -> Creator Studio
- `stackbuilder-ai` and `localstackai` -> education, free tools, and SEO/GEO acquisition
- `sourcingos-unified` patterns -> private Network Intelligence
- `middle-child-experience` and `middle-child-never-alone` -> separate artist experience and proof assets

### Test/probe projects

- `aristos-upload-probe`
- `aristos-intelligence-test`
- `sonorly`

These must be inspected for unique code or integrations and then archived if fully superseded.

## Promotion gate

The canonical project should not be promoted publicly until all of the following pass:

- authenticated login and logout
- workspace isolation
- release create/read/update flow
- private storage upload and signed retrieval
- no production runtime error clusters
- required environment variables present in preview and production
- analytics events installed
- privacy policy, terms, consent, and deletion paths available

## Retirement method

For each non-canonical project:

1. Record repository and branch source.
2. Record domains and redirects.
3. Compare environment-variable names without exposing values.
4. Compare unique routes and integrations.
5. Migrate required features and data.
6. Preserve a tagged release or archive branch.
7. Remove production domains.
8. Archive or delete only after rollback is possible.