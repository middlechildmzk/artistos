import "server-only";

import { createHash } from "node:crypto";
import {
  ProviderApiError,
  requestSoundchartsAccessToken,
  soundchartsGet,
} from "@/lib/integrations/provider-clients";

const ORIGIN = "https://customer.api.soundcharts.com";
const MAX_ROWS = 100;
const CHART_PLATFORMS = ["spotify", "apple-music", "shazam", "youtube"] as const;

type JsonObject = Record<string, unknown>;

type EndpointDefinition = {
  name: string;
  path: string;
  kind: "metadata" | "metrics" | "playlists" | "radio" | "chart" | "usage";
  platform?: string;
};

export type SoundchartsEndpointResult = {
  name: string;
  path: string;
  status: "available" | "unavailable" | "failed";
  responseCount: number;
  errorCode: string | null;
  httpStatus: number | null;
};

export type SoundchartsPlaylistObservation = {
  providerRecordId: string;
  externalPlaylistId: string | null;
  playlistName: string;
  playlistUrl: string | null;
  ownerName: string | null;
  ownerUrl: string | null;
  followers: number | null;
  position: number | null;
  entryDate: string | null;
  positionDate: string | null;
  removedAt: string | null;
  territory: string | null;
  platform: "spotify";
  sourceUrl: string;
};

export type SoundchartsRadioObservation = {
  providerRecordId: string;
  stationSlug: string | null;
  stationName: string;
  stationUrl: string | null;
  airedAt: string;
  territory: string | null;
  sourceUrl: string;
};

export type SoundchartsChartObservation = {
  providerRecordId: string;
  chartSlug: string | null;
  chartName: string;
  chartUrl: string | null;
  platform: string;
  position: number;
  previousPosition: number | null;
  entryDate: string | null;
  rankDate: string | null;
  territory: string | null;
  sourceUrl: string;
};

export type SoundchartsMetricObservation = {
  metric: string;
  value: number;
  observedOn: string;
  sourceUrl: string;
};

export type SoundchartsReleasePilotResult = {
  provider: "soundcharts";
  environment: "production_api";
  isrc: string;
  soundchartsUuid: string;
  checkedAt: string;
  rawPayloadStored: false;
  playlistObservations: SoundchartsPlaylistObservation[];
  radioObservations: SoundchartsRadioObservation[];
  chartObservations: SoundchartsChartObservation[];
  metricObservations: SoundchartsMetricObservation[];
  usage: Record<string, number>;
  endpoints: SoundchartsEndpointResult[];
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(object: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numberValue(object: JsonObject, keys: string[]): number | null {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function childObject(object: JsonObject, keys: string[]): JsonObject {
  for (const key of keys) {
    const child = objectValue(object[key]);
    if (Object.keys(child).length) return child;
  }
  return {};
}

function walkObjects(value: unknown, output: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, output);
    return output;
  }
  const object = objectValue(value);
  if (!Object.keys(object).length) return output;
  output.push(object);
  for (const child of Object.values(object)) walkObjects(child, output);
  return output;
}

function deepString(object: JsonObject, keys: string[]): string | null {
  const direct = stringValue(object, keys);
  if (direct) return direct;
  for (const child of Object.values(object)) {
    if (!child || typeof child !== "object") continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        const found: string | null = deepString(objectValue(item), keys);
        if (found) return found;
      }
    } else {
      const found: string | null = deepString(objectValue(child), keys);
      if (found) return found;
    }
  }
  return null;
}

function stringsForKeys(value: unknown, keys: Set<string>, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) stringsForKeys(item, keys, output);
    return output;
  }
  const object = objectValue(value);
  for (const [key, child] of Object.entries(object)) {
    if (keys.has(key) && typeof child === "string" && child.trim()) output.push(child.trim());
    if (child && typeof child === "object") stringsForKeys(child, keys, output);
  }
  return output;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hashId(parts: Array<string | number | null | undefined>): string {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex");
}

function apiUrl(path: string): string {
  return `${ORIGIN}${path}`;
}

function metricName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 120);
}

