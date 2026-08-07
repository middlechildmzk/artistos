import Link from "next/link";
import { redirect } from "next/navigation";
import { syncSoundchartsReleasePilot } from "@/app/connections/soundcharts-release-pilot-actions";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./music-intelligence-overview.module.css";

type TrendPoint = { date: string; value: number };
type PlacementRow = {
  id: string;
  release_id: string | null;
  playlist_name: string;
  playlist_url: string | null;
  followers: number | null;
  track_position: number | null;
  added_at: string | null;
  removed_at: string | null;
  last_activity_at: string | null;
  last_verified_at: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compactNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
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
  }).format(parsed);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }).format(parsed);
}

function dateKey(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = Number(metadata[key]);
  return Number.isFinite(value) ? value : null;
}

function latestMetricValue(rows: Array<{ metric: string; value: number | string }>, metric: string) {
  const row = rows.find((item) => item.metric === metric);
  if (!row) return null;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : null;
}

function buildPlacementSeries(releaseDate: string | null, placements: PlacementRow[]): TrendPoint[] {
  const changes = new Map<string, number>();
  const releaseKey = dateKey(releaseDate);
  if (releaseKey) changes.set(releaseKey, 0);
  for (const placement of placements) {
    const added = dateKey(placement.added_at);
    if (added) changes.set(added, (changes.get(added) ?? 0) + 1);
    const removed = dateKey(placement.removed_at);
    if (removed) changes.set(removed, (changes.get(removed) ?? 0) - 1);
  }
  let total = 0;
  return [...changes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, delta]) => {
      total = Math.max(0, total + delta);
      return { date, value: total };
    });
}

