import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/integrations/token-crypto";
import {
  fetchLastFmArtist,
  fetchListenBrainzArtist,
  fetchTicketmasterArtist,
  validateLastFmApiKey,
  validateTicketmasterApiKey,
} from "@/lib/integrations/free-provider-clients";
import { registerCapabilityHandler } from "./handlers";
import {
  connectFreeApiProviderCapability,
  saveExternalArtistIdentityCapability,
  syncLastFmCapability,
  syncListenBrainzCapability,
  syncTicketmasterCapability,
} from "./free-source-registry";

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numericSum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
}

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", capabilityName)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: { workspaceId: string; capabilityName: string; capabilityVersion: number; key: string; result: unknown; userId: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId,
  });
  if (error) throw error;
}

async function insertEvidence(args: {
  workspaceId: string;
  userId: string;
  artistId: string;
  evidenceType: string;
  summary: string;
  verificationMethod: string;
  sourceUrl?: string | null;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("evidence_records").insert({
    workspace_id: args.workspaceId,
    artist_id: args.artistId,
    evidence_type: args.evidenceType,
    source_type: "api_response",
    source_url: args.sourceUrl ?? null,
    summary: args.summary,
    confidence: "verified",
    confidence_score: 1,
    observed_at: new Date().toISOString(),
    captured_by: args.userId,
    metadata: args.metadata,
    verification_status: "verified",
    verification_method: args.verificationMethod,
    contradiction_state: "clear",
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function replaceArtistMetrics(args: {
  workspaceId: string;
  artistId: string;
  platform: string;
  capturedOn: string;
  rows: Array<{ metric: string; value: number; sourceUrl: string | null }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase.from("metric_snapshots").delete()
    .eq("workspace_id", args.workspaceId)
    .eq("artist_id", args.artistId)
    .is("release_id", null)
    .eq("platform", args.platform)
    .eq("captured_on", args.capturedOn);
  if (deleteError) throw deleteError;
  if (!args.rows.length) return;
  const { error: insertError } = await supabase.from("metric_snapshots").insert(args.rows.map((row) => ({
    workspace_id: args.workspaceId,
    artist_id: args.artistId,
    release_id: null,
    platform: args.platform,
    metric: row.metric,
    value: row.value,
    captured_on: args.capturedOn,
    source_url: row.sourceUrl,
  })));
  if (insertError) throw insertError;
}

async function loadArtist(workspaceId: string, artistId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("artists").select("id,name").eq("workspace_id", workspaceId).eq("id", artistId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("artist_not_found");
  return data;
}

async function loadIdentity(workspaceId: string, artistId: string, provider: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("artist_external_identities")
    .select("id,provider,external_id,display_name,profile_url,verification_status,metadata")
    .eq("workspace_id", workspaceId)
    .eq("artist_id", artistId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadConnection(workspaceId: string, userId: string, provider: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("oauth_connections")
    .select("id,encrypted_access_token,metadata")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markConnectionSuccess(args: { connectionId: string; userId: string; metadata: Record<string, unknown> }) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("oauth_connections").update({
    last_success_at: now,
    last_error: null,
    metadata: args.metadata,
    updated_at: now,
  }).eq("id", args.connectionId).eq("user_id", args.userId);
  if (error) throw error;
  return now;
}

registerCapabilityHandler(saveExternalArtistIdentityCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, saveExternalArtistIdentityCapability.name, key);
  if (replay && typeof replay === "object" && "identityId" in replay) return { output: replay as any, evidenceIds: [] };

  const artist = await loadArtist(ctx.workspaceId, input.artistId);
  const uuidProviders = new Set(["musicbrainz", "listenbrainz"]);
  if (uuidProviders.has(input.provider) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.externalId)) {
    throw new Error("invalid_provider_identity");
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("artist_external_identities").upsert({
    workspace_id: ctx.workspaceId,
    artist_id: input.artistId,
    provider: input.provider,
    external_id: input.externalId,
    display_name: input.displayName ?? artist.name,
    profile_url: input.profileUrl ?? null,
    source_type: "manual",
    verification_status: "supported",
    confidence: 0.8,
    contradiction_state: "clear",
    last_verified_at: now,
    metadata: { confirmed_by_user: true },
    created_by: userId,
    updated_at: now,
  }, { onConflict: "workspace_id,artist_id,provider" }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("external_identity_conflict");
    throw error;
  }

  const evidenceId = await insertEvidence({
    workspaceId: ctx.workspaceId,
    userId,
    artistId: input.artistId,
    evidenceType: "external_artist_identity",
    summary: `Mapped ${artist.name} to ${input.provider} identity ${input.externalId}.`,
    verificationMethod: "user_confirmed_identity",
    sourceUrl: input.profileUrl ?? null,
    metadata: { provider: input.provider, external_id: input.externalId, display_name: input.displayName ?? artist.name },
  });
  const result = { identityId: data.id, provider: input.provider, saved: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: saveExternalArtistIdentityCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidenceId] };
});

registerCapabilityHandler(connectFreeApiProviderCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, connectFreeApiProviderCapability.name, key);
  if (replay && typeof replay === "object" && "connectionId" in replay) return { output: replay as any, evidenceIds: [] };

  const validation = input.provider === "lastfm"
    ? await validateLastFmApiKey(input.apiKey)
    : await validateTicketmasterApiKey(input.apiKey);
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("oauth_connections").upsert({
    workspace_id: ctx.workspaceId,
    user_id: userId,
    provider: input.provider,
    provider_account_id: null,
    account_email: null,
    encrypted_access_token: encryptIntegrationToken(input.apiKey),
    encrypted_refresh_token: null,
    token_type: "ApiKey",
    expires_at: null,
    scopes: ["read"],
    metadata: { connection_kind: "api_key", account_label: input.accountLabel ?? null, validated_at: now, validation },
    last_success_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: "user_id,provider" }).select("id").single();
  if (error) throw error;

  const result = { provider: input.provider, connectionId: data.id, connected: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: connectFreeApiProviderCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(syncLastFmCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncLastFmCapability.name, key);
  if (replay && typeof replay === "object" && "syncedAt" in replay) return { output: replay as any, evidenceIds: [] };

  const [artist, connection, lastFmIdentity, musicBrainzIdentity] = await Promise.all([
    loadArtist(ctx.workspaceId, input.artistId),
    loadConnection(ctx.workspaceId, userId, "lastfm"),
    loadIdentity(ctx.workspaceId, input.artistId, "lastfm"),
    loadIdentity(ctx.workspaceId, input.artistId, "musicbrainz"),
  ]);
  if (!connection?.encrypted_access_token) throw new Error("lastfm_connection_not_found");
  if (!lastFmIdentity && !musicBrainzIdentity) throw new Error("lastfm_identity_not_found");

  const apiKey = decryptIntegrationToken(connection.encrypted_access_token);
  const observation = await fetchLastFmArtist({
    apiKey,
    artistName: lastFmIdentity?.external_id ?? null,
    musicBrainzId: musicBrainzIdentity?.external_id ?? null,
  });
  const capturedOn = new Date().toISOString().slice(0, 10);
  const sourceUrl = observation.url ?? lastFmIdentity?.profile_url ?? "https://www.last.fm/music";
  const topTrackPlaycounts = observation.topTracks.map((track) => track.playcount);
  const topTrackListeners = observation.topTracks.map((track) => track.listeners);
  const rows = [
    ["listeners", observation.listeners],
    ["playcount", observation.playcount],
    ["top_tracks_total_playcount", numericSum(topTrackPlaycounts)],
    ["top_tracks_total_listeners", numericSum(topTrackListeners)],
    ["top_track_peak_playcount", Math.max(0, ...topTrackPlaycounts.map((value) => value ?? 0))],
    ["similar_artists_count", observation.similarArtists.length],
  ].filter((row): row is [string, number] => typeof row[1] === "number" && Number.isFinite(row[1]));
  await replaceArtistMetrics({ workspaceId: ctx.workspaceId, artistId: input.artistId, platform: "lastfm", capturedOn, rows: rows.map(([metric, value]) => ({ metric, value, sourceUrl })) });

  const syncedAt = await markConnectionSuccess({
    connectionId: connection.id,
    userId,
    metadata: { ...asObject(connection.metadata), last_sync_at: new Date().toISOString(), last_artist: artist.name, last_metric_count: rows.length },
  });
  const evidenceId = await insertEvidence({
    workspaceId: ctx.workspaceId,
    userId,
    artistId: input.artistId,
    evidenceType: "lastfm_artist_sync",
    summary: `Synced ${rows.length} public Last.fm observations for ${artist.name}.`,
    verificationMethod: "lastfm_api",
    sourceUrl,
    metadata: { canonical_name: observation.name, mbid: observation.mbid, top_tracks: observation.topTracks, similar_artists: observation.similarArtists },
  });
  const result = { artistId: input.artistId, metricCount: rows.length, syncedAt };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncLastFmCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidenceId] };
});

registerCapabilityHandler(syncListenBrainzCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncListenBrainzCapability.name, key);
  if (replay && typeof replay === "object" && "syncedAt" in replay) return { output: replay as any, evidenceIds: [] };

  const [artist, musicBrainzIdentity] = await Promise.all([
    loadArtist(ctx.workspaceId, input.artistId),
    loadIdentity(ctx.workspaceId, input.artistId, "musicbrainz"),
  ]);
  if (!musicBrainzIdentity) throw new Error("musicbrainz_identity_not_found");
  const observation = await fetchListenBrainzArtist(musicBrainzIdentity.external_id);
  const capturedOn = new Date().toISOString().slice(0, 10);
  const sourceUrl = `https://api.listenbrainz.org/1/popularity/artist`;
  const recordingListens = observation.topRecordings.map((recording) => recording.totalListenCount);
  const recordingUsers = observation.topRecordings.map((recording) => recording.totalUserCount);
  const rows = [
    ["total_listen_count", observation.totalListenCount],
    ["total_user_count", observation.totalUserCount],
    ["top_recordings_count", observation.topRecordings.length],
    ["top_recordings_listen_count", numericSum(recordingListens)],
    ["top_recordings_user_count", numericSum(recordingUsers)],
  ].filter((row): row is [string, number] => typeof row[1] === "number" && Number.isFinite(row[1]));
  await replaceArtistMetrics({ workspaceId: ctx.workspaceId, artistId: input.artistId, platform: "listenbrainz", capturedOn, rows: rows.map(([metric, value]) => ({ metric, value, sourceUrl })) });

  const syncedAt = new Date().toISOString();
  const evidenceId = await insertEvidence({
    workspaceId: ctx.workspaceId,
    userId,
    artistId: input.artistId,
    evidenceType: "listenbrainz_artist_sync",
    summary: `Synced ${rows.length} open ListenBrainz observations for ${artist.name}.`,
    verificationMethod: "listenbrainz_api",
    sourceUrl,
    metadata: { musicbrainz_artist_id: musicBrainzIdentity.external_id, top_recordings: observation.topRecordings },
  });
  const result = { artistId: input.artistId, metricCount: rows.length, syncedAt };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncListenBrainzCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidenceId] };
});

