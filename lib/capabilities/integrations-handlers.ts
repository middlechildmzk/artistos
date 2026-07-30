import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/integrations/token-crypto";
import { getYouTubeAnalyticsSummary, getYouTubeChannel, refreshGoogleAccessToken } from "@/lib/integrations/google";
import { registerCapabilityHandler } from "./handlers";
import {
  importMetricSnapshotsCapability,
  savePlatformProfileCapability,
  syncGoogleYouTubeCapability,
} from "./integrations-registry";

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

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

function numberValue(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

registerCapabilityHandler(savePlatformProfileCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, savePlatformProfileCapability.name, key);
  if (replay && typeof replay === "object" && "profileId" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const [{ data: artist, error: artistError }, { data: platform, error: platformError }] = await Promise.all([
    supabase.from("artists").select("id,name").eq("workspace_id", ctx.workspaceId).eq("id", input.artistId).maybeSingle(),
    supabase.from("music_platforms").select("id,slug").eq("id", input.platformId).eq("active", true).maybeSingle(),
  ]);
  if (artistError) throw artistError;
  if (platformError) throw platformError;
  if (!artist) throw new Error("artist_not_found");
  if (!platform) throw new Error("platform_not_found");

  const { data, error } = await supabase
    .from("artist_platform_profiles")
    .upsert({
      workspace_id: ctx.workspaceId,
      owner_id: userId,
      platform_id: platform.id,
      artist_name: artist.name,
      external_artist_id: input.externalArtistId ?? null,
      profile_url: input.profileUrl ?? null,
      connection_state: input.sourceType === "oauth" || input.sourceType === "api" ? "connected" : "identified",
      source_type: input.sourceType,
      last_verified_at: new Date().toISOString(),
      freshness_status: "current",
      metadata: { canonical_artist_id: artist.id, platform_slug: platform.slug },
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id,platform_id,artist_name" })
    .select("id")
    .single();
  if (error) throw error;

  const result = { profileId: data.id, saved: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: savePlatformProfileCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(importMetricSnapshotsCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, importMetricSnapshotsCapability.name, key);
  if (replay && typeof replay === "object" && "imported" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const artistIds = [...new Set(input.rows.map((row) => row.artistId).filter(Boolean))] as string[];
  const releaseIds = [...new Set(input.rows.map((row) => row.releaseId).filter(Boolean))] as string[];
  if (artistIds.length) {
    const { data, error } = await supabase.from("artists").select("id").eq("workspace_id", ctx.workspaceId).in("id", artistIds);
    if (error) throw error;
    if ((data ?? []).length !== artistIds.length) throw new Error("artist_not_found");
  }
  if (releaseIds.length) {
    const { data, error } = await supabase.from("releases").select("id").eq("workspace_id", ctx.workspaceId).in("id", releaseIds);
    if (error) throw error;
    if ((data ?? []).length !== releaseIds.length) throw new Error("release_not_found");
  }

  const values = input.rows.map((row) => ({
    workspace_id: ctx.workspaceId,
    artist_id: row.artistId ?? null,
    release_id: row.releaseId ?? null,
    platform: row.platform,
    metric: row.metric,
    value: row.value,
    captured_on: row.capturedOn,
    source_url: row.sourceUrl ?? null,
  }));

  let imported = 0;
  for (let index = 0; index < values.length; index += 250) {
    const chunk = values.slice(index, index + 250);
    const { data, error } = await supabase
      .from("metric_snapshots")
      .upsert(chunk, { onConflict: "workspace_id,artist_id,release_id,platform,metric,captured_on" })
      .select("id");
    if (error) throw error;
    imported += data?.length ?? chunk.length;
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence_records")
    .insert({
      workspace_id: ctx.workspaceId,
      evidence_type: "metric_export_import",
      source_type: "uploaded_file",
      summary: `Imported ${imported} metric rows from ${input.sourceName}.`,
      confidence: "supported",
      observed_at: new Date().toISOString(),
      captured_by: userId,
      metadata: { source_name: input.sourceName, imported_rows: imported },
      verification_status: "pending",
      verification_method: "source_export",
      contradiction_state: "clear",
    })
    .select("id")
    .single();
  if (evidenceError) throw evidenceError;

  const result = { imported, skipped: Math.max(input.rows.length - imported, 0) };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: importMetricSnapshotsCapability.name, capabilityVersion: 1, key, result, userId });
  return { output: result, evidenceIds: [evidence.id] };
});

registerCapabilityHandler(syncGoogleYouTubeCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, syncGoogleYouTubeCapability.name, key);
  if (replay && typeof replay === "object" && "channelId" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const { data: connection, error: connectionError } = await supabase
    .from("oauth_connections")
    .select("id,encrypted_access_token,encrypted_refresh_token,expires_at,scopes,metadata")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) throw new Error("google_connection_not_found");

  const connectionMetadata = metadataObject(connection.metadata);
  try {
    if (!connection.encrypted_refresh_token) throw new Error("google_refresh_token_missing");
    const refreshToken = decryptIntegrationToken(connection.encrypted_refresh_token);
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const accessToken = refreshed.access_token as string;
    const expiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();
    const nextRefreshToken = refreshed.refresh_token ?? refreshToken;

    const [channel, analytics, youtubePlatformResult, artistsResult] = await Promise.all([
      getYouTubeChannel(accessToken),
      getYouTubeAnalyticsSummary(accessToken),
      supabase.from("music_platforms").select("id").eq("slug", "youtube").single(),
      supabase.from("artists").select("id,name").eq("workspace_id", ctx.workspaceId),
    ]);
    if (youtubePlatformResult.error) throw youtubePlatformResult.error;
    if (artistsResult.error) throw artistsResult.error;

    const channelTitle = channel.snippet?.title?.trim() || "YouTube channel";
    const normalizedChannel = channelTitle.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const canonicalArtist = (artistsResult.data ?? []).find((artist) => artist.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedChannel) ?? null;
    const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
    const syncedAt = new Date().toISOString();

    const { data: profile, error: profileError } = await supabase
      .from("artist_platform_profiles")
      .upsert({
        workspace_id: ctx.workspaceId,
        owner_id: userId,
        platform_id: youtubePlatformResult.data.id,
        artist_name: canonicalArtist?.name ?? channelTitle,
        external_artist_id: channel.id,
        profile_url: channelUrl,
        connection_state: "connected",
        source_type: "oauth",
        last_synced_at: syncedAt,
        last_verified_at: syncedAt,
        freshness_status: "current",
        metadata: {
          canonical_artist_id: canonicalArtist?.id ?? null,
          channel_title: channelTitle,
          custom_url: channel.snippet?.customUrl ?? null,
          hidden_subscriber_count: channel.statistics?.hiddenSubscriberCount ?? false,
        },
        updated_at: syncedAt,
      }, { onConflict: "owner_id,platform_id,artist_name" })
      .select("id")
      .single();
    if (profileError) throw profileError;

    const capturedOn = new Date().toISOString().slice(0, 10);
    const metricCandidates = [
      ["subscribers", channel.statistics?.hiddenSubscriberCount ? null : numberValue(channel.statistics?.subscriberCount)],
      ["channel_views", numberValue(channel.statistics?.viewCount)],
      ["videos", numberValue(channel.statistics?.videoCount)],
      ["views_28d", analytics.values.views ?? null],
      ["watch_minutes_28d", analytics.values.estimatedMinutesWatched ?? null],
      ["average_view_duration_seconds_28d", analytics.values.averageViewDuration ?? null],
      ["subscribers_gained_28d", analytics.values.subscribersGained ?? null],
      ["subscribers_lost_28d", analytics.values.subscribersLost ?? null],
    ] as const;
    const metrics = metricCandidates
      .filter((entry): entry is readonly [string, number] => entry[1] !== null && Number.isFinite(entry[1]))
      .map(([metric, value]) => ({
        workspace_id: ctx.workspaceId,
        artist_id: canonicalArtist?.id ?? null,
        release_id: null,
        platform: "youtube",
        metric,
        value,
        captured_on: capturedOn,
        source_url: channelUrl,
      }));

    if (metrics.length) {
      const { error } = await supabase
        .from("metric_snapshots")
        .upsert(metrics, { onConflict: "workspace_id,artist_id,release_id,platform,metric,captured_on" });
      if (error) throw error;
    }

    const { error: clearSnapshotError } = await supabase
      .from("music_metric_snapshots")
      .delete()
      .eq("workspace_id", ctx.workspaceId)
      .eq("owner_id", userId)
      .eq("platform_id", youtubePlatformResult.data.id)
      .eq("profile_id", profile.id)
      .eq("metric_date", capturedOn)
      .eq("source_type", "youtube_api")
      .is("release_id", null);
    if (clearSnapshotError) throw clearSnapshotError;

    const { error: musicSnapshotError } = await supabase.from("music_metric_snapshots").insert({
      workspace_id: ctx.workspaceId,
      owner_id: userId,
      platform_id: youtubePlatformResult.data.id,
      release_id: null,
      profile_id: profile.id,
      metric_date: capturedOn,
      source_type: "youtube_api",
      source_reference: channelUrl,
      metrics: Object.fromEntries(metricCandidates.filter((entry) => entry[1] !== null)),
      confidence: 1,
      retrieved_at: syncedAt,
    });
    if (musicSnapshotError) throw musicSnapshotError;

    const metadata = {
      ...connectionMetadata,
      youtube_channel_id: channel.id,
      youtube_channel_title: channelTitle,
      youtube_subscribers: channel.statistics?.hiddenSubscriberCount ? null : numberValue(channel.statistics?.subscriberCount),
      youtube_views: numberValue(channel.statistics?.viewCount),
      youtube_videos: numberValue(channel.statistics?.videoCount),
      youtube_analytics_start: analytics.startDate,
      youtube_analytics_end: analytics.endDate,
      youtube_analytics: analytics.values,
      youtube_error: null,
      last_sync_attempt_at: syncedAt,
    };
    const { error: connectionUpdateError } = await supabase
      .from("oauth_connections")
      .update({
        encrypted_access_token: encryptIntegrationToken(accessToken),
        encrypted_refresh_token: encryptIntegrationToken(nextRefreshToken),
        expires_at: expiresAt,
        token_type: refreshed.token_type ?? "Bearer",
        scopes: refreshed.scope?.split(" ").filter(Boolean) ?? connection.scopes,
        metadata,
        last_success_at: syncedAt,
        last_error: null,
        updated_at: syncedAt,
      })
      .eq("id", connection.id)
      .eq("user_id", userId);
    if (connectionUpdateError) throw connectionUpdateError;

    const result = { channelId: channel.id, channelTitle, metricCount: metrics.length, syncedAt };
    await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: syncGoogleYouTubeCapability.name, capabilityVersion: 1, key, result, userId });
    return { output: result, evidenceIds: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "youtube_sync_failed";
    await supabase
      .from("oauth_connections")
      .update({
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
        metadata: { ...connectionMetadata, last_sync_attempt_at: new Date().toISOString() },
      })
      .eq("id", connection.id)
      .eq("user_id", userId);
    throw error;
  }
});
