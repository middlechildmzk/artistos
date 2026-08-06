import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SOURCE_COVERAGE, SOURCE_COVERAGE_BY_SLUG } from "@/lib/integrations/source-catalog";
import { deriveIntegrationSourceState, type IntegrationSourceState } from "@/lib/integrations/source-state";
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

function statePillClass(state: IntegrationSourceState) {
  return ["error", "stale", "not_configured"].includes(state) ? "pill blocked" : "pill";
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const OAUTH_SOURCE_SLUG: Record<string, string> = {
  google: "youtube",
  kit: "kit",
  soundcharts: "soundcharts",
  meta: "instagram",
  instagram: "instagram",
  tiktok: "tiktok",
  soundcloud: "soundcloud",
};

const SOURCE_ORDER = [
  "youtube",
  "spotify",
  "apple-music",
  "instagram",
  "tiktok",
  "soundcloud",
  "audius",
  "kit",
  "soundcharts",
  "lastfm",
  "listenbrainz",
  "distrokid",
];

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
    platformsResult,
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
      .select("provider,account_email,last_success_at,last_error,expires_at,scopes,metadata,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("artist_platform_profiles")
      .select("id,platform_id,artist_name,connection_state,source_type,last_synced_at,last_verified_at,freshness_status,profile_url")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("music_platforms")
      .select("id,slug,name,category,priority")
      .eq("active", true),
    supabase
      .from("releases")
      .select("id,title,featured_artist,release_date,status,artists(name)")
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
      .select("id,release_id,playlist_name,followers,track_position,added_at,removed_at,verification_state,risk_state,playlist_url")
      .eq("workspace_id", workspaceId)
      .order("added_at", { ascending: false })
      .limit(1000),
    supabase
      .from("evidence_records")
      .select("id,evidence_type,verification_status,observed_at,summary,source_uri")
      .eq("workspace_id", workspaceId)
      .order("observed_at", { ascending: false })
      .limit(500),
  ]);

  const metrics = metricsResult.data ?? [];
  const oauthConnections = oauthResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const platforms = platformsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const smartLinks = smartLinksResult.data ?? [];
  const destinations = destinationsResult.data ?? [];
  const events = eventsResult.data ?? [];
  const placements = placementsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];

  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const profilesBySlug = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const slug = platformById.get(profile.platform_id)?.slug;
    if (!slug) continue;
    const rows = profilesBySlug.get(slug) ?? [];
    rows.push(profile);
    profilesBySlug.set(slug, rows);
  }

  const metricsBySlug = new Map<string, typeof metrics>();
  for (const metric of metrics) {
    const slug = metric.platform.replace(/_/g, "-").toLowerCase();
    const rows = metricsBySlug.get(slug) ?? [];
    rows.push(metric);
    metricsBySlug.set(slug, rows);
  }

  const oauthBySlug = new Map<string, (typeof oauthConnections)[number]>();
  for (const connection of oauthConnections) {
    const slug = OAUTH_SOURCE_SLUG[connection.provider] ?? connection.provider;
    if (!oauthBySlug.has(slug)) oauthBySlug.set(slug, connection);
  }

  const sourceSlugs = Array.from(new Set([
    ...SOURCE_ORDER,
    ...SOURCE_COVERAGE.map((source) => source.slug),
    ...Array.from(metricsBySlug.keys()),
    ...Array.from(profilesBySlug.keys()),
    ...Array.from(oauthBySlug.keys()),
  ]));

  const sourceRows = sourceSlugs.map((slug) => {
    const catalog = SOURCE_COVERAGE_BY_SLUG.get(slug);
    const sourceMetrics = metricsBySlug.get(slug) ?? [];
    const sourceProfiles = profilesBySlug.get(slug) ?? [];
    const oauth = oauthBySlug.get(slug) ?? null;
    const metadata = objectMetadata(oauth?.metadata);
    const latestMetric = sourceMetrics[0] ?? null;
    const latestProfileEvidence = sourceProfiles
      .map((profile) => profile.last_synced_at ?? profile.last_verified_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const publicIdentities = sourceProfiles.filter((profile) => profile.source_type === "public" || profile.connection_state === "identified");
    const connectedProfiles = sourceProfiles.filter((profile) => profile.connection_state === "connected");
    const connectedProfileSuccess = connectedProfiles
      .map((profile) => profile.last_synced_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const youtubeChannelId = slug === "youtube" ? metadataString(metadata, "youtube_channel_id") : null;
    const sourceSpecificSuccess = slug === "youtube"
      ? (youtubeChannelId ? oauth?.last_success_at ?? null : null)
      : oauth?.last_success_at ?? connectedProfileSuccess;
    const sourceSpecificError = slug === "youtube"
      ? metadataString(metadata, "youtube_error") ?? oauth?.last_error ?? null
      : oauth?.last_error ?? null;
    const latestSnapshotOn = latestMetric?.captured_on ?? latestProfileEvidence;
    const state = deriveIntegrationSourceState({
      configured: Boolean(oauth),
      authorized: Boolean(oauth),
      lastSuccessAt: sourceSpecificSuccess,
      lastError: sourceSpecificError,
      snapshotCount: sourceMetrics.length,
      latestSnapshotOn,
      profileCount: sourceProfiles.length,
      connectedProfileCount: connectedProfiles.length,
      publicIdentityCount: publicIdentities.length,
      staleAfterDays: 14,
    });
    return { slug, catalog, sourceMetrics, sourceProfiles, oauth, state };
  }).sort((a, b) => {
    const aIndex = SOURCE_ORDER.indexOf(a.slug);
    const bIndex = SOURCE_ORDER.indexOf(b.slug);
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    return (a.catalog?.label ?? a.slug).localeCompare(b.catalog?.label ?? b.slug);
  });

  const providerVerified = sourceRows.filter((source) => source.state.state === "verified").length;
  const importedSources = sourceRows.filter((source) => source.state.state === "imported").length;
  const publicIdentitySources = sourceRows.filter((source) => source.state.state === "public_identity").length;
  const attentionSources = sourceRows.filter((source) => ["error", "stale"].includes(source.state.state)).length;

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
    const releasePlacements = placements.filter((placement) => placement.release_id === release.id && !placement.removed_at);
    const verifiedPlacements = releasePlacements.filter((placement) => placement.verification_state === "verified");
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
    };
  });

  const importReceipts = evidence.filter((row) => row.evidence_type === "metric_export_import");
  const verifiedEvidence = evidence.filter((row) => row.verification_status === "verified");
  const activeSources = sourceRows.filter((source) => source.state.state !== "not_configured");
  const sourceGaps = sourceRows.filter((source) => ["not_configured", "configured", "authorized", "stale", "error"].includes(source.state.state));

  return (
    <>
      <AppHeader active="insights" />
      <main className="shell">
        <header className="app-page-heading">
          <div>
            <div className="eyebrow">Evidence-first music intelligence</div>
            <h1>Insights</h1>
            <p>See what is moving, where each number came from, how fresh it is and what ArtistOS still does not know.</p>
          </div>
          <nav className="section-tabs" aria-label="Insight views">
            <Link className="active" href="/insights">Performance</Link>
            <Link href="/audience">Audience</Link>
            <Link href="/brain">Learning</Link>
          </nav>
        </header>

        <section className="grid stats" style={{ marginBottom: 16 }}>
          <div className="card"><div className="eyebrow">Provider verified</div><div className="stat-value">{providerVerified}</div><p className="muted">Successful source-specific request</p></div>
          <div className="card"><div className="eyebrow">Imported sources</div><div className="stat-value">{importedSources}</div><p className="muted">Export or public observation</p></div>
          <div className="card"><div className="eyebrow">Public identities</div><div className="stat-value">{publicIdentitySources}</div><p className="muted">Mapped profile, not private analytics</p></div>
          <div className="card"><div className="eyebrow">Needs attention</div><div className="stat-value">{attentionSources}</div><p className="muted">Stale source or recorded failure</p></div>
        </section>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading">
            <div><h2>Source truth</h2><p className="muted">Configured, authorized and provider verified are separate states. Public profile mapping never becomes private analytics.</p></div>
            <Link className="next-action" href="/connections">Manage connections →</Link>
          </div>
          {activeSources.length ? <div className="grid two-col">
            {activeSources.map((source) => (
              <article className="notice" key={source.slug}>
                <div className="section-heading tight">
                  <div><div className="eyebrow">{source.catalog?.connection?.replace(/_/g, " ") ?? "observed source"}</div><h3>{source.catalog?.label ?? source.slug}</h3></div>
                  <span className={statePillClass(source.state.state)}>{source.state.label}</span>
                </div>
                <p className="muted">{source.state.detail}</p>
                <div className="row"><span>As of</span><strong>{formatDate(source.state.asOf)}</strong></div>
                <div className="row"><span>Metric snapshots</span><strong>{source.sourceMetrics.length}</strong></div>
                <div className="row"><span>Mapped profiles</span><strong>{source.sourceProfiles.length}</strong></div>
                {source.oauth?.account_email ? <div className="row"><span>Authorized account</span><strong>{source.oauth.account_email}</strong></div> : null}
                {source.catalog?.limitation ? <p className="muted">Limit: {source.catalog.limitation}</p> : null}
              </article>
            ))}
          </div> : <div className="empty">No external source identity, import or connection exists yet.</div>}
        </section>

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
            <div className="section-heading"><div><h2>Momentum</h2><p className="muted">Latest source value versus its preceding snapshot. One snapshot cannot create a trend.</p></div><span className="pill">{momentum.length} series</span></div>
            {momentum.length ? momentum.slice(0, 12).map((signal) => (
              <div className="row" key={`${signal.latest.platform}:${signal.latest.metric}:${signal.latest.release_id ?? "all"}`}>
                <div><strong>{signal.latest.metric.replace(/_/g, " ")}</strong><p className="muted">{signal.latest.platform} · {formatDate(signal.latest.captured_on)}</p></div>
                <div style={{ textAlign: "right" }}><strong>{formatNumber(signal.currentValue)}</strong><p className="muted">{signal.delta === null ? "Baseline only" : `${signal.delta > 0 ? "+" : ""}${formatNumber(signal.delta)}${signal.percent === null ? "" : ` · ${signal.percent.toFixed(1)}%`}`}</p></div>
              </div>
            )) : <div className="empty small">No metric snapshots are available.</div>}
          </section>
        </section>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading"><div><h2>Release intelligence</h2><p className="muted">Smart-link readiness, source metrics and verified placements stay attached to the release.</p></div><Link className="next-action" href="/releases">Open releases →</Link></div>
          {releaseRows.length ? releaseRows.map((row) => (
            <article className="row" key={row.release.id} style={{ alignItems: "flex-start" }}>
              <div>
                <strong>{row.release.title}{row.release.featured_artist ? ` (feat. ${row.release.featured_artist})` : ""}</strong>
                <p className="muted">{row.artistName} · {row.release.status} · {formatDate(row.release.release_date)}</p>
                <div className="tag-row">
                  <span className={`pill ${row.smartLink?.is_active ? "" : "blocked"}`}>{row.smartLink?.is_active ? "link active" : "link not ready"}</span>
                  <span className={`pill ${row.releaseDestinations.length >= 3 ? "" : "blocked"}`}>{row.releaseDestinations.length} destinations</span>
                  <span className="pill">{row.releaseMetrics.length} metric snapshots</span>
                  <span className="pill">{row.verifiedPlacements.length} verified placements</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{row.clicks} clicks</strong>
                <p className="muted">{row.pageViews} views · {row.signups} signups</p>
                <Link className="next-action" href={row.smartLink ? `/links#release-${row.release.id}` : "/links"}>{row.smartLink ? "Improve link" : "Create link"} →</Link>
              </div>
            </article>
          )) : <div className="empty">No releases are available.</div>}
        </section>

        <section className="grid two-col" style={{ marginBottom: 16 }}>
          <section className="card">
            <div className="section-heading"><div><h2>Evidence coverage</h2><p className="muted">Receipts keep imported observations and verified claims reviewable.</p></div><Link className="next-action" href="/proof">Open Proof →</Link></div>
            <div className="row"><span>Evidence records</span><strong>{evidence.length}</strong></div>
            <div className="row"><span>Verified evidence</span><strong>{verifiedEvidence.length}</strong></div>
            <div className="row"><span>Metric import receipts</span><strong>{importReceipts.length}</strong></div>
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Next data actions</h2><p className="muted">Close high-value gaps before adding another generic dashboard.</p></div></div>
            {sourceGaps.slice(0, 6).map((source) => (
              <div className="row" key={source.slug}><div><strong>{source.catalog?.label ?? source.slug}</strong><p className="muted">{source.state.detail}</p></div><Link className="next-action" href="/connections">Resolve →</Link></div>
            ))}
            {!sourceGaps.length ? <div className="empty small">No connection gaps are currently detected.</div> : null}
          </section>
        </section>
      </main>
    </>
  );
}
