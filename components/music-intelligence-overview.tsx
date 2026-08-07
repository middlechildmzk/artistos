import Link from "next/link";
import { redirect } from "next/navigation";
import { syncSoundchartsReleasePilot } from "@/app/connections/soundcharts-release-pilot-actions";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not observed";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(parsed);
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = Number(metadata[key]);
  return Number.isFinite(value) ? value : null;
}

function metricValue(rows: Array<{ metric: string; value: number | string }>, metric: string) {
  const row = rows.find((item) => item.metric === metric);
  if (!row) return null;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : null;
}

export async function MusicIntelligenceOverview() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const workspaceId = membership.workspace_id;
  const [connectionResult, releasesResult, metricsResult, placementsResult, evidenceResult] = await Promise.all([
    supabase
      .from("oauth_connections")
      .select("last_success_at,last_error,metadata,encrypted_access_token,encrypted_refresh_token")
      .eq("workspace_id", workspaceId)
      .eq("user_id", auth.user.id)
      .eq("provider", "soundcharts")
      .maybeSingle(),
    supabase
      .from("releases")
      .select("id,title,isrc,release_date,status")
      .eq("workspace_id", workspaceId)
      .order("release_date", { ascending: false }),
    supabase
      .from("metric_snapshots")
      .select("metric,value,captured_on,release_id")
      .eq("workspace_id", workspaceId)
      .eq("platform", "soundcharts")
      .order("captured_on", { ascending: false })
      .limit(250),
    supabase
      .from("playlist_placements")
      .select("id,release_id,playlist_name,playlist_url,followers,track_position,added_at,last_verified_at,source_type,verification_state")
      .eq("workspace_id", workspaceId)
      .eq("source_type", "licensed")
      .order("last_verified_at", { ascending: false })
      .limit(100),
    supabase
      .from("evidence_records")
      .select("id,release_id,evidence_type,observed_at,summary,source_uri,metadata")
      .eq("workspace_id", workspaceId)
      .in("evidence_type", ["soundcharts_artist_sync", "soundcharts_release_pilot_sync", "soundcharts_radio_spin", "soundcharts_chart_entry"])
      .order("observed_at", { ascending: false })
      .limit(250),
  ]);

  const connection = connectionResult.data;
  const releases = releasesResult.data ?? [];
  const metrics = (metricsResult.data ?? []).map((row) => ({ ...row, value: row.value as number | string }));
  const placements = placementsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];
  const connected = Boolean(connection)
    && isCurrentTokenEnvelope(connection?.encrypted_access_token)
    && isCurrentTokenEnvelope(connection?.encrypted_refresh_token);
  const metadata = asObject(connection?.metadata);

  const artistMetrics = metrics.filter((row) => !row.release_id);
  const playlistEntries = metricValue(artistMetrics, "spotify_playlist_entries");
  const instagramFollowers = metricValue(artistMetrics, "instagram_audience_follower_count");
  const youtubeFollowers = metricValue(artistMetrics, "youtube_audience_follower_count");
  const artistObservationCount = metadataNumber(metadata, "last_metric_count");
  const lastEndpointErrors = asObject(metadata.last_endpoint_errors);
  const artistSyncHealthy = connected && connection?.last_success_at && !connection.last_error && Object.keys(lastEndpointErrors).length === 0;

  const lastReleasePilot = evidence.find((row) => row.evidence_type === "soundcharts_release_pilot_sync") ?? null;
  const lastPilotMetadata = asObject(lastReleasePilot?.metadata);
  const lastReleaseId = lastReleasePilot?.release_id ?? (typeof metadata.release_pilot_release_id === "string" ? metadata.release_pilot_release_id : null);
  const lastRelease = releases.find((release) => release.id === lastReleaseId) ?? null;
  const pilotPlaylistCount = metadataNumber(lastPilotMetadata, "playlist_count");
  const pilotRadioCount = metadataNumber(lastPilotMetadata, "radio_spin_count");
  const pilotChartCount = metadataNumber(lastPilotMetadata, "chart_count");
  const pilotMetricCount = metadataNumber(lastPilotMetadata, "metric_count");
  const endpointAvailableCount = metadataNumber(lastPilotMetadata, "endpoint_available_count");
  const endpointUnavailableCount = metadataNumber(lastPilotMetadata, "endpoint_unavailable_count");
  const endpointFailedCount = metadataNumber(lastPilotMetadata, "endpoint_failed_count");

  const neverAlone = releases.find((release) => release.title.toLowerCase() === "never alone")
    ?? releases.find((release) => Boolean(release.isrc))
    ?? null;
  const neverAlonePlacements = neverAlone ? placements.filter((placement) => placement.release_id === neverAlone.id) : [];
  const neverAloneRadio = neverAlone ? evidence.filter((row) => row.release_id === neverAlone.id && row.evidence_type === "soundcharts_radio_spin") : [];
  const neverAloneCharts = neverAlone ? evidence.filter((row) => row.release_id === neverAlone.id && row.evidence_type === "soundcharts_chart_entry") : [];

  return (
    <section className="card stack" style={{ marginBottom: 16 }}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">Latest music intelligence</div>
          <h2>What is happening with your music</h2>
          <p className="muted">Actual observed activity first. Provider setup stays in Settings.</p>
        </div>
        <div className="tag-row">
          <span className={`pill ${artistSyncHealthy ? "" : "blocked"}`}>{artistSyncHealthy ? "Soundcharts verified" : connected ? "Soundcharts needs attention" : "Soundcharts not connected"}</span>
          <Link className="next-action" href="/settings">Data sources →</Link>
        </div>
      </div>

      {connected ? (
        <>
          <div className="grid stats">
            <div className="card">
              <div className="eyebrow">Spotify playlist entries returned</div>
              <div className="stat-value compact">{formatNumber(playlistEntries)}</div>
              <p className="muted">Latest artist-level Soundcharts request. Current request is capped at 100 rows.</p>
            </div>
            <div className="card">
              <div className="eyebrow">Instagram audience</div>
              <div className="stat-value compact">{formatNumber(instagramFollowers)}</div>
              <p className="muted">Followers observed by Soundcharts.</p>
            </div>
            <div className="card">
              <div className="eyebrow">YouTube audience</div>
              <div className="stat-value compact">{formatNumber(youtubeFollowers)}</div>
              <p className="muted">Followers observed by Soundcharts.</p>
            </div>
            <div className="card">
              <div className="eyebrow">Last provider sync</div>
              <strong>{formatDateTime(connection?.last_success_at)}</strong>
              <p className="muted">{artistObservationCount ?? artistMetrics.length} entitled observations stored.</p>
            </div>
          </div>

          {lastReleasePilot ? (
            <div className="notice">
              <div className="section-heading tight">
                <div>
                  <strong>{lastRelease?.title ?? "Latest release"} track-level scan</strong>
                  <p className="muted">ISRC-level Soundcharts observations · {formatDateTime(lastReleasePilot.observed_at)}</p>
                </div>
                <span className={`pill ${endpointFailedCount ? "blocked" : ""}`}>{endpointAvailableCount ?? 0} endpoints available</span>
              </div>
              <div className="grid stats">
                <div><div className="eyebrow">Playlist placements</div><strong>{pilotPlaylistCount ?? 0}</strong></div>
                <div><div className="eyebrow">Radio spins</div><strong>{pilotRadioCount ?? 0}</strong></div>
                <div><div className="eyebrow">Chart observations</div><strong>{pilotChartCount ?? 0}</strong></div>
                <div><div className="eyebrow">Release metrics</div><strong>{pilotMetricCount ?? 0}</strong></div>
              </div>
              {endpointUnavailableCount || endpointFailedCount ? <p className="muted">{endpointUnavailableCount ?? 0} endpoint families were unavailable for this account and {endpointFailedCount ?? 0} failed.</p> : null}
            </div>
          ) : neverAlone?.isrc ? (
            <div className="notice">
              <div className="section-heading tight">
                <div>
                  <strong>Artist sync complete. Track-level activity is the next scan.</strong>
                  <p className="muted">Run one ISRC-level scan for {neverAlone.title} to populate exact playlist names, radio spins, chart appearances, and release-scoped metrics.</p>
                </div>
                <span className="pill">ISRC {neverAlone.isrc}</span>
              </div>
              <form action={syncSoundchartsReleasePilot}>
                <input type="hidden" name="releaseId" value={neverAlone.id} />
                <button className="button primary" type="submit">Scan {neverAlone.title} activity</button>
              </form>
              <p className="muted">This uses the Soundcharts production API allowance and writes normalized observations plus Proof receipts. It does not purchase a plan.</p>
            </div>
          ) : null}

          {(neverAlonePlacements.length || neverAloneRadio.length || neverAloneCharts.length) ? (
            <div className="grid two-col">
              <div className="notice">
                <strong>Recent placements</strong>
                {neverAlonePlacements.slice(0, 5).map((placement) => (
                  <div className="row" key={placement.id}>
                    <div><strong>{placement.playlist_name}</strong><p className="muted">{placement.followers ? `${new Intl.NumberFormat("en-US").format(placement.followers)} followers` : "Reach not reported"}{placement.track_position ? ` · position ${placement.track_position}` : ""}</p></div>
                    {placement.playlist_url ? <a className="next-action" href={placement.playlist_url} target="_blank" rel="noreferrer">Open ↗</a> : null}
                  </div>
                ))}
              </div>
              <div className="notice">
                <strong>Radio and charts</strong>
                {[...neverAloneRadio, ...neverAloneCharts].slice(0, 5).map((row) => (
                  <div className="row" key={row.id}><div><strong>{row.summary}</strong><p className="muted">{formatDateTime(row.observed_at)}</p></div>{row.source_uri ? <a className="next-action" href={row.source_uri} target="_blank" rel="noreferrer">Source ↗</a> : null}</div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="notice">
          <strong>No live music-intelligence provider is verified yet.</strong>
          <p className="muted">Keep Insights focused on outcomes. Provider credentials and setup live under Settings → Data sources.</p>
          <Link className="button primary" href="/connections">Manage data sources</Link>
        </div>
      )}
    </section>
  );
}
