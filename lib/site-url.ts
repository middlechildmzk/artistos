const PLACEHOLDER_HOSTS = [
  "your-preview-domain.vercel.app",
  "example.com",
  "localhost",
];

function normalizeUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (PLACEHOLDER_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return null;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Canonical origin for public ArtistOS acquisition pages.
 *
 * NEXT_PUBLIC_SITE_URL wins only when it is a real configured host. Preview
 * deployments fall back to the stable branch URL so metadata never points at
 * a placeholder. Production deployments prefer Vercel's production URL.
 */
export function getSiteUrl() {
  const configured = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  const isProduction = process.env.VERCEL_ENV === "production";
  const vercelHost = isProduction
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;

  return normalizeUrl(vercelHost) || "https://artistos-next-git-main-middlechildmzks-projects.vercel.app";
}
