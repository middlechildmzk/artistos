# ArtistOS

ArtistOS is the private, live-data release operating system for Middle Child. This rebuild is centered on **Never Alone (feat. lowly sunday)**, releasing July 31, 2026 through DistroKid / BVSS FVM (UPC 882877618355).

## What is materialized in this branch

- Readable Next.js App Router source. No compressed bootstrap or runtime source reconstruction.
- Supabase authentication and protected routes.
- Today command center with deterministic, explainable task and target ranking.
- Release workspace, playlist/property map, industry CRM, suppression-safe fan CRM, outreach log, assets, import history, global search, content runbook, and integration health.
- Gmail OAuth with PKCE/state protection, encrypted server-side token storage, exact suppression checks before draft creation, explicit send confirmation, and interaction logging.
- Spotify OAuth with token refresh and a real identity health check.
- Audited AI generation grounded in saved release/task facts.
- Applied additive migrations for OAuth connections, content items, least-privilege grants, safe indexes, and AI audit-policy hardening.
- A committed npm lockfile with pinned PostCSS and Sharp overrides.

## Local setup

1. Install Node.js 24.
2. Copy `.env.example` to `.env.local` and add the Preview values described in `docs/ENVIRONMENT.md`.
3. Run `npm ci`.
4. Run `npm run dev`.
5. Open the local URL, sign in with the authorized ArtistOS email, and verify the live counts.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

The preview deployment workflow runs the complete validation command and audits production dependencies before deploying. Development-only audit findings must be reviewed separately and must not be represented as cleared without a fresh locked audit.

## Data safety

- The application renders real authenticated Supabase records; it does not ship demo rows.
- Existing production tables were not reset, replaced, truncated, deleted, or backfilled.
- The applied ArtistOS migrations created and hardened `oauth_connections` and `content_items`, enabled owner-scoped RLS, and added safe indexes.
- Rollback-safe RLS tests confirmed owner writes work and cross-owner writes are blocked.
- OAuth tokens are AES-256-GCM encrypted with a server-only key.
- Gmail draft creation checks the authoritative `suppressions` table by exact normalized email before contacting Gmail.
- No automated bulk sending exists. Sending a saved draft requires a separate request with explicit `SEND` confirmation.
- The current production Vercel alias has not been replaced.

## Preview-to-production promotion

1. Keep the pull request in draft until provider integrations are verified.
2. Configure Preview environment variables in Vercel.
3. Connect the GitHub repository to the existing Vercel project and verify a native branch preview.
4. Connect Gmail and Spotify using the exact preview callback URLs.
5. Create a real Gmail draft to a safe test recipient, then verify the interaction log. Do not send until reviewed.
6. Run the Spotify identity health check and one grounded AI test.
7. Run desktop and mobile browser verification and capture screenshots.
8. Promote the verified preview only after all acceptance criteria pass. Do not replace the current production alias earlier.
9. Return the repository to private after native GitHub/Vercel deployment is working.

## Known external steps

Google, Spotify, Vercel, and OpenAI credentials cannot be invented or committed. OAuth consent, callback registration, provider secrets, and native Vercel Git connection must be completed in their respective dashboards. The current production deployment must remain untouched until preview verification is complete.
