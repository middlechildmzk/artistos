"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseMetricCsv } from "@/lib/integrations/csv";

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function safeError(error: unknown) {
  const value = error instanceof Error ? error.message : "source_action_failed";
  return value.replace(/[^a-zA-Z0-9_:\-. ]/g, "").slice(0, 240) || "source_action_failed";
}

async function invokeSourceCapability(name: string, input: Record<string, unknown>, idempotencyKey: string) {
  const ctx = await createActorContext();
  const result = await invokeCapability({
    name,
    ctx,
    input: { ...input, idempotencyKey },
    idempotencyKey,
    dependencies: createServerInvocationDependencies(),
  });
  if (result.status === "ok") return result.output;
  if (result.status === "requires_approval") throw new Error(`approval_required:${result.approvalId}`);
  if (result.status === "denied") throw new Error(`capability_denied:${result.policy}:${result.reason}`);
  throw new Error(`${result.error.code}:${result.error.message}`);
}

function refreshSourceViews() {
  revalidatePath("/connections");
  revalidatePath("/analytics");
  revalidatePath("/proof");
}

export async function savePlatformProfile(formData: FormData) {
  try {
    const artistId = String(formData.get("artistId") ?? "");
    const platformId = String(formData.get("platformId") ?? "");
    const externalArtistId = String(formData.get("externalArtistId") ?? "").trim() || null;
    const profileUrl = String(formData.get("profileUrl") ?? "").trim() || null;
    if (!artistId || !platformId || (!externalArtistId && !profileUrl)) throw new Error("profile_identity_required");
    await invokeSourceCapability(
      "integrations.save_platform_profile",
      { artistId, platformId, externalArtistId, profileUrl, sourceType: "manual" },
      `platform-profile:${artistId}:${platformId}:${randomUUID()}`,
    );
    revalidatePath("/connections");
    revalidatePath("/analytics");
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect("/connections?saved=profile");
}

export async function importMetricCsv(formData: FormData) {
  let imported = 0;
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("metric_csv_required");
    if (file.size > 5_000_000) throw new Error("metric_csv_too_large");
    const content = await file.text();
    const parsedRows = parseMetricCsv(content);
    const ctx = await createActorContext();
    const supabase = await createSupabaseServerClient();
    const [artistsResult, releasesResult] = await Promise.all([
      supabase.from("artists").select("id,name").eq("workspace_id", ctx.workspaceId),
      supabase.from("releases").select("id,title").eq("workspace_id", ctx.workspaceId),
    ]);
    if (artistsResult.error) throw artistsResult.error;
    if (releasesResult.error) throw releasesResult.error;
    const artists = new Map((artistsResult.data ?? []).map((artist) => [normalized(artist.name), artist.id]));
    const releases = new Map((releasesResult.data ?? []).map((release) => [normalized(release.title), release.id]));
    const rows = parsedRows.map((row, index) => {
      const artistId = row.artistName ? artists.get(normalized(row.artistName)) ?? null : null;
      const releaseId = row.releaseTitle ? releases.get(normalized(row.releaseTitle)) ?? null : null;
      if (row.artistName && !artistId) throw new Error(`unknown_artist_row_${index + 2}:${row.artistName}`);
      if (row.releaseTitle && !releaseId) throw new Error(`unknown_release_row_${index + 2}:${row.releaseTitle}`);
      return {
        artistId,
        releaseId,
        platform: row.platform,
        metric: row.metric,
        value: row.value,
        capturedOn: row.capturedOn,
        sourceUrl: row.sourceUrl,
      };
    });
    const digest = createHash("sha256").update(content).digest("hex");
    const output = await invokeSourceCapability(
      "integrations.import_metric_snapshots",
      { rows, sourceName: file.name || "metric export" },
      `metric-import:${digest}`,
    ) as { imported?: number };
    imported = output.imported ?? rows.length;
    refreshSourceViews();
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?imported=${imported}`);
}

export async function syncGoogleYouTube() {
  let metricCount = 0;
  try {
    const output = await invokeSourceCapability(
      "integrations.sync_google_youtube",
      {},
      `google-youtube-sync:${new Date().toISOString()}:${randomUUID()}`,
    ) as { metricCount?: number };
    metricCount = output.metricCount ?? 0;
    revalidatePath("/connections");
    revalidatePath("/analytics");
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?synced=youtube&metrics=${metricCount}`);
}

