# ArtistOS Links and Insights v1 verification

This document records the deployment verification boundary for PR 48.

- Canonical route: `/insights`
- Public-link route under test: `/l/middle-child-never-alone`
- Required server runtime variable: `SUPABASE_SERVICE_ROLE_KEY`
- Preview and production must be verified separately.
- A successful build does not prove public-link runtime access.
- Public-link verification requires page rendering, tracked destination redirect, event receipt, consent receipt, idempotency, and audit evidence.

This commit intentionally changes documentation only so Vercel Git integration creates a fresh preview after environment configuration.
