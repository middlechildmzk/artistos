const DEFAULT_PUBLIC_SITE_URL = "https://artistos-next.vercel.app";

const PLACEHOLDER_HOST_MARKERS = [
  "your-preview-domain",
  "your-domain",
  "example.com",
  "localhost",
];

export function normalizePublicSiteUrl(candidate?: string | null) {
  const value = candidate?.trim();
  if (!value) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    const hostname = parsed.hostname.toLowerCase();
    if (PLACEHOLDER_HOST_MARKERS.some((marker) => hostname.includes(marker))) return null;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getPublicSiteUrl() {
  return normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
    ?? normalizePublicSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? DEFAULT_PUBLIC_SITE_URL;
}
