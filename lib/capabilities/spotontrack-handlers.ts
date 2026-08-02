import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/integrations/token-crypto";
import { collectionSize, spotOnTrackGet, validateSpotOnTrackApiKey } from "@/lib/integrations/provider-clients";
import { registerCapabilityHandler } from "./handlers";
import { connectSpotOnTrackCapability, syncSpotOnTrackCapability } from "./provider-integrations-registry";

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayPayload(value: unknown) {
  return Array.isArray(value) ? value.map(asObject) : [];
}

function metricDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function latestDatedRow(value: unknown) {
  return arrayPayload(value).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0] ?? null;
}

function playlistFollowerReach(value: unknown) {
  return arrayPayload(value).reduce((sum, entry) => sum + (Number(asObject(entry.playlist).followers ?? 0) || 0), 0);
}

function bestChartPosition(value: unknown) {
  const positions = arrayPayload(value).map((entry) => Number(entry.position)).filter((position) => Number.isFinite(position) && position > 0);
  return positions.length ? Math.min(...positions) : null;
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

async function writeReplay(args: { workspaceId: string; capabilityName: string; key: string; result: unknown; userId: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: 1,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId,
  });
  if (error) throw error;
}

async function replaceReleaseMetrics(args: { workspaceId: string; releaseId: string; rows: Array<Record<string, unknown>> }) {
  const supabase = await createSupabaseServerClient();
  for (const row of args.rows) {
    const { error } = await supabase.from("metric_snapshots")
      .delete()
      .eq("workspace_id", args.workspaceId)
      .eq("release_id", args.releaseId)
      .eq("platform", "spotontrack")
      .eq("metric", String(row.metric ?? ""))
      .eq("captured_on", String(row.captured_on ?? ""));
    if (error) throw error;
  }
  if (!args.rows.length) return;
  const { error } = await supabase.from("metric_snapshots").insert(args.rows);
  if (error) throw error;
}