export async function connectApiProvider(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  try {
    if (!new Set(["soundcharts", "kit"]).has(provider)) throw new Error("unsupported_api_provider");
    const primarySecret = String(formData.get("primarySecret") ?? "").trim();
    const secondarySecret = String(formData.get("secondarySecret") ?? "").trim() || null;
    const teamId = String(formData.get("teamId") ?? "").trim() || null;
    const accountLabel = String(formData.get("accountLabel") ?? "").trim() || null;
    if (!primarySecret) throw new Error("provider_primary_secret_required");
    await invokeSourceCapability(
      "integrations.connect_api_provider",
      { provider, primarySecret, secondarySecret, teamId, accountLabel },
      `provider-connect:${provider}:${randomUUID()}`,
    );
    revalidatePath("/connections");
    revalidatePath("/analytics");
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?connected=${encodeURIComponent(provider)}`);
}

export async function syncKit() {
  let metricCount = 0;
  try {
    const output = await invokeSourceCapability(
      "integrations.sync_kit",
      {},
      `kit-sync:${new Date().toISOString()}:${randomUUID()}`,
    ) as { metricCount?: number };
    metricCount = output.metricCount ?? 0;
    refreshSourceViews();
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?synced=kit&metrics=${metricCount}`);
}

export async function syncSoundcharts(formData: FormData) {
  let metricCount = 0;
  try {
    const artistId = String(formData.get("artistId") ?? "");
    if (!artistId) throw new Error("artist_required");
    const output = await invokeSourceCapability(
      "integrations.sync_soundcharts",
      { artistId },
      `soundcharts-sync:${artistId}:${new Date().toISOString()}:${randomUUID()}`,
    ) as { metricCount?: number };
    metricCount = output.metricCount ?? 0;
    refreshSourceViews();
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?synced=soundcharts&metrics=${metricCount}`);
}

export async function saveExternalArtistIdentity(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  try {
    if (!new Set(["musicbrainz", "listenbrainz", "lastfm", "ticketmaster"]).has(provider)) throw new Error("unsupported_identity_provider");
    const artistId = String(formData.get("artistId") ?? "");
    const externalId = String(formData.get("externalId") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim() || null;
    const profileUrl = String(formData.get("profileUrl") ?? "").trim() || null;
    if (!artistId || !externalId) throw new Error("external_identity_required");
    await invokeSourceCapability(
      "integrations.save_external_artist_identity",
      { artistId, provider, externalId, displayName, profileUrl },
      `external-identity:${artistId}:${provider}:${randomUUID()}`,
    );
    refreshSourceViews();
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?saved=${encodeURIComponent(provider)}`);
}

export async function connectFreeApiProvider(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  try {
    if (!new Set(["lastfm", "ticketmaster"]).has(provider)) throw new Error("unsupported_free_api_provider");
    const apiKey = String(formData.get("apiKey") ?? "").trim();
    const accountLabel = String(formData.get("accountLabel") ?? "").trim() || null;
    if (!apiKey) throw new Error("provider_api_key_required");
    await invokeSourceCapability(
      "integrations.connect_free_api_provider",
      { provider, apiKey, accountLabel },
      `free-provider-connect:${provider}:${randomUUID()}`,
    );
    revalidatePath("/connections");
    revalidatePath("/analytics");
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?connected=${encodeURIComponent(provider)}`);
}

async function syncArtistSource(formData: FormData, capability: string, source: string) {
  let metricCount = 0;
  try {
    const artistId = String(formData.get("artistId") ?? "");
    if (!artistId) throw new Error("artist_required");
    const output = await invokeSourceCapability(
      capability,
      { artistId },
      `${source}-sync:${artistId}:${new Date().toISOString()}:${randomUUID()}`,
    ) as { metricCount?: number };
    metricCount = output.metricCount ?? 0;
    refreshSourceViews();
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?synced=${encodeURIComponent(source)}&metrics=${metricCount}`);
}

export async function syncLastFm(formData: FormData) {
  return syncArtistSource(formData, "integrations.sync_lastfm", "lastfm");
}

export async function syncListenBrainz(formData: FormData) {
  return syncArtistSource(formData, "integrations.sync_listenbrainz", "listenbrainz");
}

export async function syncTicketmaster(formData: FormData) {
  return syncArtistSource(formData, "integrations.sync_ticketmaster", "ticketmaster");
}