function metricSeries(rows: Array<{ metric: string; value: number | string; captured_on: string; release_id: string | null }>, releaseId: string, metric: string): TrendPoint[] {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (row.release_id !== releaseId || row.metric !== metric) continue;
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    byDate.set(row.captured_on, value);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

function TrendChart({
  id,
  title,
  eyebrow,
  points,
  valueLabel,
  emptyText,
  green = false,
}: {
  id: string;
  title: string;
  eyebrow: string;
  points: TrendPoint[];
  valueLabel: string;
  emptyText: string;
  green?: boolean;
}) {
  const latest = points.at(-1)?.value ?? null;
  if (!points.length) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><div className="eyebrow">{eyebrow}</div><h3 className={styles.panelTitle}>{title}</h3></div>
          <div className={styles.panelMetric}><strong>—</strong><span>{valueLabel}</span></div>
        </div>
        <div className={styles.emptyChart}>{emptyText}</div>
      </section>
    );
  }

  const width = 640;
  const height = 220;
  const left = 32;
  const right = 16;
  const top = 20;
  const bottom = 30;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = Math.max(1, max - min);
  const x = (index: number) => left + (points.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (points.length - 1));
  const y = (value: number) => top + (max - value) * (height - top - bottom) / range;
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const area = `${left},${height - bottom} ${line} ${x(points.length - 1)},${height - bottom}`;
  const first = points[0];
  const middle = points[Math.floor((points.length - 1) / 2)];
  const last = points.at(-1)!;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><div className="eyebrow">{eyebrow}</div><h3 className={styles.panelTitle}>{title}</h3></div>
        <div className={styles.panelMetric}><strong>{compactNumber(latest)}</strong><span>{valueLabel}</span></div>
      </div>
      <div className={styles.chartWrap}>
        <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} trend`}>
          <defs>
            <linearGradient id={`${id}Area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={green ? "#55d7a0" : "#8a72ff"} stopOpacity="0.28" />
              <stop offset="100%" stopColor={green ? "#55d7a0" : "#8a72ff"} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((step) => {
            const gridY = top + step * (height - top - bottom) / 3;
            return <line className={styles.gridLine} key={step} x1={left} x2={width - right} y1={gridY} y2={gridY} />;
          })}
          <polygon points={area} fill={`url(#${id}Area)`} />
          <polyline className={`${styles.line} ${green ? styles.lineGreen : ""}`} points={line} />
          {points.map((point, index) => <circle className={`${styles.dot} ${green ? styles.dotGreen : ""}`} key={`${point.date}:${point.value}`} cx={x(index)} cy={y(point.value)} r="4"><title>{formatDate(point.date)}: {compactNumber(point.value)}</title></circle>)}
          <text className={styles.axisLabel} x={left} y={height - 8}>{formatDate(first.date)}</text>
          {points.length > 2 ? <text className={styles.axisLabel} x={x(Math.floor((points.length - 1) / 2))} y={height - 8} textAnchor="middle">{formatDate(middle.date)}</text> : null}
          <text className={styles.axisLabel} x={width - right} y={height - 8} textAnchor="end">{formatDate(last.date)}</text>
        </svg>
      </div>
    </section>
  );
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
      .limit(1000),
    supabase
      .from("playlist_placements")
      .select("id,release_id,playlist_name,playlist_url,followers,track_position,added_at,removed_at,last_activity_at,last_verified_at")
      .eq("workspace_id", workspaceId)
      .eq("source_type", "licensed")
      .order("last_activity_at", { ascending: false })
      .limit(500),
    supabase
      .from("evidence_records")
      .select("id,release_id,evidence_type,observed_at,summary,source_uri,metadata")
      .eq("workspace_id", workspaceId)
      .in("evidence_type", ["soundcharts_artist_sync", "soundcharts_release_pilot_sync", "soundcharts_radio_spin", "soundcharts_chart_entry"])
      .order("observed_at", { ascending: false })
      .limit(500),
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

  const neverAlone = releases.find((release) => release.title.toLowerCase() === "never alone")
    ?? releases.find((release) => Boolean(release.isrc))
    ?? releases[0]
    ?? null;
  const releasePlacements = neverAlone ? placements.filter((placement) => placement.release_id === neverAlone.id) : [];
  const activePlacements = releasePlacements.filter((placement) => !placement.removed_at);
  const removedPlacements = releasePlacements.filter((placement) => Boolean(placement.removed_at));
  const recentPlacements = [...releasePlacements]
    .filter((placement) => placement.added_at)
    .sort((a, b) => String(b.added_at).localeCompare(String(a.added_at)));
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const newAdds7d = activePlacements.filter((placement) => placement.added_at && new Date(placement.added_at).getTime() >= sevenDaysAgo).length;
  const bestPosition = activePlacements
    .map((placement) => Number(placement.track_position))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)[0] ?? null;

  const instagramFollowers = latestMetricValue(artistMetrics, "instagram_audience_follower_count");
  const youtubeFollowers = latestMetricValue(artistMetrics, "youtube_audience_follower_count");
  const artistPlaylistEntries = latestMetricValue(artistMetrics, "spotify_playlist_entries");
  const lastEndpointErrors = asObject(metadata.last_endpoint_errors);
  const artistSyncHealthy = connected && connection?.last_success_at && !connection.last_error && Object.keys(lastEndpointErrors).length === 0;

  const lastReleasePilot = evidence.find((row) => row.evidence_type === "soundcharts_release_pilot_sync" && (!neverAlone || row.release_id === neverAlone.id)) ?? null;
  const lastPilotMetadata = asObject(lastReleasePilot?.metadata);
  const radio = neverAlone ? evidence.filter((row) => row.release_id === neverAlone.id && row.evidence_type === "soundcharts_radio_spin") : [];
  const charts = neverAlone ? evidence.filter((row) => row.release_id === neverAlone.id && row.evidence_type === "soundcharts_chart_entry") : [];
  const availableEndpoints = metadataNumber(lastPilotMetadata, "endpoint_available_count");
  const failedEndpoints = metadataNumber(lastPilotMetadata, "endpoint_failed_count");

  const playlistGrowth = neverAlone ? buildPlacementSeries(neverAlone.release_date, releasePlacements) : [];
  const reachGrowth = neverAlone ? metricSeries(metrics, neverAlone.id, "spotify_playlist_reach") : [];
  const latestReach = reachGrowth.at(-1)?.value ?? null;

  if (!connected) {
    return (
      <section className={styles.dashboard}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div><div className="eyebrow">Music intelligence</div><h2 className={styles.releaseTitle}>Connect your first live intelligence source</h2><p className={styles.subtle}>Insights stays focused on outcomes. Credentials and provider setup live under Settings → Data sources.</p></div>
            <Link className="button primary" href="/connections">Manage data sources</Link>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.context}>
              <div className={styles.releaseMark}>MC</div>
              <div>
                <div className="eyebrow">Release intelligence</div>
                <h2 className={styles.releaseTitle}>{neverAlone?.title ?? "Middle Child"}</h2>
                <p className={styles.subtle}>{neverAlone?.isrc ? `ISRC ${neverAlone.isrc} · ` : ""}{activePlacements.length} active tracked playlists</p>
              </div>
            </div>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.status}>{artistSyncHealthy ? "Soundcharts verified" : "Soundcharts connected"}</span>
            <Link className={styles.manageLink} href="/settings">Data sources</Link>
          </div>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}><div className={styles.kpiLabel}>Active playlists</div><div className={styles.kpiValue}>{compactNumber(activePlacements.length)}</div><p className={styles.kpiNote}>Track-level placements currently stored</p></div>
          <div className={styles.kpi}><div className={styles.kpiLabel}>New adds · 7d</div><div className={styles.kpiValue}>{compactNumber(newAdds7d)}</div><p className={styles.kpiNote}>Based on observed playlist entry dates</p></div>
          <div className={styles.kpi}><div className={styles.kpiLabel}>Best playlist position</div><div className={styles.kpiValue}>{bestPosition ? `#${bestPosition}` : "—"}</div><p className={styles.kpiNote}>Best current stored position</p></div>
          <div className={styles.kpi}><div className={styles.kpiLabel}>Total playlist reach</div><div className={styles.kpiValue}>{compactNumber(latestReach)}</div><p className={styles.kpiNote}>{latestReach === null ? "Reach history not normalized yet" : "Soundcharts playlistReach, not unique listeners"}</p></div>
          <div className={styles.kpi}><div className={styles.kpiLabel}>Radio spins</div><div className={styles.kpiValue}>{compactNumber(radio.length)}</div><p className={styles.kpiNote}>{charts.length} chart observations stored</p></div>
        </div>
      </section>

      <div className={styles.chartGrid}>
        <TrendChart
          id="playlistGrowth"
          eyebrow="Spotify playlist growth"
          title="Number of playlists"
          points={playlistGrowth}
          valueLabel="active/tracked"
          emptyText="Playlist history will appear after track-level placements are observed."
        />
        <TrendChart
          id="reachGrowth"
          eyebrow="Spotify playlist reach"
          title="Total playlist followers / reach"
          points={reachGrowth}
          valueLabel="playlistReach"
          green
          emptyText="Soundcharts exposes a playlistReach time series. ArtistOS will graph it here as soon as the normalized reach series is stored on the next track-level refresh."
        />
      </div>

      <div className={styles.activityGrid}>
        <section className={`${styles.panel} ${styles.tablePanel}`}>
          <div className={styles.tableHeader}>
            <div><div className="eyebrow">Placement activity</div><h3>Recent playlist adds</h3><p className={styles.subtle}>The concrete list behind the chart, ordered by observed entry date.</p></div>
            <span className={styles.countBadge}>{activePlacements.length}</span>
          </div>
          {recentPlacements.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.placementTable}>
                <thead><tr><th>Playlist</th><th>Position</th><th>Added</th><th>Audience</th></tr></thead>
                <tbody>
                  {recentPlacements.slice(0, 12).map((placement) => {
                    const isNew = Boolean(placement.added_at && new Date(placement.added_at).getTime() >= sevenDaysAgo);
                    return (
                      <tr key={placement.id}>
                        <td><div className={styles.playlistName}><span className={styles.spotifyDot} />{placement.playlist_url ? <a href={placement.playlist_url} target="_blank" rel="noreferrer">{placement.playlist_name}</a> : <span>{placement.playlist_name}</span>}{isNew ? <span className={styles.newBadge}>new</span> : null}</div></td>
                        <td className={styles.position}>{placement.track_position ? `#${placement.track_position}` : "—"}</td>
                        <td className={styles.dateCell}>{formatDate(placement.added_at)}</td>
                        <td>{placement.followers ? compactNumber(placement.followers) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className={styles.zeroState}>No playlist placements have been observed for this release yet.</div>}
          {removedPlacements.length ? <div className={styles.zeroState}>{removedPlacements.length} removed playlist placements are also retained in the activity ledger.</div> : null}
        </section>

        <div className={styles.sideStack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><div className="eyebrow">Audience footprint</div><h3 className={styles.panelTitle}>Cross-platform audience</h3></div></div>
            <div className={styles.audienceRows}>
              <div className={styles.audienceRow}><span className={styles.platformIcon}>IG</span><div><strong>Instagram</strong><p className={styles.subtle}>Soundcharts audience</p></div><span className={styles.audienceValue}>{compactNumber(instagramFollowers)}</span></div>
              <div className={styles.audienceRow}><span className={styles.platformIcon}>YT</span><div><strong>YouTube</strong><p className={styles.subtle}>Soundcharts audience</p></div><span className={styles.audienceValue}>{compactNumber(youtubeFollowers)}</span></div>
              <div className={styles.audienceRow}><span className={styles.platformIcon}>SP</span><div><strong>Artist playlists</strong><p className={styles.subtle}>Latest API page</p></div><span className={styles.audienceValue}>{compactNumber(artistPlaylistEntries)}</span></div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><div className="eyebrow">Source health</div><h3 className={styles.panelTitle}>Soundcharts</h3></div><span className={styles.countBadge}>{availableEndpoints ?? 0} endpoints</span></div>
            <div className={styles.syncBox}>
              <div className={styles.syncRow}><span>Last successful sync</span><strong>{formatDateTime(connection?.last_success_at)}</strong></div>
              <div className={styles.syncRow}><span>Track-level scan</span><strong>{lastReleasePilot ? formatDateTime(lastReleasePilot.observed_at) : "Not yet"}</strong></div>
              <div className={styles.syncRow}><span>Endpoint failures</span><strong>{failedEndpoints ?? 0}</strong></div>
              <div className={styles.syncRow}><span>Radio / charts</span><strong>{radio.length} / {charts.length}</strong></div>
              {neverAlone?.isrc ? (
                <form action={syncSoundchartsReleasePilot}>
                  <input type="hidden" name="releaseId" value={neverAlone.id} />
                  <button className={`button primary ${styles.syncAction}`} type="submit">Refresh {neverAlone.title}</button>
                </form>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}