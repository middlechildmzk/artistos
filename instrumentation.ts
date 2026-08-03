import "server-only";

/**
 * Preserve compatibility with the original ArtistOS Google OAuth variable names.
 * New deployments should prefer GOOGLE_OAUTH_CLIENT_ID and
 * GOOGLE_OAUTH_CLIENT_SECRET, but existing encrypted Vercel configuration may
 * still use GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
 */
export async function register() {
  process.env.GOOGLE_OAUTH_CLIENT_ID ??= process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= process.env.GOOGLE_CLIENT_SECRET;
}
