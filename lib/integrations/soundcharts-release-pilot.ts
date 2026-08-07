import "server-only";

import { createHash } from "node:crypto";
import {
  ProviderApiError,
  requestSoundchartsAccessToken,
  soundchartsGet,
} from "@/lib/integrations/provider-clients";

const SOUNDCHARTS_ORIGIN = "https://customer.api.soundcharts.com";
const CHART_PLATFORMS = ["spotify", "apple-music", "shazam", "youtube"] as const;
const MAX_NORMALIZED_ROWS = 100;

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

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function allObjects(value: unknown, output: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    for (const item of value) allObjects(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const object = value as JsonObject;
  output.push(object);
  for (const child of Object.values(object)) allObjects(child, output);
  return output;
}

function directString(object: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function directNumber(object: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = Number(object[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function nestedObject(object: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = asObject(object[key]);
    if (Object.keys(value).length) return value;
  }
  return {};
}

function deepString(object: JsonObject, keys: string[]) {
  const direct = directString(object, keys);
  if (direct) return direct;
  for (const child of Object.values(object)) {
    if (!child || typeof child !== "object") continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = deepString(asObject(item), keys);
        if (found) return found;
      }
    } else {
      const found = deepString(asObject(child), keys);
      if (found) return found;
    }
  }
  return null;
}

function deepStringsByKey(value: unknown, keys: Set<string>, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) deepStringsByKey(item, keys, output);
    return output;
  }
  const object = asObject(value);
  for (const [key, child] of Object.entries(object)) {
    if (keys.has(key) && typeof child === "string" && child.trim()) output.push(child.trim());
    if (child && typeof child === "object") deepStringsByKey(child, keys, output);
  }
  return output;
}

function dateValue(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function stableId(parts: Array<string | number | null | undefined>) {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex");
}

function sourceUrl(path: string) {
  return `${SOUNDCHARTS_ORIGIN}${path}`;
}

function normalizeMetricName(path: string) {
  return path
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 120);
}

function collectNumbers(value: unknown, prefix = "", output = new Map<string, number>()) {
  if (Array.isArray(value)) return output;
  const object = asObject(value);
  for (const [key, child] of Object.entries(object)) {
    const path = prefix ? `${prefix}_${key}` : key;
    if (typeof child === "number" && Number.isFinite(child)) {
      const normalized = normalizeMetricName(path);
      if (normalized && !output.has(normalized)) output.set(normalized, child);
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      collectNumbers(child, path, output);
    }
    if (output.size >= 40) break;
  }
  return output;
}

function collectionObjects(payload: unknown, markers: string[]) {
  const candidates = allObjects(payload).filter((object) => markers.some((marker) => marker in object));
  return candidates.slice(0, MAX_NORMALIZED_ROWS);
}

