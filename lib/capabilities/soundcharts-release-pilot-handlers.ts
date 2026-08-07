import "server-only";

import { createHash } from "node:crypto";
import { decryptIntegrationToken } from "@/lib/integrations/token-crypto";
import { runSoundchartsReleasePilot } from "@/lib/integrations/soundcharts-release-pilot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import { syncSoundchartsReleasePilotCapability } from "./soundcharts-release-pilot-registry";

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function observationKey(parts: Array<string | number | null | undefined>) {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex");
}

async function readReplay(workspaceId: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", syncSoundchartsReleasePilotCapability.name)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: {
  workspaceId: string;
  key: string;
  result: unknown;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: syncSoundchartsReleasePilotCapability.name,
    capability_version: syncSoundchartsReleasePilotCapability.version,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId,
  });
  if (error) throw error;
}

registerCapabilityHandler(syncSoundchartsReleasePilotCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, key);
  if (replay && typeof replay === "object" && "evidenceId" in replay) {
    const evidenceId = String((replay as Record<string, unknown>).evidenceId);
    return { output: replay as any, evidenceIds: [evidenceId] };
  }

  const supabase = await createSupabaseServerClient();
  const [releaseResult, connectionResult, spotifyPlatformResult] = await Promise.all([
    supabase
      .from("releases")
      .select("id,artist_id,title,isrc,release_date,spotify_url")
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", input.releaseId)
      .maybeSingle(),
    supabase
      .from("oauth_connections")
      .select("id,provider_account_id,encrypted_access_token,encrypted_refresh_token,metadata")
      .eq("workspace_id", ctx.workspaceId)
      .eq("user_id", userId)
      .eq("provider", "soundcharts")
      .maybeSingle(),
    supabase.from("music_platforms").select("id").eq("slug", "spotify").maybeSingle(),
  ]);
  if (releaseResult.error) throw releaseResult.error;
  if (connectionResult.error) throw connectionResult.error;
  if (spotifyPlatformResult.error) throw spotifyPlatformResult.error;
  const release = releaseResult.data;
  const connection = connectionResult.data;
  if (!release) throw new Error("release_not_found");
  if (!release.isrc) throw new Error("release_isrc_required");
  if (!connection?.encrypted_access_token || !connection.encrypted_refresh_token) throw new Error("soundcharts_connection_not_found");

  const clientId = decryptIntegrationToken(connection.encrypted_access_token);
  const clientSecret = decryptIntegrationToken(connection.encrypted_refresh_token);
  let pilot;
  try {
    pilot = await runSoundchartsReleasePilot({
      clientId,
      clientSecret,
      teamId: connection.provider_account_id,
      isrc: release.isrc,
      releaseDate: release.release_date,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    await supabase.from("oauth_connections").update({
      last_error: error instanceof Error ? error.message.slice(0, 500) : "soundcharts_release_pilot_failed",
      updated_at: failedAt,
      metadata: {
        ...asObject(connection.metadata),
        release_pilot_last_failed_at: failedAt,
        release_pilot_release_id: release.id,
        release_pilot_isrc: release.isrc,
      },
    }).eq("id", connection.id).eq("user_id", userId);
    throw error;
  }

  const capturedOn = pilot.checkedAt.slice(0, 10);
  const metricRowsByConflictKey = new Map<string, {
    workspace_id: string;
    artist_id: string;
    release_id: string;
    platform: string;
    metric: string;
    value: number;
    captured_on: string;
    source_url: string;
  }>();
  for (const metric of pilot.metricObservations) {
    const row = {
      workspace_id: ctx.workspaceId,
      artist_id: release.artist_id,
      release_id: release.id,
      platform: "soundcharts",
      metric: metric.metric,
      value: metric.value,
      captured_on: metric.observedOn || capturedOn,
      source_url: metric.sourceUrl,
    };
    const conflictKey = [
      row.workspace_id,
      row.artist_id,
      row.release_id,
      row.platform,
      row.metric,
      row.captured_on,
    ].join("|");
    metricRowsByConflictKey.set(conflictKey, row);
  }
  const metricRows = [...metricRowsByConflictKey.values()];
  const duplicateMetricCount = Math.max(0, pilot.metricObservations.length - metricRows.length);
  if (metricRows.length) {
    const { error } = await supabase.from("metric_snapshots").upsert(metricRows, {
      onConflict: "workspace_id,artist_id,release_id,platform,metric,captured_on",
    });
    if (error) throw error;
  }

  const { data: existingPlacements, error: existingPlacementsError } = await supabase
    .from("playlist_placements")
    .select("id,external_playlist_id,playlist_url,evidence")
    .eq("workspace_id", ctx.workspaceId)
    .eq("release_id", release.id);
  if (existingPlacementsError) throw existingPlacementsError;

  let playlistCount = 0;
  for (const placement of pilot.playlistObservations) {
    const existing = (existingPlacements ?? []).find((row) => {
      const evidence = asObject(row.evidence);
      return Boolean(
        (placement.externalPlaylistId && row.external_playlist_id === placement.externalPlaylistId)
        || (placement.playlistUrl && row.playlist_url === placement.playlistUrl)
        || evidence.provider_record_id === placement.providerRecordId,
      );
    });
    const values = {
      workspace_id: ctx.workspaceId,
      owner_id: userId,
      release_id: release.id,
      platform_id: spotifyPlatformResult.data?.id ?? null,
      playlist_name: placement.playlistName,
      playlist_url: placement.playlistUrl,
      external_playlist_id: placement.externalPlaylistId,
      owner_name: placement.ownerName,
      owner_url: placement.ownerUrl,
      followers: placement.followers,
      track_position: placement.position,
      added_at: placement.entryDate,
      removed_at: placement.removedAt,
      last_activity_at: placement.positionDate ?? pilot.checkedAt,
      source_type: "licensed",
      confidence: 1,
      risk_state: "unknown",
      verification_state: "verified",
      last_verified_at: pilot.checkedAt,
      evidence: {
        provider: "soundcharts",
        source_class: "licensed",
        acquisition_method: "soundcharts_production_api",
        provider_record_id: placement.providerRecordId,
        soundcharts_song_uuid: pilot.soundchartsUuid,
        observed_at: pilot.checkedAt,
        source_url: placement.sourceUrl,
        raw_payload_stored: false,
      },
      updated_at: pilot.checkedAt,
    };
    const mutation = existing
      ? supabase.from("playlist_placements").update(values).eq("id", existing.id).eq("workspace_id", ctx.workspaceId)
      : supabase.from("playlist_placements").insert(values);
    const { error } = await mutation;
    if (error) throw error;
    playlistCount += 1;
  }

  const { data: existingEvidence, error: existingEvidenceError } = await supabase
    .from("evidence_records")
    .select("id,evidence_type,metadata")
    .eq("workspace_id", ctx.workspaceId)
    .eq("release_id", release.id)
    .in("evidence_type", ["soundcharts_radio_spin", "soundcharts_chart_entry"])
    .limit(5000);
  if (existingEvidenceError) throw existingEvidenceError;
  const existingObservationKeys = new Set(
    (existingEvidence ?? [])
      .map((row) => asObject(row.metadata).observation_key)
      .filter((value): value is string => typeof value === "string" && Boolean(value)),
  );

  const eventEvidenceRows: Array<Record<string, unknown>> = [];
  for (const spin of pilot.radioObservations) {
    const eventKey = observationKey(["soundcharts", "radio_spin", pilot.soundchartsUuid, spin.providerRecordId, spin.airedAt]);
    if (existingObservationKeys.has(eventKey)) continue;
    existingObservationKeys.add(eventKey);
    eventEvidenceRows.push({
      workspace_id: ctx.workspaceId,
      artist_id: release.artist_id,
      release_id: release.id,
      evidence_type: "soundcharts_radio_spin",
      source_type: "api_response",
      source_uri: spin.stationUrl ?? spin.sourceUrl,
      summary: `${release.title} was reported on ${spin.stationName} at ${spin.airedAt}.`,
      confidence: "verified",
      confidence_score: 1,
      observed_at: pilot.checkedAt,
      captured_by: userId,
      metadata: {
        observation_key: eventKey,
        provider: "soundcharts",
        source_class: "licensed",
        acquisition_method: "soundcharts_production_api",
        provider_record_id: spin.providerRecordId,
        soundcharts_song_uuid: pilot.soundchartsUuid,
        station_slug: spin.stationSlug,
        station_name: spin.stationName,
        aired_at: spin.airedAt,
        territory: spin.territory,
        raw_payload_stored: false,
      },
      verification_status: "verified",
      verification_method: "soundcharts_api",
      contradiction_state: "clear",
    });
  }
  for (const chart of pilot.chartObservations) {
    const eventKey = observationKey(["soundcharts", "chart_entry", pilot.soundchartsUuid, chart.providerRecordId, chart.rankDate, chart.position]);
    if (existingObservationKeys.has(eventKey)) continue;
    existingObservationKeys.add(eventKey);
    eventEvidenceRows.push({
      workspace_id: ctx.workspaceId,
      artist_id: release.artist_id,
      release_id: release.id,
      evidence_type: "soundcharts_chart_entry",
      source_type: "api_response",
      source_uri: chart.chartUrl ?? chart.sourceUrl,
      summary: `${release.title} was reported at position ${chart.position} on ${chart.chartName}.`,
      confidence: "verified",
      confidence_score: 1,
      observed_at: pilot.checkedAt,
      captured_by: userId,
      metadata: {
        observation_key: eventKey,
        provider: "soundcharts",
        source_class: "licensed",
        acquisition_method: "soundcharts_production_api",
        provider_record_id: chart.providerRecordId,
        soundcharts_song_uuid: pilot.soundchartsUuid,
        chart_slug: chart.chartSlug,
        chart_name: chart.chartName,
        platform: chart.platform,
        position: chart.position,
        previous_position: chart.previousPosition,
        entry_date: chart.entryDate,
        rank_date: chart.rankDate,
        territory: chart.territory,
        raw_payload_stored: false,
      },
      verification_status: "verified",
      verification_method: "soundcharts_api",
      contradiction_state: "clear",
    });
  }

  let insertedEventEvidenceIds: string[] = [];
  if (eventEvidenceRows.length) {
    const { data, error } = await supabase.from("evidence_records").insert(eventEvidenceRows).select("id");
    if (error) throw error;
    insertedEventEvidenceIds = (data ?? []).map((row) => row.id as string);
  }

  const endpointAvailableCount = pilot.endpoints.filter((endpoint) => endpoint.status === "available").length;
  const endpointUnavailableCount = pilot.endpoints.filter((endpoint) => endpoint.status === "unavailable").length;
  const endpointFailedCount = pilot.endpoints.filter((endpoint) => endpoint.status === "failed").length;
  const { data: summaryEvidence, error: summaryEvidenceError } = await supabase.from("evidence_records").insert({
    workspace_id: ctx.workspaceId,
    artist_id: release.artist_id,
    release_id: release.id,
    evidence_type: "soundcharts_release_pilot_sync",
    source_type: "api_response",
    source_uri: `https://customer.api.soundcharts.com/api/v2.25/song/by-isrc/${encodeURIComponent(pilot.isrc)}`,
    summary: `Resolved ${release.title} by ISRC ${pilot.isrc} and stored ${metricRows.length} unique metrics, ${playlistCount} playlist observations, ${pilot.radioObservations.length} radio spins, and ${pilot.chartObservations.length} chart observations.`,
    confidence: "verified",
    confidence_score: 1,
    observed_at: pilot.checkedAt,
    captured_by: userId,
    metadata: {
      provider: "soundcharts",
      environment: pilot.environment,
      isrc: pilot.isrc,
      soundcharts_song_uuid: pilot.soundchartsUuid,
      metric_input_count: pilot.metricObservations.length,
      metric_count: metricRows.length,
      metric_duplicate_count: duplicateMetricCount,
      playlist_count: playlistCount,
      radio_spin_count: pilot.radioObservations.length,
      chart_count: pilot.chartObservations.length,
      endpoint_available_count: endpointAvailableCount,
      endpoint_unavailable_count: endpointUnavailableCount,
      endpoint_failed_count: endpointFailedCount,
      endpoints: pilot.endpoints,
      usage: pilot.usage,
      raw_payload_stored: false,
      rights_boundary: "provider_contract_required_for_multi_tenant_customer_display",
      idempotency_key: key,
    },
    verification_status: "verified",
    verification_method: "soundcharts_api",
    contradiction_state: "clear",
  }).select("id").single();
  if (summaryEvidenceError) throw summaryEvidenceError;

  const syncedAt = pilot.checkedAt;
  const connectionMetadata = asObject(connection.metadata);
  const releaseMap = asObject(connectionMetadata.release_map);
  const { error: connectionUpdateError } = await supabase.from("oauth_connections").update({
    last_success_at: syncedAt,
    last_error: null,
    updated_at: syncedAt,
    metadata: {
      ...connectionMetadata,
      release_map: { ...releaseMap, [release.id]: pilot.soundchartsUuid },
      release_pilot_last_sync_at: syncedAt,
      release_pilot_release_id: release.id,
      release_pilot_isrc: pilot.isrc,
      release_pilot_usage: pilot.usage,
      release_pilot_endpoints: pilot.endpoints,
      release_pilot_raw_payload_stored: false,
    },
  }).eq("id", connection.id).eq("user_id", userId);
  if (connectionUpdateError) throw connectionUpdateError;

  const result = {
    releaseId: release.id,
    artistId: release.artist_id,
    isrc: pilot.isrc,
    soundchartsUuid: pilot.soundchartsUuid,
    metricCount: metricRows.length,
    playlistCount,
    radioSpinCount: pilot.radioObservations.length,
    chartCount: pilot.chartObservations.length,
    endpointAvailableCount,
    endpointUnavailableCount,
    endpointFailedCount,
    syncedAt,
    evidenceId: summaryEvidence.id as string,
  };
  await writeReplay({ workspaceId: ctx.workspaceId, key, result, userId });
  return {
    output: result,
    evidenceIds: [summaryEvidence.id as string, ...insertedEventEvidenceIds],
  };
});