registerCapabilityHandler(syncTicketmasterCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncTicketmasterCapability.name, key);
  if (replay && typeof replay === "object" && "syncedAt" in replay) return { output: replay as any, evidenceIds: [] };

  const [artist, connection, identity] = await Promise.all([
    loadArtist(ctx.workspaceId, input.artistId),
    loadConnection(ctx.workspaceId, userId, "ticketmaster"),
    loadIdentity(ctx.workspaceId, input.artistId, "ticketmaster"),
  ]);
  if (!connection?.encrypted_access_token) throw new Error("ticketmaster_connection_not_found");
  if (!identity) throw new Error("ticketmaster_identity_not_found");

  const apiKey = decryptIntegrationToken(connection.encrypted_access_token);
  const observation = await fetchTicketmasterArtist(apiKey, identity.external_id);
  const capturedOn = new Date().toISOString().slice(0, 10);
  const sourceUrl = observation.attractionUrl ?? identity.profile_url ?? `https://app.ticketmaster.com/discovery/v2/attractions/${encodeURIComponent(identity.external_id)}.json`;
  const venues = new Set(observation.events.map((event) => event.venueId ?? event.venueName).filter(Boolean));
  const markets = new Set(observation.events.map((event) => [event.city, event.state, event.country].filter(Boolean).join(", ")).filter(Boolean));
  const nextEventDate = observation.events.map((event) => event.localDate).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
  const nextEventDays = nextEventDate ? Math.max(0, Math.ceil((new Date(`${nextEventDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000)) : null;
  const rows = [
    ["upcoming_events", observation.events.length],
    ["venues", venues.size],
    ["markets", markets.size],
    ["days_to_next_event", nextEventDays],
  ].filter((row): row is [string, number] => typeof row[1] === "number" && Number.isFinite(row[1]));
  await replaceArtistMetrics({ workspaceId: ctx.workspaceId, artistId: input.artistId, platform: "ticketmaster", capturedOn, rows: rows.map(([metric, value]) => ({ metric, value, sourceUrl })) });

  const syncedAt = await markConnectionSuccess({
    connectionId: connection.id,
    userId,
    metadata: { ...asObject(connection.metadata), last_sync_at: new Date().toISOString(), last_artist: artist.name, last_event_count: observation.events.length },
  });
  const evidenceId = await insertEvidence({
    workspaceId: ctx.workspaceId,
    userId,
    artistId: input.artistId,
    evidenceType: "ticketmaster_artist_sync",
    summary: `Synced ${observation.events.length} upcoming Ticketmaster events for ${artist.name}.`,
    verificationMethod: "ticketmaster_discovery_api",
    sourceUrl,
    metadata: { attraction_id: identity.external_id, attraction_name: observation.attractionName, events: observation.events.slice(0, 25) },
  });
  const result = { artistId: input.artistId, metricCount: rows.length, eventCount: observation.events.length, syncedAt };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncTicketmasterCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidenceId] };
});