registerCapabilityHandler(connectSpotOnTrackCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, connectSpotOnTrackCapability.name, key);
  if (replay && typeof replay === "object" && "connectionId" in replay) return { output: replay as any, evidenceIds: [] };

  const validation = await validateSpotOnTrackApiKey(input.apiKey);
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("oauth_connections").upsert({
    workspace_id: ctx.workspaceId,
    user_id: userId,
    provider: "spotontrack",
    provider_account_id: null,
    account_email: null,
    encrypted_access_token: encryptIntegrationToken(input.apiKey),
    encrypted_refresh_token: null,
    token_type: "ApiKey",
    expires_at: null,
    scopes: ["read"],
    metadata: {
      connection_kind: "api_key",
      account_label: input.accountLabel ?? null,
      validated_at: now,
      validation,
    },
    last_success_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: "user_id,provider" }).select("id").single();
  if (error) throw error;

  const result = { provider: "spotontrack" as const, connectionId: data.id, connected: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: connectSpotOnTrackCapability.name, key, result, userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(syncSpotOnTrackCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncSpotOnTrackCapability.name, key);
  if (replay && typeof replay === "object" && "isrc" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const [{ data: release, error: releaseError }, { data: connection, error: connectionError }] = await Promise.all([
    supabase.from("releases").select("id,artist_id,title,isrc").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle(),
    supabase.from("oauth_connections").select("id,encrypted_access_token,metadata").eq("workspace_id", ctx.workspaceId).eq("user_id", userId).eq("provider", "spotontrack").maybeSingle(),
  ]);
  if (releaseError) throw releaseError;
  if (connectionError) throw connectionError;
  if (!release) throw new Error("release_not_found");
  const isrc = String(release.isrc ?? "").trim().toUpperCase();
  if (!isrc) throw new Error("release_isrc_required");
  if (!connection?.encrypted_access_token) throw new Error("spotontrack_connection_not_found");

  const apiKey = decryptIntegrationToken(connection.encrypted_access_token);
  const encodedIsrc = encodeURIComponent(isrc);
  const endpointDefinitions = [
    ["metadata", `/tracks/${encodedIsrc}`],
    ["spotify_streams", `/tracks/${encodedIsrc}/spotify/streams`],
    ["spotify_playlists_current", `/tracks/${encodedIsrc}/spotify/playlists/current`],
    ["spotify_playlists_removed", `/tracks/${encodedIsrc}/spotify/playlists/removed`],
    ["apple_playlists_current", `/tracks/${encodedIsrc}/apple/playlists/current`],
    ["deezer_playlists_current", `/tracks/${encodedIsrc}/deezer/playlists/current`],
    ["spotify_charts_current", `/tracks/${encodedIsrc}/spotify/charts/current`],
    ["apple_charts_current", `/tracks/${encodedIsrc}/apple/charts/current`],
    ["deezer_charts_current", `/tracks/${encodedIsrc}/deezer/charts/current`],
    ["shazam_counts", `/tracks/${encodedIsrc}/shazam/shazams`],
    ["shazam_charts_current", `/tracks/${encodedIsrc}/shazam/charts/current`],
  ] as const;
  const endpointResults = await Promise.allSettled(endpointDefinitions.map(async ([name, path]) => ({ name, path, payload: await spotOnTrackGet(path, apiKey) })));
  const capturedOn = new Date().toISOString().slice(0, 10);
  const metricRows: Array<Record<string, unknown>> = [];
  const endpointErrors: Record<string, string> = {};
  const payloads = new Map<string, unknown>();
  for (let index = 0; index < endpointResults.length; index += 1) {
    const result = endpointResults[index];
    const [name] = endpointDefinitions[index];
    if (result.status === "rejected") endpointErrors[name] = result.reason instanceof Error ? result.reason.message : "endpoint_failed";
    else payloads.set(name, result.value.payload);
  }

  const addMetric = (metric: string, value: number | null, date: string | null | undefined, path: string) => {
    if (value === null || !Number.isFinite(value)) return;
    metricRows.push({
      workspace_id: ctx.workspaceId,
      artist_id: release.artist_id,
      release_id: release.id,
      platform: "spotontrack",
      metric,
      value,
      captured_on: metricDate(date ?? capturedOn),
      source_url: `https://www.spotontrack.com/api/v1${path}`,
    });
  };

  const streams = latestDatedRow(payloads.get("spotify_streams"));
  addMetric("spotify_total_streams", streams ? finiteNumber(streams.total) : null, streams ? String(streams.date ?? capturedOn) : capturedOn, `/tracks/${encodedIsrc}/spotify/streams`);
  addMetric("spotify_daily_streams", streams ? finiteNumber(streams.daily) : null, streams ? String(streams.date ?? capturedOn) : capturedOn, `/tracks/${encodedIsrc}/spotify/streams`);
  const shazams = latestDatedRow(payloads.get("shazam_counts"));
  addMetric("shazam_total", shazams ? finiteNumber(shazams.total) : null, shazams ? String(shazams.date ?? capturedOn) : capturedOn, `/tracks/${encodedIsrc}/shazam/shazams`);
  addMetric("shazam_daily", shazams ? finiteNumber(shazams.daily) : null, shazams ? String(shazams.date ?? capturedOn) : capturedOn, `/tracks/${encodedIsrc}/shazam/shazams`);

  const playlistSources = [
    ["spotify", "spotify_playlists_current", `/tracks/${encodedIsrc}/spotify/playlists/current`],
    ["apple", "apple_playlists_current", `/tracks/${encodedIsrc}/apple/playlists/current`],
    ["deezer", "deezer_playlists_current", `/tracks/${encodedIsrc}/deezer/playlists/current`],
  ] as const;
  let playlistEntries = 0;
  for (const [platform, name, path] of playlistSources) {
    const payload = payloads.get(name);
    const count = collectionSize(payload);
    playlistEntries += count;
    addMetric(`${platform}_current_playlist_entries`, count, capturedOn, path);
    if (platform !== "apple") addMetric(`${platform}_current_playlist_reach`, playlistFollowerReach(payload), capturedOn, path);
  }
  addMetric("spotify_removed_playlist_entries", collectionSize(payloads.get("spotify_playlists_removed")), capturedOn, `/tracks/${encodedIsrc}/spotify/playlists/removed`);

  const chartSources = [
    ["spotify", "spotify_charts_current", `/tracks/${encodedIsrc}/spotify/charts/current`],
    ["apple", "apple_charts_current", `/tracks/${encodedIsrc}/apple/charts/current`],
    ["deezer", "deezer_charts_current", `/tracks/${encodedIsrc}/deezer/charts/current`],
    ["shazam", "shazam_charts_current", `/tracks/${encodedIsrc}/shazam/charts/current`],
  ] as const;
  for (const [platform, name, path] of chartSources) {
    const payload = payloads.get(name);
    addMetric(`${platform}_current_chart_entries`, collectionSize(payload), capturedOn, path);
    addMetric(`${platform}_best_current_chart_position`, bestChartPosition(payload), capturedOn, path);
  }

  await replaceReleaseMetrics({ workspaceId: ctx.workspaceId, releaseId: release.id, rows: metricRows });
  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase.from("oauth_connections").update({
    last_success_at: syncedAt,
    last_error: null,
    updated_at: syncedAt,
    metadata: {
      ...asObject(connection.metadata),
      last_sync_at: syncedAt,
      last_release_id: release.id,
      last_isrc: isrc,
      last_metric_count: metricRows.length,
      last_playlist_entries: playlistEntries,
      last_endpoint_errors: endpointErrors,
    },
  }).eq("id", connection.id).eq("user_id", userId);
  if (updateError) throw updateError;

  const { data: evidence, error: evidenceError } = await supabase.from("evidence_records").insert({
    workspace_id: ctx.workspaceId,
    artist_id: release.artist_id,
    evidence_type: "spotontrack_release_sync",
    source_type: "api_response",
    summary: `Synced ${release.title} by ISRC ${isrc} and stored ${metricRows.length} entitled Spotontrack observations.`,
    confidence: "verified",
    confidence_score: 1,
    observed_at: syncedAt,
    captured_by: userId,
    metadata: { release_id: release.id, isrc, metric_count: metricRows.length, playlist_entries: playlistEntries, endpoint_errors: endpointErrors },
    verification_status: "verified",
    verification_method: "spotontrack_api",
    contradiction_state: "clear",
  }).select("id").single();
  if (evidenceError) throw evidenceError;

  const result = { releaseId: release.id, isrc, metricCount: metricRows.length, playlistEntries, syncedAt };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncSpotOnTrackCapability.name, key, result, userId });
  return { output: result, evidenceIds: [evidence.id] };
});
