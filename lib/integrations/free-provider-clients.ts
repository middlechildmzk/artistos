import "server-only";

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";
const LISTENBRAINZ_BASE = "https://api.listenbrainz.org";
const TICKETMASTER_BASE = "https://app.ticketmaster.com/discovery/v2";
const MAX_RESPONSE_BYTES = 2_000_000;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readJson(response: Response, label: string) {
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error(`${label}_response_too_large`);
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label}_invalid_json`);
  }
  if (!response.ok) {
    const body = objectValue(payload);
    const message = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(`${label}_request_failed:${response.status}:${message}`);
  }
  return payload;
}

async function getJson(url: URL, label: string, headers?: HeadersInit) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return readJson(response, label);
}

async function postJson(url: URL, body: unknown, label: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return readJson(response, label);
}

function lastFmUrl(method: string, apiKey: string, params: Record<string, string>) {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function validateLastFmApiKey(apiKey: string) {
  const payload = await getJson(lastFmUrl("artist.getInfo", apiKey, { artist: "Cher", autocorrect: "0" }), "lastfm");
  const artist = objectValue(objectValue(payload).artist);
  if (!artist.name) throw new Error("lastfm_credentials_invalid");
  return { validated: true, sampleArtist: String(artist.name) };
}

export async function fetchLastFmArtist(args: { apiKey: string; artistName?: string | null; musicBrainzId?: string | null }) {
  const identityParams = args.musicBrainzId ? { mbid: args.musicBrainzId } : { artist: args.artistName ?? "" };
  if (!identityParams.mbid && !identityParams.artist) throw new Error("lastfm_identity_required");
  const [infoPayload, tracksPayload, similarPayload] = await Promise.all([
    getJson(lastFmUrl("artist.getInfo", args.apiKey, { ...identityParams, autocorrect: "0" }), "lastfm"),
    getJson(lastFmUrl("artist.getTopTracks", args.apiKey, { ...identityParams, autocorrect: "0", limit: "10", page: "1" }), "lastfm"),
    getJson(lastFmUrl("artist.getSimilar", args.apiKey, { ...identityParams, autocorrect: "0", limit: "10" }), "lastfm"),
  ]);
  const artist = objectValue(objectValue(infoPayload).artist);
  const stats = objectValue(artist.stats);
  const tracks = arrayValue(objectValue(objectValue(tracksPayload).toptracks).track).map((item) => {
    const track = objectValue(item);
    return {
      name: typeof track.name === "string" ? track.name : null,
      listeners: numberValue(track.listeners),
      playcount: numberValue(track.playcount),
      url: typeof track.url === "string" ? track.url : null,
    };
  }).filter((track) => track.name);
  const similar = arrayValue(objectValue(objectValue(similarPayload).similarartists).artist).map((item) => {
    const value = objectValue(item);
    return {
      name: typeof value.name === "string" ? value.name : null,
      match: numberValue(value.match),
      url: typeof value.url === "string" ? value.url : null,
    };
  }).filter((item) => item.name);
  const name = typeof artist.name === "string" ? artist.name : args.artistName ?? "Unknown";
  return {
    name,
    mbid: typeof artist.mbid === "string" && artist.mbid ? artist.mbid : args.musicBrainzId ?? null,
    url: typeof artist.url === "string" ? artist.url : null,
    listeners: numberValue(stats.listeners),
    playcount: numberValue(stats.playcount),
    topTracks: tracks,
    similarArtists: similar,
  };
}

export async function fetchListenBrainzArtist(musicBrainzId: string) {
  const popularityUrl = new URL("/1/popularity/artist", LISTENBRAINZ_BASE);
  const topRecordingsUrl = new URL(`/1/popularity/top-recordings-for-artist/${encodeURIComponent(musicBrainzId)}`, LISTENBRAINZ_BASE);
  const [popularityPayload, recordingsPayload] = await Promise.all([
    postJson(popularityUrl, { artist_mbids: [musicBrainzId] }, "listenbrainz"),
    getJson(topRecordingsUrl, "listenbrainz"),
  ]);
  const popularity = objectValue(arrayValue(popularityPayload)[0]);
  const recordings = arrayValue(recordingsPayload).slice(0, 25).map((item) => {
    const value = objectValue(item);
    return {
      recordingMbid: typeof value.recording_mbid === "string" ? value.recording_mbid : null,
      recordingName: typeof value.recording_name === "string" ? value.recording_name : null,
      totalListenCount: numberValue(value.total_listen_count),
      totalUserCount: numberValue(value.total_user_count),
    };
  });
  return {
    artistMbid: musicBrainzId,
    totalListenCount: numberValue(popularity.total_listen_count),
    totalUserCount: numberValue(popularity.total_user_count),
    topRecordings: recordings,
  };
}

function ticketmasterUrl(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(path, TICKETMASTER_BASE);
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function validateTicketmasterApiKey(apiKey: string) {
  const payload = await getJson(ticketmasterUrl("/discovery/v2/attractions.json", apiKey, { keyword: "Middle Child", size: "1" }), "ticketmaster");
  return { validated: true, resultCount: arrayValue(objectValue(objectValue(payload)._embedded).attractions).length };
}

export async function fetchTicketmasterArtist(apiKey: string, attractionId: string) {
  const [attractionPayload, eventsPayload] = await Promise.all([
    getJson(ticketmasterUrl(`/discovery/v2/attractions/${encodeURIComponent(attractionId)}.json`, apiKey), "ticketmaster"),
    getJson(ticketmasterUrl("/discovery/v2/events.json", apiKey, { attractionId, size: "100", sort: "date,asc" }), "ticketmaster"),
  ]);
  const attraction = objectValue(attractionPayload);
  const events = arrayValue(objectValue(objectValue(eventsPayload)._embedded).events).map((item) => {
    const event = objectValue(item);
    const dates = objectValue(event.dates);
    const start = objectValue(dates.start);
    const embedded = objectValue(event._embedded);
    const venues = arrayValue(embedded.venues);
    const venue = objectValue(venues[0]);
    return {
      id: typeof event.id === "string" ? event.id : null,
      name: typeof event.name === "string" ? event.name : null,
      url: typeof event.url === "string" ? event.url : null,
      localDate: typeof start.localDate === "string" ? start.localDate : null,
      localTime: typeof start.localTime === "string" ? start.localTime : null,
      venueId: typeof venue.id === "string" ? venue.id : null,
      venueName: typeof venue.name === "string" ? venue.name : null,
      city: typeof objectValue(venue.city).name === "string" ? String(objectValue(venue.city).name) : null,
      state: typeof objectValue(venue.state).stateCode === "string" ? String(objectValue(venue.state).stateCode) : null,
      country: typeof objectValue(venue.country).countryCode === "string" ? String(objectValue(venue.country).countryCode) : null,
    };
  });
  return {
    attractionId,
    attractionName: typeof attraction.name === "string" ? attraction.name : null,
    attractionUrl: typeof attraction.url === "string" ? attraction.url : null,
    events,
  };
}
