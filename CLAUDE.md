# ArtistOS Claude Rebuild

Read `docs/ARTISTOS_REBUILD_SPEC.md` before changing code.

## Mission
Build ArtistOS into a polished private release operating system that Dan Larson can use immediately for Middle Child and the July 31, 2026 release of “Never Alone (feat. lowly sunday).” Finish the real app, integrations, testing, and Vercel preview. Do not stop at a mockup or scaffold.

## Preserve
- Existing Supabase data, IDs, RLS, provenance, dedupe, imports, and rollback.
- 3,175 contactable fans and 421 authoritative suppressions.
- 5,648 industry contacts, 3,184 playlists/properties, 147 organizations, and existing campaign data.
- Private single-user MVP scope.

## Non-negotiable
- No demo data.
- No destructive database rebuild.
- No inferred emails, consent, contacts, or relationship claims.
- Never expose server secrets or service-role credentials in the browser.
- Never auto-send email. Sending requires an explicit user action and confirmation.
- Never contact suppressed fans.
- Replace the compressed bootstrap workflow with readable, materialized Next.js source in GitHub.

## Required product
- Today command center as the home screen.
- Never Alone release workspace, countdown, tasks, blockers, and follow-ups.
- Playlist/curator map, industry CRM, and suppression-safe fan CRM.
- Gmail OAuth, search/read, drafts, confirmed sending, and outreach logging.
- Spotify OAuth, token refresh, permitted metadata enrichment, and connection health.
- Content calendar, assets, outreach composer, global search, importer, and integration health.
- Audited AI assistance for prioritization and drafting without fabricated facts.

## Experience
Premium dark music-tech design with deep blue, violet, and restrained magenta accents. Make it fast, clear, responsive, accessible, and fun to use. Avoid generic admin-dashboard density.

## Delivery
1. Materialize and stabilize the strongest existing Next.js source.
2. Audit live data access and integrations.
3. Rebuild the shell and Today workflow.
4. Complete the release, CRM, playlist, fan, content, asset, email, and import workflows.
5. Verify auth, RLS, OAuth, token refresh, data writes, and suppression safety.
6. Pass lint, typecheck, tests, production build, and browser verification.
7. Deploy a working Vercel preview and open a documented PR.

Clearly document any external OAuth credential step that only Dan can complete.