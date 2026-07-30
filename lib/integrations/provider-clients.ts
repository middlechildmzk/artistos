import "server-only";

export class ProviderApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "ProviderApiError";
    this.status = options.status ?? 500;
    this.code = options.code ?? "provider_api_error";
  }
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
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

function providerMessage(payload: unknown, fallback: string) {
  const object = asObject(payload);
  const errors = object.errors;
  if (Array.isArray(errors) && typeof errors[0] === "string") return errors[0];
  if (typeof object.message === "string") return object.message;
  const error = asObject(object.error);
  if (typeof error.message === "string") return error.message;
  if (typeof object.error_description === "string") return object.error_description;
  return fallback;
}

async function fetchJson(url: string, init: RequestInit, code: string) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ProviderApiError(providerMessage(payload, `${code}:${response.status}`), {
      status: response.status,
      code,
    });
  }
  return payload;
}

export async function requestSoundchartsAccessToken(args: {
  clientId: string;
  clientSecret: string;
  teamId?: string | null;
}) {
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (args.teamId?.trim()) body.set("team_id", args.teamId.trim());
  const credentials = Buffer.from(`${args.clientId}:${args.clientSecret}`).toString("base64");
  const payload = asObject(await fetchJson(
    "https://account.soundcharts.com/oauth/token",
    {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
    "soundcharts_token_failed",
  ));
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  if (!accessToken) throw new ProviderApiError("Soundcharts returned no access token", { code: "soundcharts_access_token_missing" });
  return {
    accessToken,
    expiresIn: Number(payload.expires_in ?? 3600),
    tokenType: typeof payload.token_type === "string" ? payload.token_type : "bearer",
  };
}

export async function soundchartsGet(path: string, accessToken: string) {
  return fetchJson(`https://customer.api.soundcharts.com${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  }, "soundcharts_request_failed");
}

function findStringByKey(value: unknown, keys: Set<string>): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys);
      if (found) return found;
    }
    return null;
  }
  const object = asObject(value);
  for (const [key, child] of Object.entries(object)) {
    if (keys.has(key) && typeof child === "string" && child.trim()) return child;
  }
  for (const child of Object.values(object)) {
    const found = findStringByKey(child, keys);
    if (found) return found;
  }
  return null;
}

export async function resolveSoundchartsArtistBySpotifyId(accessToken: string, spotifyArtistId: string) {
  const payload = await soundchartsGet(`/api/v2.9/artist/by-platform/spotify/${encodeURIComponent(spotifyArtistId)}`, accessToken);
  const uuid = findStringByKey(payload, new Set(["uuid", "artistUuid", "artist_uuid"]));
  if (!uuid) throw new ProviderApiError("Soundcharts artist UUID was not present in the response", { code: "soundcharts_artist_uuid_missing" });
  return { uuid, payload };
}

type NumericObservation = { date: string | null; value: number; key: string };

function dateValue(object: JsonObject) {
  for (const key of ["date", "timestamp", "period", "valueDate", "value_date", "createdAt", "created_at"]) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function collectNumericObservations(value: unknown, output: NumericObservation[] = []): NumericObservation[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNumericObservations(item, output));
    return output;
  }
  const object = asObject(value);
  const date = dateValue(object);
  for (const [key, child] of Object.entries(object)) {
    if (typeof child === "number" && Number.isFinite(child) && [
      "value", "count", "followerCount", "followers", "listenerCount", "listeners",
      "monthlyListeners", "monthly_listeners", "viewCount", "views", "subscriberCount", "subscribers",
    ].includes(key)) {
      output.push({ date, value: child, key });
    }
  }
  Object.values(object).forEach((child) => collectNumericObservations(child, output));
  return output;
}

export function latestNumericObservation(payload: unknown) {
  const observations = collectNumericObservations(payload);
  observations.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
  return observations[0] ?? null;
}

function largestArrayLength(value: unknown): number {
  if (Array.isArray(value)) return Math.max(value.length, ...value.map(largestArrayLength));
  const object = asObject(value);
  const values = Object.values(object);
  if (!values.length) return 0;
  return Math.max(0, ...values.map(largestArrayLength));
}

export function collectionSize(payload: unknown) {
  const object = asObject(payload);
  for (const key of ["items", "entries", "data", "results", "playlists", "tracks"]) {
    if (Array.isArray(object[key])) return object[key].length;
  }
  return largestArrayLength(payload);
}

export async function kitGet(path: string, apiKey: string) {
  return fetchJson(`https://api.kit.com${path}`, {
    headers: { "X-Kit-Api-Key": apiKey },
  }, "kit_request_failed");
}

function queryString(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

function totalCount(payload: unknown) {
  const object = asObject(payload);
  const pagination = asObject(object.pagination);
  const value = Number(pagination.total_count ?? object.total_count);
  if (Number.isFinite(value)) return value;
  for (const key of ["subscribers", "broadcasts", "items"]) {
    if (Array.isArray(object[key])) return object[key].length;
  }
  return 0;
}

export async function validateKitApiKey(apiKey: string) {
  const payload = await kitGet(`/v4/subscribers?${queryString({ per_page: 1, slim: true, include_total_count: true })}`, apiKey);
  return { activeSubscribers: totalCount(payload) };
}

export async function fetchKitAggregateMetrics(apiKey: string) {
  const subscriberStatuses = ["active", "inactive", "bounced", "complained", "cancelled"] as const;
  const counts: Record<string, number> = {};
  for (const status of subscriberStatuses) {
    const payload = await kitGet(`/v4/subscribers?${queryString({ status, per_page: 1, slim: true, include_total_count: true })}`, apiKey);
    counts[status] = totalCount(payload);
  }

  const broadcastsPayload = asObject(await kitGet(`/v4/broadcasts/stats?${queryString({ per_page: 1000, include_total_count: true })}`, apiKey));
  const broadcasts = Array.isArray(broadcastsPayload.broadcasts) ? broadcastsPayload.broadcasts.map(asObject) : [];
  let recipients = 0;
  let emailsOpened = 0;
  let totalClicks = 0;
  let unsubscribes = 0;
  let completed = 0;
  for (const broadcast of broadcasts) {
    const stats = asObject(broadcast.stats);
    recipients += Number(stats.recipients ?? 0) || 0;
    emailsOpened += Number(stats.emails_opened ?? 0) || 0;
    totalClicks += Number(stats.total_clicks ?? 0) || 0;
    unsubscribes += Number(stats.unsubscribes ?? 0) || 0;
    if (stats.status === "completed") completed += 1;
  }

  return {
    activeSubscribers: counts.active ?? 0,
    inactiveSubscribers: counts.inactive ?? 0,
    bouncedSubscribers: counts.bounced ?? 0,
    complainedSubscribers: counts.complained ?? 0,
    cancelledSubscribers: counts.cancelled ?? 0,
    totalSubscribers: Object.values(counts).reduce((sum, value) => sum + value, 0),
    broadcastsReturned: broadcasts.length,
    broadcastsTotal: totalCount(broadcastsPayload),
    completedBroadcasts: completed,
    recipients,
    emailsOpened,
    totalClicks,
    unsubscribes,
    openRate: recipients > 0 ? (emailsOpened / recipients) * 100 : 0,
    clickRate: recipients > 0 ? (totalClicks / recipients) * 100 : 0,
  };
}
