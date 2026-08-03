import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/integrations/token-crypto";
import {
  collectionSize,
  fetchKitAggregateMetrics,
  latestNumericObservation,
  requestSoundchartsAccessToken,
  resolveSoundchartsArtistBySpotifyId,
  soundchartsGet,
  validateKitApiKey,
} from "@/lib/integrations/provider-clients";
import { registerCapabilityHandler } from "./handlers";
import {
  connectApiProviderCapability,
  syncKitCapability,
  syncSoundchartsCapability,
} from "./provider-integrations-registry";

const KIT_SERVER_TOKEN_REFERENCE = "env.KIT_API_KEY";

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", capabilityName)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: {
  workspaceId: string;
  capabilityName: string;
  capabilityVersion: number;
  key: string;
  result: unknown;
  userId: string;
}) {
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

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metricDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function metricName(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}

async function insertEvidence(args: {
  workspaceId: string;
  userId: string;
  artistId?: string | null;
  evidenceType: string;
  summary: string;
  verificationMethod: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("evidence_records").insert({
    workspace_id: args.workspaceId,
    artist_id: args.artistId ?? null,
    evidence_type: args.evidenceType,
    source_type: "api_response",
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

async function replaceWorkspaceProviderMetrics(args: {
  workspaceId: string;
  platform: string;
  capturedOn: string;
  rows: Array<Record<string, unknown>>;
}) {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase.from("metric_snapshots")
    .delete()
    .eq("workspace_id", args.workspaceId)
    .eq("platform", args.platform)
    .eq("captured_on", args.capturedOn)
    .is("artist_id", null)
    .is("release_id", null);
  if (deleteError) throw deleteError;
  if (!args.rows.length) return;
  const { error: insertError } = await supabase.from("metric_snapshots").insert(args.rows);
  if (insertError) throw insertError;
}

async function replaceArtistProviderMetrics(args: {
  workspaceId: string;
  artistId: string;
  platform: string;
  rows: Array<Record<string, unknown>>;
}) {
  const supabase = await createSupabaseServerClient();
  for (const row of args.rows) {
    const metric = String(row.metric ?? "");
    const capturedOn = String(row.captured_on ?? "");
    const { error: deleteError } = await supabase.from("metric_snapshots")
      .delete()
      .eq("workspace_id", args.workspaceId)
      .eq("artist_id", args.artistId)
      .is("release_id", null)
      .eq("platform", args.platform)
      .eq("metric", metric)
      .eq("captured_on", capturedOn);
    if (deleteError) throw deleteError;
  }
  if (!args.rows.length) return;
  const { error: insertError } = await supabase.from("metric_snapshots").insert(args.rows);
  if (insertError) throw insertError;
}

registerCapabilityHandler(connectApiProviderCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, connectApiProviderCapability.name, key);
  if (replay && typeof replay === "object" && "connectionId" in replay) return { output: replay as any, evidenceIds: [] };

  let validation: Record<string, unknown> = {};
  if (input.provider === "soundcharts") {
    if (!input.secondarySecret) throw new Error("secondary_secret_required");
    const token = await requestSoundchartsAccessToken({
      clientId: input.primarySecret,
      clientSecret: input.secondarySecret,
      teamId: input.teamId,
    });
    validation = { token_type: token.tokenType, token_expires_in: token.expiresIn };
  } else {
    validation = await validateKitApiKey(input.primarySecret);
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("oauth_connections").upsert({
    workspace_id: ctx.workspaceId,
    user_id: userId,
    provider: input.provider,
    provider_account_id: input.teamId ?? null,
    account_email: null,
    encrypted_access_token: encryptIntegrationToken(input.primarySecret),
    encrypted_refresh_token: input.secondarySecret ? encryptIntegrationToken(input.secondarySecret) : null,
    token_type: input.provider === "soundcharts" ? "ClientCredentials" : "ApiKey",
    expires_at: null,
    scopes: ["read"],
    metadata: {
      connection_kind: input.provider === "soundcharts" ? "client_credentials" : "api_key",
      account_label: input.accountLabel ?? null,
      validated_at: now,
      validation,
    },
    last_success_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: "user_id,provider" }).select("id").single();
  if (error) throw error;

  const result = { provider: input.provider, connectionId: data.id, connected: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: connectApiProviderCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(syncKitCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncKitCapability.name, key);
  if (replay && typeof replay === "object" && "syncedAt" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const { data: storedConnection, error: connectionError } = await supabase.from("oauth_connections")
    .select("id,encrypted_access_token,metadata")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", userId)
    .eq("provider", "kit")
    .maybeSingle();
  if (connectionError) throw connectionError;

  let connection = storedConnection;
  if (!connection?.encrypted_access_token) {
    const serverApiKey = process.env.KIT_API_KEY?.trim();
    if (!serverApiKey) throw new Error("kit_connection_not_found");
    if (ctx.role !== "owner") throw new Error("kit_server_key_owner_required");

    const { count: workspaceCount, error: workspaceCountError } = await supabase
      .from("workspaces")
      .select("id", { count: "exact", head: true });
    if (workspaceCountError) throw workspaceCountError;
    if (workspaceCount !== 1) throw new Error("kit_server_key_requires_single_workspace");

    const validation = await validateKitApiKey(serverApiKey);
    const configuredAt = new Date().toISOString();
    const { data: bootstrappedConnection, error: bootstrapError } = await supabase.from("oauth_connections").upsert({
      workspace_id: ctx.workspaceId,
      user_id: userId,
      provider: "kit",
      provider_account_id: null,
      account_email: null,
      encrypted_access_token: KIT_SERVER_TOKEN_REFERENCE,
      encrypted_refresh_token: null,
      token_type: "ServerManagedApiKey",
      expires_at: null,
      scopes: ["read"],
      metadata: {
        connection_kind: "server_managed_api_key",
        credential_reference: "KIT_API_KEY",
        account_label: "Middle Child email list",
        validated_at: configuredAt,
        validation,
      },
      last_success_at: configuredAt,
      last_error: null,
      updated_at: configuredAt,
    }, { onConflict: "user_id,provider" }).select("id,encrypted_access_token,metadata").single();
    if (bootstrapError) throw bootstrapError;
    connection = bootstrappedConnection;
  }

  const apiKey = decryptIntegrationToken(connection.encrypted_access_token);
  const aggregate = await fetchKitAggregateMetrics(apiKey);
  const capturedOn = new Date().toISOString().slice(0, 10);
  const metrics = [
    ["subscribers_active", aggregate.activeSubscribers],
    ["subscribers_total", aggregate.totalSubscribers],
    ["subscribers_inactive", aggregate.inactiveSubscribers],
    ["subscribers_bounced", aggregate.bouncedSubscribers],
    ["subscribers_complained", aggregate.complainedSubscribers],
    ["subscribers_cancelled", aggregate.cancelledSubscribers],
    ["broadcasts_total", aggregate.broadcastsTotal],
    ["broadcasts_completed", aggregate.completedBroadcasts],
    ["broadcast_recipients", aggregate.recipients],
    ["emails_opened", aggregate.emailsOpened],
    ["email_clicks", aggregate.totalClicks],
    ["email_unsubscribes", aggregate.unsubscribes],
    ["email_open_rate", aggregate.openRate],
    ["email_click_rate", aggregate.clickRate],
  ] as const;
  const metricRows = metrics.map(([metric, value]) => ({
    workspace_id: ctx.workspaceId,
    artist_id: null,
    release_id: null,
    platform: "kit",
    metric,
    value,
    captured_on: capturedOn,
    source_url: "https://api.kit.com/v4",
  }));
  await replaceWorkspaceProviderMetrics({ workspaceId: ctx.workspaceId, platform: "kit", capturedOn, rows: metricRows });

  const credentialSource = connection.encrypted_access_token === KIT_SERVER_TOKEN_REFERENCE ? "vercel_environment" : "workspace_encrypted";
  const evidenceId = await insertEvidence({
    workspaceId: ctx.workspaceId,
    userId,
    evidenceType: "kit_aggregate_sync",
    summary: `Synced ${aggregate.activeSubscribers} active Kit subscribers and aggregate broadcast performance.`,
    verificationMethod: "kit_v4_api",
    metadata: { ...aggregate, raw_subscriber_records_stored: false, credential_source: credentialSource },
  });
  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase.from("oauth_connections").update({
    last_success_at: syncedAt,
    last_error: null,
    updated_at: syncedAt,
    metadata: { ...asObject(connection.metadata), last_sync_at: syncedAt, aggregate, credential_source: credentialSource },
  }).eq("id", connection.id).eq("user_id", userId);
  if (updateError) throw updateError;

  const result = { metricCount: metrics.length, syncedAt };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncKitCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidenceId] };
});

registerCapabilityHandler(syncSoundchartsCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncSoundchartsCapability.name, key);
  if (replay && typeof replay === "object" && "soundchartsUuid" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const [{ data: artist, error: artistError }, { data: connection, error: connectionError }, { data: spotifyPlatform, error: platformError }] = await Promise.all([
    supabase.from("artists").select("id,name").eq("workspace_id", ctx.workspaceId).eq("id", input.artistId).maybeSingle(),
    supabase.from("oauth_connections").select("id,provider_account_id,encrypted_access_token,encrypted_refresh_token,metadata").eq("workspace_id", ctx.workspaceId).eq("user_id", userId).eq("provider", "soundcharts").maybeSingle(),
    supabase.from("music_platforms").select("id").eq("slug", "spotify").maybeSingle(),
  ]);
  if (artistError) throw artistError;
  if (connectionError) throw connectionError;
  if (platformError) throw platformError;
  if (!artist) throw new Error("artist_not_found");
  if (!connection?.encrypted_access_token || !connection.encrypted_refresh_token) throw new Error("soundcharts_connection_not_found");
  if (!spotifyPlatform) throw new Error("spotify_platform_not_found");

  const { data: spotifyProfiles, error: profileError } = await supabase.from("artist_platform_profiles")
    .select("external_artist_id,metadata,artist_name")
    .eq("workspace_id", ctx.workspaceId)
    .eq("platform_id", spotifyPlatform.id);
  if (profileError) throw profileError;
  const spotifyProfile = (spotifyProfiles ?? []).find((profile) => asObject(profile.metadata).canonical_artist_id === input.artistId)
    ?? (spotifyProfiles ?? []).find((profile) => profile.artist_name.toLowerCase() === artist.name.toLowerCase());
  if (!spotifyProfile?.external_artist_id) throw new Error("spotify_profile_not_found");

  const clientId = decryptIntegrationToken(connection.encrypted_access_token);
  const clientSecret = decryptIntegrationToken(connection.encrypted_refresh_token);
  const token = await requestSoundchartsAccessToken({ clientId, clientSecret, teamId: connection.provider_account_id });
  const resolved = await resolveSoundchartsArtistBySpotifyId(token.accessToken, spotifyProfile.external_artist_id);
  const endpointDefinitions = [
    ["spotify_streaming", `/api/v2/artist/${resolved.uuid}/streaming/spotify`],
    ["youtube_audience", `/api/v2/artist/${resolved.uuid}/audience/youtube`],
    ["instagram_audience", `/api/v2/artist/${resolved.uuid}/audience/instagram`],
    ["spotify_playlists", `/api/v2.20/artist/${resolved.uuid}/playlist/current/spotify?currentOnly=1&limit=100`],
  ] as const;
  const endpointResults = await Promise.allSettled(endpointDefinitions.map(async ([name, path]) => ({ name, path, payload: await soundchartsGet(path, token.accessToken) })));

  const capturedOn = new Date().toISOString().slice(0, 10);
  const metricRows: Array<Record<string, unknown>> = [];
  const endpointErrors: Record<string, string> = {};
  let playlistEntries = 0;
  for (let index = 0; index < endpointResults.length; index += 1) {
    const definition = endpointDefinitions[index];
    const result = endpointResults[index];
    if (result.status === "rejected") {
      endpointErrors[definition[0]] = result.reason instanceof Error ? result.reason.message : "endpoint_failed";
      continue;
    }
    if (result.value.name === "spotify_playlists") {
      playlistEntries = collectionSize(result.value.payload);
      metricRows.push({
        workspace_id: ctx.workspaceId,
        artist_id: input.artistId,
        release_id: null,
        platform: "soundcharts",
        metric: "spotify_playlist_entries",
        value: playlistEntries,
        captured_on: capturedOn,
        source_url: `https://customer.api.soundcharts.com${result.value.path}`,
      });
      continue;
    }
    const observation = latestNumericObservation(result.value.payload);
    if (!observation) continue;
    metricRows.push({
      workspace_id: ctx.workspaceId,
      artist_id: input.artistId,
      release_id: null,
      platform: "soundcharts",
      metric: `${result.value.name}_${metricName(observation.key)}`,
      value: observation.value,
      captured_on: metricDate(observation.date),
      source_url: `https://customer.api.soundcharts.com${result.value.path}`,
    });
  }
  await replaceArtistProviderMetrics({ workspaceId: ctx.workspaceId, artistId: input.artistId, platform: "soundcharts", rows: metricRows });

  const syncedAt = new Date().toISOString();
  const connectionMetadata = asObject(connection.metadata);
  const artistMap = asObject(connectionMetadata.artist_map);
  const { error: updateError } = await supabase.from("oauth_connections").update({
    last_success_at: syncedAt,
    last_error: null,
    updated_at: syncedAt,
    metadata: {
      ...connectionMetadata,
      artist_map: { ...artistMap, [input.artistId]: resolved.uuid },
      last_sync_at: syncedAt,
      last_endpoint_errors: endpointErrors,
      last_metric_count: metricRows.length,
      last_playlist_entries: playlistEntries,
    },
  }).eq("id", connection.id).eq("user_id", userId);
  if (updateError) throw updateError;

  const evidenceId = await insertEvidence({
    workspaceId: ctx.workspaceId,
    userId,
    artistId: input.artistId,
    evidenceType: "soundcharts_artist_sync",
    summary: `Resolved ${artist.name} to Soundcharts ${resolved.uuid} and stored ${metricRows.length} entitled observations.`,
    verificationMethod: "soundcharts_api",
    metadata: {
      soundcharts_uuid: resolved.uuid,
      spotify_artist_id: spotifyProfile.external_artist_id,
      metric_count: metricRows.length,
      playlist_entries: playlistEntries,
      endpoint_errors: endpointErrors,
    },
  });

  const result = { artistId: input.artistId, soundchartsUuid: resolved.uuid, metricCount: metricRows.length, playlistEntries, syncedAt };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncSoundchartsCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidenceId] };
});
