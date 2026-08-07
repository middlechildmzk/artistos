import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MusicActivityFeedLoader } from "@/components/music-activity-feed-loader";
import { MusicIntelligenceOverview } from "@/components/music-intelligence-overview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No source date";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "Not enough data";
}

function isStale(value: string | null | undefined, days = 14) {
  if (!value) return true;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return true;
  return Date.now() - parsed.getTime() > days * 24 * 60 * 60 * 1000;
}

export default async function InsightsPage() {
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
  if (!membership) redirect("/dashboard");

  const workspaceId = membership.workspace_id;
  const [
    metricsResult,
    oauthResult,
    profilesResult,
    releasesResult,
    smartLinksResult,
    destinationsResult,
    eventsResult,
    placementsResult,
    evidenceResult,
  ] = await Promise.all([
    supabase
      .from("metric_snapshots")
      .select("id,artist_id,release_id,platform,metric,value,captured_on,source_url")
      .eq("workspace_id", workspaceId)
      .order("captured_on", { ascending: false })
      .limit(5000),
    supabase
      .from("oauth_connections")
      .select("provider,last_success_at,last_error,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("artist_platform_profiles")
      .select("platform_id,connection_state,source_type,last_synced_at,last_verified_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("releases")
      .select("id,title,featured_artist,isrc,release_date,status,artists(name)")
      .eq("workspace_id", workspaceId)
      .order("release_date", { ascending: false }),
    supabase
      .from("smart_links")
      .select("id,release_id,slug,headline,is_active,capture_email,mode")
      .eq("workspace_id", workspaceId),
    supabase
      .from("smart_link_destinations")
      .select("id,smart_link_id,service,url,is_active,position")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    supabase
      .from("link_events")
      .select("id,smart_link_id,event_type,destination_service,utm_source,utm_medium,utm_campaign,referrer,country_code,occurred_at")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(10000),
    supabase
      .from("playlist_placements")
      .select("id,release_id,playlist_name,followers,track_position,added_at,removed_at,verification_state,risk_state,playlist_url,source_type")
      .eq("workspace_id", workspaceId)
      .order("added_at", { ascending: false })
      .limit(1000),
    supabase
      .from("evidence_records")
      .select("id,evidence_type,verification_status,observed_at,summary,source_uri,release_id")
      .eq("workspace_id", workspaceId)
      .order("observed_at", { ascending: false })
      .limit(1000),
  ]);

  const metrics = metricsResult.data ?? [];
  const oauthConnections = oauthResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const smartLinks = smartLinksResult.data ?? [];
  const destinations = destinationsResult.data ?? [];
  const events = eventsResult.data ?? [];
  const placements = placementsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];

  const metricSeries = new Map<string, typeof metrics>();
  for (const metric of metrics) {
    const key = `${metric.artist_id ?? "workspace"}:${metric.release_id ?? "all"}:${metric.platform}:${metric.metric}`;
    const rows = metricSeries.get(key) ?? [];
    rows.push(metric);
    metricSeries.set(key, rows);
  }
  const momentum = Array.from(metricSeries.values()).map((series) => {
    const latest = series[0];
    const previous = series[1] ?? null;
    const currentValue = Number(latest.value);
    const previousValue = previous ? Number(previous.value) : null;
    const delta = previousValue === null ? null : currentValue - previousValue;
    const percent = previousValue && delta !== null ? (delta / Math.abs(previousValue)) * 100 : null;
    return { latest, currentValue, delta, percent };
  }).sort((a, b) => (b.percent ?? b.delta ?? -Infinity) - (a.percent ?? a.delta ?? -Infinity));

  const totalViews = events.filter((event) => event.event_type === "page_view").length;
  const totalClicks = events.filter((event) => event.event_type === "destination_click").length;
  const totalSignups = events.filter((event) => event.event_type === "fan_signup").length;
  const destinationCounts = new Map<string, number>();
  const campaignCounts = new Map<string, number>();
  for (const event of events) {
    if (event.event_type === "destination_click") {
      const key = event.destination_service?.trim() || "unknown";
      destinationCounts.set(key, (destinationCounts.get(key) ?? 0) + 1);
    }
    const campaign = event.utm_campaign?.trim() || event.utm_source?.trim() || event.referrer?.trim();
    if (campaign) campaignCounts.set(campaign, (campaignCounts.get(campaign) ?? 0) + 1);
  }

  const releaseRows = releases.map((release) => {
    const artistRelation = Array.isArray(release.artists) ? release.artists[0] : release.artists;
    const smartLink = smartLinks.find((link) => link.release_id === release.id) ?? null;
    const releaseDestinations = smartLink ? destinations.filter((destination) => destination.smart_link_id === smartLink.id && destination.is_active) : [];
    const releaseEvents = smartLink ? events.filter((event) => event.smart_link_id === smartLink.id) : [];
    const pageViews = releaseEvents.filter((event) => event.event_type === "page_view").length;
    const clicks = releaseEvents.filter((event) => event.event_type === "destination_click").length;
    const signups = releaseEvents.filter((event) => event.event_type === "fan_signup").length;
    const releaseMetrics = metrics.filter((metric) => metric.release_id === release.id);
    const currentPlacements = placements.filter((placement) => placement.release_id === release.id && !placement.removed_at);
    const verifiedPlacements = currentPlacements.filter((placement) => placement.verification_state === "verified");
    const radioSpins = evidence.filter((row) => row.release_id === release.id && row.evidence_type === "soundcharts_radio_spin").length;
    const chartEntries = evidence.filter((row) => row.release_id === release.id && row.evidence_type === "soundcharts_chart_entry").length;
    return {
      release,
      artistName: artistRelation?.name ?? "Artist",
      smartLink,
      releaseDestinations,
      pageViews,
      clicks,
      signups,
      releaseMetrics,
      verifiedPlacements,
      radioSpins,
      chartEntries,
    };
  });

  const verifiedEvidence = evidence.filter((row) => row.verification_status === "verified");
  const importReceipts = evidence.filter((row) => row.evidence_type === "metric_export_import");
  const providerVerified = oauthConnections.filter((connection) => connection.last_success_at && !connection.last_error).length;
  const attentionSources = oauthConnections.filter((connection) => Boolean(connection.last_error) || isStale(connection.last_success_at)).length;
  const publicIdentitySources = new Set(
    profiles
      .filter((profile) => profile.source_type === "public" || profile.connection_state === "identified")
      .map((profile) => profile.platform_id),
  ).size;

  return (
    <>
      <AppHeader active="insights" />
      <main className="shell">
        <header className="app-page-heading">
          <div>
            <div className="eyebrow">Evidence-first music intelligence</div>
            <h1>Insights</h1>
            <p>See where your music is showing up, what is changing, and which observations are verified.</p>
          </div>
          <nav className="section-tabs" aria-label="Insight views">
            <Link className="active" href="/insights">Activity</Link>
            <Link href="/audience">Audience</Link>
            <Link href="/brain">Learning</Link>
          </nav>
        </header>

        <MusicIntelligenceOverview />
        <MusicActivityFeedLoader />

        <section className="grid two-col" style={{ marginBottom: 16 }}>
          <section className="card">
            <div className="section-heading"><div><h2>First-party link performance</h2><p className="muted">Owned ArtistOS Link events, not estimated DSP conversions.</p></div><Link className="next-action" href="/links">Open Links →</Link></div>
            <div className="row"><span>Page views</span><strong>{formatNumber(totalViews)}</strong></div>
            <div className="row"><span>Destination clicks</span><strong>{formatNumber(totalClicks)} · {percentage(totalClicks, totalViews)}</strong></div>
            <div className="row"><span>Fan signups</span><strong>{formatNumber(totalSignups)} · {percentage(totalSignups, totalViews)}</strong></div>
            {destinationCounts.size ? <div className="notice"><strong>Top destinations</strong><p className="muted">{Array.from(destinationCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `${name}: ${count}`).join(" · ")}</p></div> : <div className="empty small">No destination clicks are recorded yet.</div>}
            {campaignCounts.size ? <div className="notice"><strong>Top attributed campaigns</strong><p className="muted">{Array.from(campaignCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `${name}: ${count}`).join(" · ")}</p></div> : null}
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Momentum</h2><p className="muted">Latest source value versus its preceding snapshot. One snapshot remains a baseline, not a trend.</p></div><span className="pill">{momentum.length} series</span></div>
            {momentum.length ? momentum.slice(0, 10).map((signal) => (
              <div className="row" key={`${signal.latest.platform}:${signal.latest.metric}:${signal.latest.release_id ?? "all"}`}>
                <div><strong>{signal.latest.metric.replace(/_/g, " ")}</strong><p className="muted">{signal.latest.platform} · {formatDate(signal.latest.captured_on)}</p></div>
                <div style={{ textAlign: "right" }}><strong>{formatNumber(signal.currentValue)}</strong><p className="muted">{signal.delta === null ? "Baseline only" : `${signal.delta > 0 ? "+" : ""}${formatNumber(signal.delta)}${signal.percent === null ? "" : ` · ${signal.percent.toFixed(1)}%`}`}</p></div>
              </div>
            )) : <div className="empty small">No metric snapshots are available.</div>}
          </section>
        </section>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading"><div><h2>Release intelligence</h2><p className="muted">Track-level placements, radio, charts, source metrics, and first-party outcomes stay attached to the release.</p></div><Link className="next-action" href="/releases">Open releases →</Link></div>
          {releaseRows.length ? releaseRows.map((row) => (
            <article className="row" key={row.release.id} style={{ alignItems: "flex-start" }}>
              <div>
                <strong>{row.release.title}{row.release.featured_artist ? ` (feat. ${row.release.featured_artist})` : ""}</strong>
                <p className="muted">{row.artistName} · {row.release.status} · {formatDate(row.release.release_date)}{row.release.isrc ? ` · ISRC ${row.release.isrc}` : ""}</p>
                <div className="tag-row">
                  <span className="pill">{row.verifiedPlacements.length} placements</span>
                  <span className="pill">{row.radioSpins} radio spins</span>
                  <span className="pill">{row.chartEntries} chart observations</span>
                  <span className="pill">{row.releaseMetrics.length} source metrics</span>
                  <span className={`pill ${row.smartLink?.is_active ? "" : "blocked"}`}>{row.smartLink?.is_active ? "link active" : "link not ready"}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{row.clicks} clicks</strong>
                <p className="muted">{row.pageViews} views · {row.signups} signups</p>
                <Link className="next-action" href={row.smartLink ? `/links#release-${row.release.id}` : "/links"}>{row.smartLink ? "Open release link" : "Create release link"} →</Link>
              </div>
            </article>
          )) : <div className="empty">No releases are available.</div>}
        </section>

        <section className="grid two-col" style={{ marginBottom: 16 }}>
          <section className="card">
            <div className="section-heading"><div><h2>Evidence</h2><p className="muted">Every provider observation remains traceable to Proof.</p></div><Link className="next-action" href="/proof">Open Proof →</Link></div>
            <div className="row"><span>Evidence records</span><strong>{evidence.length}</strong></div>
            <div className="row"><span>Verified evidence</span><strong>{verifiedEvidence.length}</strong></div>
            <div className="row"><span>Metric import receipts</span><strong>{importReceipts.length}</strong></div>
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Data source health</h2><p className="muted">Setup is intentionally secondary to the music intelligence above.</p></div><Link className="next-action" href="/settings">Manage in Settings →</Link></div>
            <div className="row"><span>Provider verified</span><strong>{providerVerified}</strong></div>
            <div className="row"><span>Public identities</span><strong>{publicIdentitySources}</strong></div>
            <div className="row"><span>Sources needing attention</span><strong>{attentionSources}</strong></div>
            <p className="muted">Credentials, OAuth, imports, and provider maintenance live under Settings → Data sources.</p>
          </section>
        </section>
      </main>
    </>
  );
}