function extractSongUuid(payload: unknown, requestedIsrc: string) {
  const root = asObject(payload);
  const containers = [root, asObject(root.object), asObject(root.data), asObject(root.song)];
  let uuid: string | null = null;
  for (const container of containers) {
    uuid = directString(container, ["uuid", "songUuid", "song_uuid"]);
    if (uuid) break;
  }
  uuid ??= deepString(root, ["songUuid", "song_uuid", "uuid"]);
  if (!uuid) throw new ProviderApiError("Soundcharts song UUID was not present in the ISRC response", { code: "soundcharts_song_uuid_missing" });

  const returnedIsrcs = deepStringsByKey(payload, new Set(["isrc", "isrcCode", "isrc_code"])).map((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
  const canonicalRequested = requestedIsrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (returnedIsrcs.length && !returnedIsrcs.includes(canonicalRequested)) {
    throw new ProviderApiError("Soundcharts returned a recording with a different ISRC", { code: "soundcharts_isrc_mismatch" });
  }
  return uuid;
}

function normalizePlaylists(payload: unknown, path: string): SoundchartsPlaylistObservation[] {
  const rows = collectionObjects(payload, ["position", "entryDate", "positionDate", "subscriberCount", "playlistName"]);
  const output = new Map<string, SoundchartsPlaylistObservation>();
  for (const row of rows) {
    const playlist = nestedObject(row, ["playlist", "resource", "object"]);
    const playlistName = directString(playlist, ["name", "title", "playlistName"])
      ?? directString(row, ["playlistName", "name", "title"]);
    if (!playlistName) continue;
    const externalPlaylistId = directString(playlist, ["uuid", "id", "slug", "identifier", "playlistId"])
      ?? directString(row, ["playlistUuid", "playlistId", "playlist_id"]);
    const playlistUrl = safeUrl(directString(playlist, ["url", "externalUrl", "spotifyUrl"])
      ?? directString(row, ["playlistUrl", "url"]));
    const entryDate = dateValue(directString(row, ["entryDate", "entry_date", "addedAt", "added_at"]));
    const positionDate = dateValue(directString(row, ["positionDate", "position_date", "rankDate", "updatedAt"]));
    const position = directNumber(row, ["position", "rank"]);
    const explicitExit = dateValue(directString(row, ["exitDate", "exit_date", "removedAt", "removed_at"]));
    const removedAt = explicitExit ?? (position === 0 ? positionDate : null);
    const providerRecordId = directString(row, ["id", "uuid", "entryId", "positionId"])
      ?? stableId([externalPlaylistId, playlistUrl, playlistName, entryDate, positionDate, position]);
    const owner = nestedObject(playlist, ["owner", "curator"]);
    const observation: SoundchartsPlaylistObservation = {
      providerRecordId,
      externalPlaylistId,
      playlistName,
      playlistUrl,
      ownerName: directString(owner, ["name", "displayName"]) ?? directString(row, ["ownerName", "curatorName"]),
      ownerUrl: safeUrl(directString(owner, ["url", "externalUrl"]) ?? directString(row, ["ownerUrl"])),
      followers: directNumber(row, ["subscriberCount", "followers", "followerCount"])
        ?? directNumber(playlist, ["subscriberCount", "followers", "followerCount"]),
      position,
      entryDate,
      positionDate,
      removedAt,
      territory: directString(row, ["countryCode", "country_code", "country"]),
      platform: "spotify",
      sourceUrl: sourceUrl(path),
    };
    output.set(providerRecordId, observation);
  }
  return [...output.values()].slice(0, MAX_NORMALIZED_ROWS);
}

function normalizeRadio(payload: unknown, path: string): SoundchartsRadioObservation[] {
  const rows = collectionObjects(payload, ["airedAt", "aired_at", "broadcastAt", "radioSlug"]);
  const output = new Map<string, SoundchartsRadioObservation>();
  for (const row of rows) {
    const airedAt = dateValue(directString(row, ["airedAt", "aired_at", "broadcastAt", "timestamp", "date"]));
    if (!airedAt) continue;
    const radio = nestedObject(row, ["radio", "station", "resource"]);
    const stationSlug = directString(radio, ["slug", "id", "uuid"])
      ?? directString(row, ["radioSlug", "stationSlug", "radioId"]);
    const stationName = directString(radio, ["name", "title"])
      ?? directString(row, ["radioName", "stationName", "name"])
      ?? stationSlug
      ?? "Unknown station";
    const providerRecordId = directString(row, ["id", "uuid", "broadcastId"])
      ?? stableId([stationSlug, stationName, airedAt]);
    output.set(providerRecordId, {
      providerRecordId,
      stationSlug,
      stationName,
      stationUrl: safeUrl(directString(radio, ["url", "website", "externalUrl"]) ?? directString(row, ["radioUrl", "stationUrl"])),
      airedAt,
      territory: directString(row, ["countryCode", "country_code", "country"])
        ?? directString(radio, ["countryCode", "country_code", "country"]),
      sourceUrl: sourceUrl(path),
    });
  }
  return [...output.values()].slice(0, MAX_NORMALIZED_ROWS);
}

function normalizeCharts(payload: unknown, path: string, platform: string): SoundchartsChartObservation[] {
  const rows = collectionObjects(payload, ["position", "rankDate", "entryDate", "oldPosition", "chartSlug"]);
  const output = new Map<string, SoundchartsChartObservation>();
  for (const row of rows) {
    const position = directNumber(row, ["position", "rank"]);
    if (position === null) continue;
    const chart = nestedObject(row, ["chart", "resource", "object"]);
    const chartSlug = directString(chart, ["slug", "id", "uuid"])
      ?? directString(row, ["chartSlug", "chartId", "chart_id"]);
    const chartName = directString(chart, ["name", "title"])
      ?? directString(row, ["chartName", "name", "title"])
      ?? chartSlug
      ?? `${platform} chart`;
    const rankDate = dateValue(directString(row, ["rankDate", "rank_date", "positionDate", "date"]));
    const entryDate = dateValue(directString(row, ["entryDate", "entry_date"]));
    const providerRecordId = directString(row, ["id", "uuid", "rankId"])
      ?? stableId([platform, chartSlug, chartName, entryDate, rankDate, position]);
    output.set(providerRecordId, {
      providerRecordId,
      chartSlug,
      chartName,
      chartUrl: safeUrl(directString(chart, ["url", "externalUrl"]) ?? directString(row, ["chartUrl"])),
      platform,
      position,
      previousPosition: directNumber(row, ["oldPosition", "previousPosition", "previous_position"]),
      entryDate,
      rankDate,
      territory: directString(row, ["countryCode", "country_code", "country"])
        ?? directString(chart, ["countryCode", "country_code", "country"]),
      sourceUrl: sourceUrl(path),
    });
  }
  return [...output.values()].slice(0, MAX_NORMALIZED_ROWS);
}

function endpointFailure(name: string, path: string, reason: unknown): SoundchartsEndpointResult {
  const error = reason instanceof ProviderApiError ? reason : null;
  const status = error?.status ?? null;
  return {
    name,
    path,
    status: status === 403 || status === 404 ? "unavailable" : "failed",
    responseCount: 0,
    errorCode: error?.code ?? (reason instanceof Error ? reason.message : "endpoint_failed"),
    httpStatus: status,
  };
}

function releaseStartDate(value: string | null | undefined) {
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
  const canonicalIsrc = args.isrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(canonicalIsrc)) throw new Error("release_isrc_invalid");

  const token = await requestSoundchartsAccessToken({
    clientId: args.clientId,
    clientSecret: args.clientSecret,
    teamId: args.teamId,
  });
  const resolutionPath = `/api/v2.25/song/by-isrc/${encodeURIComponent(canonicalIsrc)}`;
  const resolutionPayload = await soundchartsGet(resolutionPath, token.accessToken);
  const soundchartsUuid = extractSongUuid(resolutionPayload, canonicalIsrc);
  const startDate = releaseStartDate(args.releaseDate);

  const endpoints = [
    { name: "identifiers", path: `/api/v2/song/${soundchartsUuid}/identifiers`, kind: "metadata" },
    { name: "current_stats", path: `/api/v2/song/${soundchartsUuid}/current/stats`, kind: "metrics" },
    { name: "spotify_playlist_entries", path: `/api/v2.20/song/${soundchartsUuid}/playlist/current/spotify?currentOnly=0&limit=100&sortBy=entryDate&sortOrder=desc`, kind: "playlists" },
    { name: "spotify_playlist_reach", path: `/api/v2/song/${soundchartsUuid}/playlist/reach/spotify`, kind: "metrics" },
    { name: "radio_spins", path: `/api/v2/song/${soundchartsUuid}/broadcasts?${new URLSearchParams({ ...(startDate ? { startDate } : {}), limit: "100", sort: "desc" }).toString()}`, kind: "radio" },
    { name: "radio_spin_counts", path: `/api/v2/song/${soundchartsUuid}/broadcast-groups?${new URLSearchParams({ ...(startDate ? { startDate } : {}), limit: "100" }).toString()}`, kind: "metrics" },
    ...CHART_PLATFORMS.map((platform) => ({
      name: `chart_${platform}`,
      path: `/api/v2/song/${soundchartsUuid}/charts/ranks/${platform}?currentOnly=0&limit=100&sortBy=rankDate&sortOrder=desc`,
      kind: "chart" as const,
      platform,
    })),
    { name: "team_usage", path: "/api/v2/team/usage", kind: "usage" },
  ] as const;

  const results = await Promise.allSettled(endpoints.map(async (endpoint) => ({
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

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const endpoint = endpoints[index];
    if (result.status === "rejected") {
      endpointResults.push(endpointFailure(endpoint.name, endpoint.path, result.reason));
      continue;
    }

    let responseCount = 0;
    if (endpoint.kind === "playlists") {
      const normalized = normalizePlaylists(result.value.payload, endpoint.path);
      playlistObservations.push(...normalized);
      responseCount = normalized.length;
    } else if (endpoint.kind === "radio") {
      const normalized = normalizeRadio(result.value.payload, endpoint.path);
      radioObservations.push(...normalized);
      responseCount = normalized.length;
    } else if (endpoint.kind === "chart") {
      const normalized = normalizeCharts(result.value.payload, endpoint.path, endpoint.platform);
      chartObservations.push(...normalized);
      responseCount = normalized.length;
    } else if (endpoint.kind === "metrics") {
      const numbers = collectNumbers(result.value.payload);
      for (const [metric, value] of numbers) {
        metricObservations.push({
          metric: `${normalizeMetricName(endpoint.name)}_${metric}`.slice(0, 120),
          value,
          observedOn,
          sourceUrl: sourceUrl(endpoint.path),
        });
      }
      responseCount = numbers.size;
    } else if (endpoint.kind === "usage") {
      const numbers = collectNumbers(result.value.payload);
      for (const [metric, value] of numbers) usage[metric] = value;
      responseCount = numbers.size;
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
    isrc: canonicalIsrc,
    soundchartsUuid,
    checkedAt: new Date().toISOString(),
    rawPayloadStored: false,
    playlistObservations: playlistObservations.slice(0, MAX_NORMALIZED_ROWS),
    radioObservations: radioObservations.slice(0, MAX_NORMALIZED_ROWS),
    chartObservations: chartObservations.slice(0, MAX_NORMALIZED_ROWS),
    metricObservations: metricObservations.slice(0, 100),
    usage,
    endpoints: endpointResults,
  };
}
