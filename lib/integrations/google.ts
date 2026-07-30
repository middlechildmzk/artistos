import "server-only";

export const GOOGLE_SOURCE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
] as const;

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
};

type YouTubeChannelResponse = {
  items?: Array<{
    id: string;
    snippet?: { title?: string; customUrl?: string; thumbnails?: Record<string, { url?: string }> };
    statistics?: {
      viewCount?: string;
      subscriberCount?: string;
      hiddenSubscriberCount?: boolean;
      videoCount?: string;
    };
  }>;
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string; message?: string }> };
};

type YouTubeAnalyticsResponse = {
  columnHeaders?: Array<{ name?: string }>;
  rows?: Array<Array<string | number>>;
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string; message?: string }> };
};

export class IntegrationApiError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options: { status?: number; code?: string; detail?: unknown } = {}) {
    super(message);
    this.name = "IntegrationApiError";
    this.status = options.status ?? 500;
    this.code = options.code ?? "integration_api_error";
    this.detail = options.detail;
  }
}

function googleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("missing_google_oauth_configuration");
  return { clientId, clientSecret };
}

export function artistOsPublicOrigin(requestOrigin?: string) {
  const configured = process.env.ARTISTOS_PUBLIC_ORIGIN?.trim();
  const candidate = configured || requestOrigin;
  if (!candidate) throw new Error("missing_artistos_public_origin");
  const url = new URL(candidate);
  const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("invalid_artistos_public_origin");
  }
  return url.origin;
}

export function googleOAuthRedirectUri(requestOrigin?: string) {
  return new URL("/api/integrations/google/callback", artistOsPublicOrigin(requestOrigin)).toString();
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function apiMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as {
    error?: string | { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    error_description?: string;
  };
  if (typeof value.error === "string") return value.error_description || value.error;
  return value.error?.message || value.error?.errors?.[0]?.message || fallback;
}

async function fetchGoogleJson<T>(url: string, init: RequestInit, code: string): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new IntegrationApiError(apiMessage(payload, `Google API request failed with ${response.status}`), {
      status: response.status,
      code,
      detail: payload,
    });
  }
  return payload as T;
}

export function buildGoogleAuthorizationUrl(origin: string, state: string) {
  const { clientId } = googleConfig();
  const redirectUri = googleOAuthRedirectUri(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SOURCE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(origin: string, code: string) {
  const { clientId, clientSecret } = googleConfig();
  const redirectUri = googleOAuthRedirectUri(origin);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const token = await fetchGoogleJson<GoogleTokenResponse>(
    "https://oauth2.googleapis.com/token",
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    "google_code_exchange_failed",
  );
  if (!token.access_token) throw new IntegrationApiError("Google returned no access token", { code: "google_access_token_missing" });
  return token;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const token = await fetchGoogleJson<GoogleTokenResponse>(
    "https://oauth2.googleapis.com/token",
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    "google_token_refresh_failed",
  );
  if (!token.access_token) throw new IntegrationApiError("Google returned no refreshed access token", { code: "google_access_token_missing" });
  return token;
}

export async function getGoogleUserInfo(accessToken: string) {
  return fetchGoogleJson<GoogleUserInfo>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { authorization: `Bearer ${accessToken}` } },
    "google_userinfo_failed",
  );
}

export async function getYouTubeChannel(accessToken: string) {
  const response = await fetchGoogleJson<YouTubeChannelResponse>(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&mine=true",
    { headers: { authorization: `Bearer ${accessToken}` } },
    "youtube_channel_sync_failed",
  );
  const channel = response.items?.[0];
  if (!channel) throw new IntegrationApiError("No YouTube channel is attached to this Google account", { code: "youtube_channel_not_found", status: 404 });
  return channel;
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getYouTubeAnalyticsSummary(accessToken: string, days = 28) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(days - 1, 0));
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: dateString(start),
    endDate: dateString(end),
    metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
  });
  const response = await fetchGoogleJson<YouTubeAnalyticsResponse>(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
    "youtube_analytics_sync_failed",
  );
  const headers = response.columnHeaders?.map((header) => header.name).filter(Boolean) as string[] | undefined;
  const row = response.rows?.[0] ?? [];
  const values: Record<string, number> = {};
  headers?.forEach((name, index) => {
    const value = Number(row[index]);
    if (Number.isFinite(value)) values[name] = value;
  });
  return { startDate: dateString(start), endDate: dateString(end), values };
}
