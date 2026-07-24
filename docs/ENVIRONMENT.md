# ArtistOS environment reference

Configure values in Vercel separately for Preview and Production. Never commit actual values.

## Required for live data and sign-in

- `NEXT_PUBLIC_APP_URL`: canonical deployment origin for magic-link redirects.
- `NEXT_PUBLIC_SUPABASE_URL`: ArtistOS Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable browser-safe key. Never use the service-role key here.

## Gmail / Google OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`: `https://<deployment>/api/oauth/google/callback`
- `OAUTH_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as base64. Server-only.

Google Cloud must allow the exact preview and production callback URLs. The app requests OpenID identity, Gmail read-only, and Gmail compose scopes. Sending is a separate explicit confirmation action.

## Spotify OAuth

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`: `https://<deployment>/api/oauth/spotify/callback`
- `OAUTH_TOKEN_ENCRYPTION_KEY`: shared server-side token encryption key.

Spotify must allow the exact preview and production callback URLs.

## Audited AI

- `OPENAI_API_KEY`: server-only.
- `OPENAI_MODEL`: explicit model name, for example `gpt-5`.

AI output is stored as a draft audit record. It does not send mail or override risk and suppression controls.
