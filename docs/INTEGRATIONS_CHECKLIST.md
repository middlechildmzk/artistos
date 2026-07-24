# ArtistOS Integrations Checklist

Use this document to distinguish what is actually connected from what only exists in code or UI.

## Status language

Every integration must show one of:

- **Connected:** authenticated and a real test request succeeded.
- **Needs action:** code exists, but credentials, consent, redirect URL, or account authorization is missing.
- **Degraded:** connected, but an endpoint or permission is unavailable; the app explains the limitation.
- **Failed:** a recent request failed and the user can retry or reconnect.
- **Manual:** no reliable supported API is used; ArtistOS stores verified links and workflow instructions.

Never label an integration connected merely because environment variables exist.

## Supabase

Required:

- Authenticated session handling.
- Publishable client key only in browser code.
- Service-role key server-side only, and only where genuinely required.
- RLS verified for every exposed table/view.
- Environment validation at startup/build.
- Health check that confirms auth and a safe read query.
- Clear handling for expired sessions and failed writes.
- Database migrations committed and documented.

Production data must not be reset or replaced.

## Gmail / Google OAuth

Gmail is not currently considered complete inside ArtistOS. Build a proper app-side OAuth integration.

Required setup:

- Google Cloud OAuth client.
- Authorized redirect URI for preview and production.
- Server-side state/PKCE and CSRF protection.
- Encrypted server-side refresh-token storage.
- Least-privilege Gmail scopes.
- Connect, reconnect, and disconnect controls.
- Connection health and last successful sync.

Required release-week workflow:

1. Search/read relevant email threads.
2. Create a Gmail draft from an ArtistOS target and template.
3. Explicitly confirm before sending.
4. Log the draft/send as an interaction.
5. Associate the interaction with release, campaign, organization, person, and playlist/property where known.
6. Detect and block any fan send containing suppressed addresses.
7. Avoid hidden auto-follow-ups and accidental bulk sending.

Store message IDs/thread IDs needed for synchronization, but do not copy unnecessary mailbox content into the database.

Suggested server-only environment names:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Use an environment reference document without committing values.

## Spotify

Required setup:

- Spotify developer application.
- Preview and production redirect URIs.
- Secure authorization code flow and refresh.
- Server-side token storage.
- Connect/reconnect/disconnect controls.

Required behavior:

- Verify Middle Child artist identity.
- Fetch only currently permitted artist, release, track, and playlist metadata.
- Enrich existing ArtistOS properties without replacing curated data.
- Store source, retrieval timestamp, and field-level confidence/status where practical.
- Gracefully show unavailable data rather than inventing or substituting values.
- Never imply playlist owner contact information is available unless it is actually recorded and sourced.

Suggested server-only environment names:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`

## AI provider / AI Gateway

Required:

- Server-side provider credentials.
- Model configuration with sensible timeout and failure states.
- Auditing in `ai_generations`.
- Input facts tied to real release/contact/target records.
- No secret or full sensitive dataset sent unnecessarily.
- No fabricated contact details, history, metrics, or guarantees.
- User review before any generated content becomes a Gmail draft or send.

Suggested environment names depend on the selected provider, but the app should support a single explicit provider configuration rather than hidden fallback behavior.

## Vercel

Required:

- Normal branch preview deployments from readable source.
- Production alias remains on the old working app until acceptance passes.
- Environment variables configured separately for Preview and Production.
- Build logs and runtime errors are actionable.
- Health/status page does not expose secrets.
- No deployment should depend on compressed source reconstruction.

## DistroKid / HyperFollow

Treat as a **Manual** integration unless a safe supported API is intentionally added.

Store and surface:

- DistroKid dashboard/release links.
- HyperFollow pre-save/smart link.
- release date, UPC, label, distributor, and store delivery status.
- manual checklist items and verified timestamps.

Do not scrape private dashboards or claim delivery status without evidence.

## Social platforms

For Instagram, Facebook, TikTok, YouTube, X, and similar platforms:

- Start with content calendar, asset/copy storage, publishing checklist, and verified post URLs.
- Add direct publishing only when credentials, platform approval, scopes, and safe user confirmation are in place.
- Never pretend scheduling or publishing succeeded without a confirmed platform response.

## Integration-health acceptance test

The final Integrations screen must display:

- service name
- status
- connected account identity where permitted
- scopes/capabilities granted
- last successful request
- last error in safe language
- reconnect/test button
- missing configuration instructions

Run and document a real test for Supabase, Gmail, Spotify, and AI before marking the rebuild complete.