function collectNumbers(value: unknown, prefix = "", output: Map<string, number> = new Map()): Map<string, number> {
  if (Array.isArray(value)) return output;
  const object = objectValue(value);
  for (const [key, child] of Object.entries(object)) {
    const path = prefix ? `${prefix}_${key}` : key;
    if (typeof child === "number" && Number.isFinite(child)) {
      const normalized = metricName(path);
      if (normalized && !output.has(normalized)) output.set(normalized, child);
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      collectNumbers(child, path, output);
    }
    if (output.size >= 40) break;
  }
  return output;
}

function markedRows(payload: unknown, markers: string[]): JsonObject[] {
  return walkObjects(payload)
    .filter((row) => markers.some((marker) => marker in row))
    .slice(0, MAX_ROWS);
}

function songUuid(payload: unknown, requestedIsrc: string): string {
  const root = objectValue(payload);
  const containers = [root, objectValue(root.object), objectValue(root.data), objectValue(root.song)];
  let uuid: string | null = null;
  for (const container of containers) {
    uuid = stringValue(container, ["uuid", "songUuid", "song_uuid"]);
    if (uuid) break;
  }
  uuid ??= deepString(root, ["songUuid", "song_uuid", "uuid"]);
  if (!uuid) throw new ProviderApiError("Soundcharts song UUID was not present in the ISRC response", { code: "soundcharts_song_uuid_missing" });

  const expected = requestedIsrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const returned = stringsForKeys(payload, new Set(["isrc", "isrcCode", "isrc_code"]))
    .map((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
  if (returned.length && !returned.includes(expected)) {
    throw new ProviderApiError("Soundcharts returned a recording with a different ISRC", { code: "soundcharts_isrc_mismatch" });
  }
  return uuid;
}

function playlistRows(payload: unknown, path: string): SoundchartsPlaylistObservation[] {
  const output = new Map<string, SoundchartsPlaylistObservation>();
  for (const row of markedRows(payload, ["position", "entryDate", "positionDate", "subscriberCount", "playlistName"])) {
    const playlist = childObject(row, ["playlist", "resource", "object"]);
    const name = stringValue(playlist, ["name", "title", "playlistName"])
      ?? stringValue(row, ["playlistName", "name", "title"]);
    if (!name) continue;
    const externalId = stringValue(playlist, ["uuid", "id", "slug", "identifier", "playlistId"])
      ?? stringValue(row, ["playlistUuid", "playlistId", "playlist_id"]);
    const url = safeUrl(stringValue(playlist, ["url", "externalUrl", "spotifyUrl"])
      ?? stringValue(row, ["playlistUrl", "url"]));
    const entryDate = isoDate(stringValue(row, ["entryDate", "entry_date", "addedAt", "added_at"]));
    const positionDate = isoDate(stringValue(row, ["positionDate", "position_date", "rankDate", "updatedAt"]));
    const position = numberValue(row, ["position", "rank"]);
    const removedAt = isoDate(stringValue(row, ["exitDate", "exit_date", "removedAt", "removed_at"]))
      ?? (position === 0 ? positionDate : null);
    const providerRecordId = stringValue(row, ["id", "uuid", "entryId", "positionId"])
      ?? hashId([externalId, url, name, entryDate, positionDate, position]);
    const owner = childObject(playlist, ["owner", "curator"]);
    output.set(providerRecordId, {
      providerRecordId,
      externalPlaylistId: externalId,
      playlistName: name,
      playlistUrl: url,
      ownerName: stringValue(owner, ["name", "displayName"]) ?? stringValue(row, ["ownerName", "curatorName"]),
      ownerUrl: safeUrl(stringValue(owner, ["url", "externalUrl"]) ?? stringValue(row, ["ownerUrl"])),
      followers: numberValue(row, ["subscriberCount", "followers", "followerCount"])
        ?? numberValue(playlist, ["subscriberCount", "followers", "followerCount"]),
      position,
      entryDate,
      positionDate,
      removedAt,
      territory: stringValue(row, ["countryCode", "country_code", "country"]),
      platform: "spotify",
      sourceUrl: apiUrl(path),
    });
  }
  return [...output.values()].slice(0, MAX_ROWS);
}

function radioRows(payload: unknown, path: string): SoundchartsRadioObservation[] {
  const output = new Map<string, SoundchartsRadioObservation>();
  for (const row of markedRows(payload, ["airedAt", "aired_at", "broadcastAt", "radioSlug"])) {
    const airedAt = isoDate(stringValue(row, ["airedAt", "aired_at", "broadcastAt", "timestamp", "date"]));
    if (!airedAt) continue;
    const radio = childObject(row, ["radio", "station", "resource"]);
    const slug = stringValue(radio, ["slug", "id", "uuid"])
      ?? stringValue(row, ["radioSlug", "stationSlug", "radioId"]);
    const name = stringValue(radio, ["name", "title"])
      ?? stringValue(row, ["radioName", "stationName", "name"])
      ?? slug
      ?? "Unknown station";
    const providerRecordId = stringValue(row, ["id", "uuid", "broadcastId"])
      ?? hashId([slug, name, airedAt]);
    output.set(providerRecordId, {
      providerRecordId,
      stationSlug: slug,
      stationName: name,
      stationUrl: safeUrl(stringValue(radio, ["url", "website", "externalUrl"]) ?? stringValue(row, ["radioUrl", "stationUrl"])),
      airedAt,
      territory: stringValue(row, ["countryCode", "country_code", "country"])
        ?? stringValue(radio, ["countryCode", "country_code", "country"]),
      sourceUrl: apiUrl(path),
    });
  }
  return [...output.values()].slice(0, MAX_ROWS);
}

function chartRows(payload: unknown, path: string, platform: string): SoundchartsChartObservation[] {
  const output = new Map<string, SoundchartsChartObservation>();
  for (const row of markedRows(payload, ["position", "rankDate", "entryDate", "oldPosition", "chartSlug"])) {
    const position = numberValue(row, ["position", "rank"]);
    if (position === null) continue;
    const chart = childObject(row, ["chart", "resource", "object"]);
    const slug = stringValue(chart, ["slug", "id", "uuid"])
      ?? stringValue(row, ["chartSlug", "chartId", "chart_id"]);
    const name = stringValue(chart, ["name", "title"])
      ?? stringValue(row, ["chartName", "name", "title"])
      ?? slug
      ?? `${platform} chart`;
    const rankDate = isoDate(stringValue(row, ["rankDate", "rank_date", "positionDate", "date"]));
    const entryDate = isoDate(stringValue(row, ["entryDate", "entry_date"]));
    const providerRecordId = stringValue(row, ["id", "uuid", "rankId"])
      ?? hashId([platform, slug, name, entryDate, rankDate, position]);
    output.set(providerRecordId, {
      providerRecordId,
      chartSlug: slug,
      chartName: name,
      chartUrl: safeUrl(stringValue(chart, ["url", "externalUrl"]) ?? stringValue(row, ["chartUrl"])),
      platform,
      position,
      previousPosition: numberValue(row, ["oldPosition", "previousPosition", "previous_position"]),
      entryDate,
      rankDate,
      territory: stringValue(row, ["countryCode", "country_code", "country"])
        ?? stringValue(chart, ["countryCode", "country_code", "country"]),
      sourceUrl: apiUrl(path),
    });
  }
  return [...output.values()].slice(0, MAX_ROWS);
}

function endpointFailure(definition: EndpointDefinition, reason: unknown): SoundchartsEndpointResult {
  const providerError = reason instanceof ProviderApiError ? reason : null;
  const status = providerError?.status ?? null;
  return {
    name: definition.name,
    path: definition.path,
    status: status === 403 || status === 404 ? "unavailable" : "failed",
    responseCount: 0,
    errorCode: providerError?.code ?? (reason instanceof Error ? reason.message : "endpoint_failed"),
    httpStatus: status,
  };
}

function startDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function runSoundchartsReleasePilot(args: {
  clientId: string;
  clientSecret: string;
  teamId?: string | null;
  isrc: string;
  releaseDate?: string | null;
}): Promise<SoundchartsReleasePilotResult> {
  const isrc = args.isrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(isrc)) throw new Error("release_isrc_invalid");

  const token = await requestSoundchartsAccessToken({
    clientId: args.clientId,
    clientSecret: args.clientSecret,
    teamId: args.teamId,
  });
  const resolutionPath = `/api/v2.25/song/by-isrc/${encodeURIComponent(isrc)}`;
  const resolution = await soundchartsGet(resolutionPath, token.accessToken);
  const uuid = songUuid(resolution, isrc);
  const releaseStart = startDate(args.releaseDate);

  const endpoints: EndpointDefinition[] = [
    { name: "identifiers", path: `/api/v2/song/${uuid}/identifiers`, kind: "metadata" },
    { name: "current_stats", path: `/api/v2/song/${uuid}/current/stats`, kind: "metrics" },
    { name: "spotify_playlist_entries", path: `/api/v2.20/song/${uuid}/playlist/current/spotify?currentOnly=0&limit=100&sortBy=entryDate&sortOrder=desc`, kind: "playlists" },
    { name: "spotify_playlist_reach", path: `/api/v2/song/${uuid}/playlist/reach/spotify`, kind: "metrics" },
    { name: "radio_spins", path: `/api/v2/song/${uuid}/broadcasts?${new URLSearchParams({ ...(releaseStart ? { startDate: releaseStart } : {}), limit: "100", sort: "desc" })}`, kind: "radio" },
    { name: "radio_spin_counts", path: `/api/v2/song/${uuid}/broadcast-groups?${new URLSearchParams({ ...(releaseStart ? { startDate: releaseStart } : {}), limit: "100" })}`, kind: "metrics" },
    ...CHART_PLATFORMS.map((platform): EndpointDefinition => ({
      name: `chart_${platform}`,
      path: `/api/v2/song/${uuid}/charts/ranks/${platform}?currentOnly=0&limit=100&sortBy=rankDate&sortOrder=desc`,
      kind: "chart",
      platform,
    })),
    { name: "team_usage", path: "/api/v2/team/usage", kind: "usage" },
  ];

  const responses = await Promise.allSettled(endpoints.map(async (endpoint) => ({
    endpoint,
    payload: await soundchartsGet(endpoint.path, token.accessToken),
  })));
  const playlistObservations: SoundchartsPlaylistObservation[] = [];
  const radioObservations: SoundchartsRadioObservation[] = [];
  const chartObservations: SoundchartsChartObservation[] = [];
  const metricObservations: SoundchartsMetricObservation[] = [];
  const usage: Record<string, number> = {};
  const endpointResults: SoundchartsEndpointResult[] = [{
    name: "resolve_by_isrc",
    path: resolutionPath,
    status: "available",
    responseCount: 1,
    errorCode: null,
    httpStatus: 200,
  }];
  const observedOn = new Date().toISOString().slice(0, 10);

  for (let index = 0; index < responses.length; index += 1) {
    const response = responses[index];
    const endpoint = endpoints[index];
    if (response.status === "rejected") {
      endpointResults.push(endpointFailure(endpoint, response.reason));
      continue;
    }

    let responseCount = 0;
    if (endpoint.kind === "playlists") {
      const rows = playlistRows(response.value.payload, endpoint.path);
      playlistObservations.push(...rows);
      responseCount = rows.length;
    } else if (endpoint.kind === "radio") {
      const rows = radioRows(response.value.payload, endpoint.path);
      radioObservations.push(...rows);
      responseCount = rows.length;
    } else if (endpoint.kind === "chart") {
      const rows = chartRows(response.value.payload, endpoint.path, endpoint.platform ?? "unknown");
      chartObservations.push(...rows);
      responseCount = rows.length;
    } else if (endpoint.kind === "metrics") {
      const values = collectNumbers(response.value.payload);
      for (const [name, value] of values) {
        metricObservations.push({
          metric: `${metricName(endpoint.name)}_${name}`.slice(0, 120),
          value,
          observedOn,
          sourceUrl: apiUrl(endpoint.path),
        });
      }
      responseCount = values.size;
    } else if (endpoint.kind === "usage") {
      const values = collectNumbers(response.value.payload);
      for (const [name, value] of values) usage[name] = value;
      responseCount = values.size;
    } else {
      responseCount = 1;
    }

    endpointResults.push({
      name: endpoint.name,
      path: endpoint.path,
      status: "available",
      responseCount,
      errorCode: null,
      httpStatus: 200,
    });
  }

  return {
    provider: "soundcharts",
    environment: "production_api",
    isrc,
    soundchartsUuid: uuid,
    checkedAt: new Date().toISOString(),
    rawPayloadStored: false,
    playlistObservations: playlistObservations.slice(0, MAX_ROWS),
    radioObservations: radioObservations.slice(0, MAX_ROWS),
    chartObservations: chartObservations.slice(0, MAX_ROWS),
    metricObservations: metricObservations.slice(0, MAX_ROWS),
    usage,
    endpoints: endpointResults,
  };
}
