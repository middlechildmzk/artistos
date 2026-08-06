import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addMetric } from "../intelligence/actions";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "Not enough data" : `${value.toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTrend(current: number, previous: number | null) {
  if (previous === null) return { delta: null, percent: null };
  const delta = current - previous;
  const percent = previous === 0 ? null : (delta / Math.abs(previous)) * 100;
  return { delta, percent };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  const value = key?.trim() || "unknown";
  map.set(value, (map.get(value) ?? 0) + 1);
}

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const workspaceId = membership.workspace_id;
  const [
    metricsResult,
    artistsResult,
    releasesResult,
    outcomesResult,
    interactionsResult,
    campaignsResult,
    oauthResult,
    profilesResult,
    platformsResult,
    linkEventsResult,
    smartLinksResult,
    placementsResult,
    totalFansResult,
    contactableFansResult,
    linkFansResult,
    consentsResult,
    campaignTargetsResult,
    evidenceResult,
  ] = await Promise.all([
    supabase.from("metric_snapshots").select("id,artist_id,release_id,platform,metric,value,captured_on,source_url").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(2500),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId),
    supabase.from("releases").select("id,title,release_date").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
    supabase.from("outcomes").select("id,campaign_id,release_id,outcome_type,outcome_date,confidence,url").eq("workspace_id", workspaceId).order("outcome_date", { ascending: false }).limit(500),
    supabase.from("interactions").select("id,campaign_id,reply_status,occurred_at").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(1000),
    supabase.from("campaigns").select("id,name,release_id,status").eq("workspace_id", workspaceId),
    supabase.from("oauth_connections").select("provider,account_email,last_success_at,last_error,expires_at,metadata").eq("workspace_id", workspaceId).eq("user_id", userData.user.id),
    supabase.from("artist_platform_profiles").select("id,platform_id,artist_name,connection_state,source_type,last_synced_at,freshness_status,profile_url").eq("workspace_id", workspaceId).order("last_synced_at", { ascending: false }),
    supabase.from("music_platforms").select("id,slug,name,category,priority").eq("active", true),
    supabase.from("link_events").select("id,smart_link_id,fan_id,event_type,destination_service,utm_source,utm_medium,utm_campaign,referrer,country_code,occurred_at").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(5000),
    supabase.from("smart_links").select("id,release_id,slug,headline,is_active,capture_email").eq("workspace_id", workspaceId),
    supabase.from("playlist_placements").select("id,release_id,platform_id,playlist_name,followers,track_position,added_at,removed_at,verification_state,risk_state,playlist_url").eq("workspace_id", workspaceId).order("added_at", { ascending: false }).limit(500),
    supabase.from("fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("contactable_fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("source_smart_link_id", "is", null).is("archived_at", null),
    supabase.from("fan_consents").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("granted", true),
    supabase.from("campaign_targets").select("id,status", { count: "exact" }).eq("workspace_id", workspaceId),
    supabase.from("evidence_records").select("id,evidence_type,verification_status,observed_at,summary").eq("workspace_id", workspaceId).order("observed_at", { ascending: false }).limit(200),
  ]);

  const metrics = metricsResult.data ?? [];
  const outcomes = outcomesResult.data ?? [];
  const interactions = interactionsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const campaigns = campaignsResult.data ?? [];
  const oauthConnections = oauthResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const platforms = platformsResult.data ?? [];
  const linkEvents = linkEventsResult.data ?? [];
  const smartLinks = smartLinksResult.data ?? [];
  const placements = placementsResult.data ?? [];
  const campaignTargets = campaignTargetsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];

  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const releaseById = new Map(releases.map((release) => [release.id, release]));
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));

  const metricSeries = new Map<string, typeof metrics>();
  const latestMetricByPlatform = new Map<string, string>();
  for (const metric of metrics) {
    const key = `${metric.artist_id ?? "workspace"}:${metric.release_id ?? "all"}:${metric.platform}:${metric.metric}`;
    const series = metricSeries.get(key) ?? [];
    series.push(metric);
    metricSeries.set(key, series);
    if (!latestMetricByPlatform.has(metric.platform)) latestMetricByPlatform.set(metric.platform, metric.captured_on);
  }

  const signals = Array.from(metricSeries.entries()).map(([key, series]) => {
    const latest = series[0];
    const previous = series[1] ?? null;
    const currentValue = Number(latest.value);
    const previousValue = previous ? Number(previous.value) : null;
    return { key, latest, previous, currentValue, ...formatTrend(currentValue, previousValue) };
  });

  const risingSignals = signals.filter((signal) => signal.delta !== null && signal.delta > 0).sort((a, b) => (b.percent ?? b.delta ?? 0) - (a.percent ?? a.delta ?? 0));
  const decliningSignals = signals.filter((signal) => signal.delta !== null && signal.delta < 0).sort((a, b) => (a.percent ?? a.delta ?? 0) - (b.percent ?? b.delta ?? 0));
  const replies = interactions.filter((interaction) => interaction.reply_status && interaction.reply_status !== "none");
  const verifiedOutcomes = outcomes.filter((outcome) => outcome.confidence === "verified");
  const metricPlatforms = new Set(metrics.map((metric) => metric.platform));
  const connectedProfiles = profiles.filter((profile) => ["connected", "identified"].includes(profile.connection_state));
  const activePlacements = placements.filter((placement) => !placement.removed_at);
  const verifiedPlacements = activePlacements.filter((placement) => placement.verification_state === "verified");
  const importReceipts = evidence.filter((item) => item.evidence_type === "metric_export_import");

  const pageViews = linkEvents.filter((event) => event.event_type === "page_view").length;
  const destinationClicks = linkEvents.filter((event) => event.event_type === "destination_click").length;
  const fanSignups = linkEvents.filter((event) => event.event_type === "fan_signup").length;
  const destinations = new Map<string, number>();
  const acquisitionSources = new Map<string, number>();
  for (const event of linkEvents) {
    if (event.event_type === "destination_click") increment(destinations, event.destination_service);
    increment(acquisitionSources, event.utm_source || event.utm_campaign || event.referrer);
  }

  const sourceHealth = platforms.map((platform) => {
    const platformProfiles = connectedProfiles.filter((profile) => profile.platform_id === platform.id);
    const latest = latestMetricByPlatform.get(platform.slug) ?? latestMetricByPlatform.get(platform.slug.replace(/-/g, "_")) ?? null;
    return {
      platform,
      profileCount: platformProfiles.length,
      latest,
      snapshots: metrics.filter((metric) => metric.platform === platform.slug || metric.platform === platform.slug.replace(/-/g, "_")).length,
      status: platformProfiles.some((profile) => profile.connection_state === "connected") ? "connected" : platformProfiles.length ? "identified" : latest ? "data imported" : "not connected",
    };
  }).filter((item) => item.profileCount || item.snapshots || item.platform.priority === "core");

  const outcomesByRelease = releases.map((release) => ({
    release,
    outcomes: outcomes.filter((outcome) => outcome.release_id === release.id),
    signals: signals.filter((signal) => signal.latest.release_id === release.id),
    placements: activePlacements.filter((placement) => placement.release_id === release.id),
    links: smartLinks.filter((link) => link.release_id === release.id),
  })).filter((item) => item.outcomes.length || item.signals.length || item.placements.length || item.links.length);

  const totalFans = totalFansResult.count ?? 0;
  const contactableFans = contactableFansResult.count ?? 0;
  const linkFans = linkFansResult.count ?? 0;
  const consentRecords = consentsResult.count ?? 0;
  const acceptedTargets = campaignTargets.filter((target) => ["accepted", "placed"].includes(target.status)).length;

  return (
    <>
      <AppHeader active="insights" />
      <main className="shell">
      <header className="app-page-heading">
        <div>
          <div className="eyebrow">What ArtistOS has learned</div>
          <h1>Insights</h1>
          <p>Understand performance, audience growth, campaign outcomes and the patterns that should shape your next release.</p>
        </div>
        <nav className="section-tabs" aria-label="Insight views">
          <Link className="active" href="/analytics">Performance</Link>
          <Link href="/audience">Audience</Link>
          <Link href="/brain">Learning</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Total fans</div><div className="stat-value">{formatNumber(totalFans)}</div><p className="muted">{formatNumber(contactableFans)} contactable</p></div>
        <div className="card"><div className="eyebrow">Link activity</div><div className="stat-value">{formatNumber(pageViews)}</div><p className="muted">{destinationClicks} destination clicks</p></div>
        <div className="card"><div className="eyebrow">Tracked platforms</div><div className="stat-value">{metricPlatforms.size}</div><p className="muted">{profiles.length} mapped profiles</p></div>
        <div className="card"><div className="eyebrow">Verified outcomes</div><div className="stat-value">{verifiedOutcomes.length}</div><p className="muted">{verifiedPlacements.length} verified placements</p></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="section-heading"><div><h2>Connected data</h2><p className="muted">See which services are contributing current performance signals.</p></div><Link className="next-action" href="/connections">Manage connections →</Link></div>
          {oauthConnections.map((connection) => <div className="row" key={connection.provider}><div><strong>{connection.provider} OAuth</strong><p className="muted">{connection.account_email ?? "Connected account"} · Last success {formatDate(connection.last_success_at)}</p>{connection.last_error ? <p className="muted">Needs attention: {connection.last_error}</p> : null}</div><span className={`pill ${connection.last_error ? "blocked" : ""}`}>{connection.last_error ? "attention" : "connected"}</span></div>)}
          {sourceHealth.map(({ platform, profileCount, snapshots, latest, status }) => <div className="row" key={platform.id}><div><strong>{platform.name}</strong><p className="muted">{profileCount} profiles · {snapshots} snapshots · Latest {latest ?? "none"}</p></div><span className={`pill ${status === "not connected" ? "blocked" : ""}`}>{status}</span></div>)}
          {!oauthConnections.length && !profiles.length && !metrics.length ? <div className="empty">No external sources are connected yet. Open Sources to connect YouTube or import your first dashboard export.</div> : null}
        </section>

        <section className="card">
          <div className="section-heading"><div><h2>Owned audience and link conversion</h2><p className="muted">First-party behavior captured by ArtistOS Links and fan consent.</p></div><Link className="next-action" href="/links">Open Links →</Link></div>
          <div className="row"><span>Page views</span><strong>{formatNumber(pageViews)}</strong></div>
          <div className="row"><span>Destination clicks</span><strong>{formatNumber(destinationClicks)} · {formatPercent(ratio(destinationClicks, pageViews))}</strong></div>
          <div className="row"><span>Fan signups</span><strong>{formatNumber(fanSignups)} · {formatPercent(ratio(fanSignups, pageViews))}</strong></div>
          <div className="row"><span>Fans attributed to ArtistOS Links</span><strong>{formatNumber(linkFans)}</strong></div>
          <div className="row"><span>Granted consent receipts</span><strong>{formatNumber(consentRecords)}</strong></div>
          {destinations.size ? <div className="notice"><strong>Top destinations</strong><p className="muted">{Array.from(destinations.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `${name}: ${count}`).join(" · ")}</p></div> : null}
          {acquisitionSources.size ? <div className="notice"><strong>Top acquisition sources</strong><p className="muted">{Array.from(acquisitionSources.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `${name}: ${count}`).join(" · ")}</p></div> : null}
        </section>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="section-heading"><div><h2>Momentum</h2><p className="muted">Latest value compared with the previous source snapshot.</p></div><span className="pill">{signals.length} series</span></div>
          {signals.length ? signals.slice(0, 20).map((signal) => {
            const release = signal.latest.release_id ? releaseById.get(signal.latest.release_id) : null;
            const direction = signal.delta === null ? "New" : signal.delta > 0 ? "Rising" : signal.delta < 0 ? "Declining" : "Flat";
            const isDeclining = signal.delta !== null && signal.delta < 0;
            return (
              <div className="row" key={signal.key}>
                <div>
                  <strong>{signal.latest.platform} · {signal.latest.metric}</strong>
                  <p className="muted">{release?.title ?? "Artist/workspace"} · {signal.latest.captured_on}{signal.latest.source_url ? " · sourced" : " · source URL missing"}</p>
                  <div className="tag-row"><span className={`pill ${isDeclining ? "blocked" : ""}`}>{direction}</span>{signal.percent !== null ? <span className="pill">{signal.percent > 0 ? "+" : ""}{signal.percent.toFixed(1)}%</span> : null}</div>
                </div>
                <div className="stat-value compact">{formatNumber(signal.currentValue)}</div>
              </div>
            );
          }) : <div className="empty">Connect YouTube or import at least one artist-dashboard export. Two dated snapshots unlock trend detection.</div>}
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-heading"><div><h2>Campaign and placement impact</h2><p className="muted">Promotion activity connected back to releases and proof.</p></div><Link className="next-action" href="/campaigns">Open campaigns →</Link></div>
            <div className="row"><span>Campaigns</span><strong>{campaigns.length}</strong></div>
            <div className="row"><span>Assigned targets</span><strong>{campaignTargetsResult.count ?? campaignTargets.length}</strong></div>
            <div className="row"><span>Accepted or placed targets</span><strong>{acceptedTargets}</strong></div>
            <div className="row"><span>Replies</span><strong>{replies.length}</strong></div>
            <div className="row"><span>Recorded outcomes</span><strong>{outcomes.length}</strong></div>
            <div className="row"><span>Active playlist placements</span><strong>{activePlacements.length}</strong></div>
          </section>
          <section className="card">
            <div className="section-heading"><div><h2>What needs attention</h2><p className="muted">Gaps that may limit the quality of your next recommendation.</p></div></div>
            <div className="row"><span>Declining signals</span><strong>{decliningSignals.length}</strong></div>
            <div className="row"><span>Outcomes needing stronger proof</span><strong>{outcomes.length - verifiedOutcomes.length}</strong></div>
            <div className="row"><span>Unverified active placements</span><strong>{activePlacements.length - verifiedPlacements.length}</strong></div>
            <div className="row"><span>Metric import receipts</span><strong>{importReceipts.length}</strong></div>
            <div className="row"><span>Core sources without data</span><strong>{sourceHealth.filter((item) => item.platform.priority === "core" && !item.snapshots).length}</strong></div>
          </section>
        </div>
      </section>

      {outcomesByRelease.length ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading"><div><h2>Release comparison</h2><p className="muted">Measurement, promotion, placement, and link coverage by release.</p></div></div>
          {outcomesByRelease.map(({ release, outcomes: releaseOutcomes, signals: releaseSignals, placements: releasePlacements, links }) => (
            <div className="row" key={release.id}>
              <div><strong>{release.title}</strong><p className="muted">Released {formatDate(release.release_date)}</p></div>
              <div className="tag-row"><span className="pill">{releaseSignals.length} signals</span><span className="pill">{releaseOutcomes.length} outcomes</span><span className="pill">{releasePlacements.length} placements</span><span className="pill">{links.length} links</span></div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="section-heading"><div><h2>Recent campaign impact</h2><p className="muted">Latest outcomes with campaign and release context.</p></div><Link className="next-action" href="/proof">View campaign proof →</Link></div>
          {outcomes.length ? outcomes.slice(0, 10).map((outcome) => {
            const campaign = outcome.campaign_id ? campaignById.get(outcome.campaign_id) : null;
            const release = outcome.release_id ? releaseById.get(outcome.release_id) : null;
            return <div className="row" key={outcome.id}><div><strong>{outcome.outcome_type}</strong><p className="muted">{release?.title ?? "Release"}{campaign ? ` · ${campaign.name}` : ""} · {formatDate(outcome.outcome_date)}</p></div><span className="pill">{outcome.confidence ?? "unknown"}</span></div>;
          }) : <div className="empty">No campaign outcomes have been recorded.</div>}
        </section>

        <section className="card">
          <div className="section-heading"><div><h2>Active playlist evidence</h2><p className="muted">Current placements with audience, position, and verification status.</p></div></div>
          {activePlacements.length ? activePlacements.slice(0, 10).map((placement) => {
            const release = placement.release_id ? releaseById.get(placement.release_id) : null;
            const platform = placement.platform_id ? platformById.get(placement.platform_id) : null;
            return <div className="row" key={placement.id}><div><strong>{placement.playlist_name}</strong><p className="muted">{release?.title ?? "Release"} · {platform?.name ?? "Platform"} · {placement.followers ? `${formatNumber(Number(placement.followers))} followers` : "audience unknown"}</p></div><div className="tag-row"><span className="pill">{placement.track_position ? `#${placement.track_position}` : "position unknown"}</span><span className={`pill ${placement.verification_state !== "verified" ? "blocked" : ""}`}>{placement.verification_state}</span></div></div>;
          }) : <div className="empty">No playlist placements are recorded yet.</div>}
        </section>
      </section>

      <section className="grid two-col">
        <section className="card">
          <div className="section-heading"><div><h2>Fastest growth</h2><p className="muted">Largest positive changes from all connected and imported snapshots.</p></div></div>
          {risingSignals.length ? risingSignals.slice(0, 10).map((signal) => <div className="row" key={signal.key}><div><strong>{signal.latest.platform} · {signal.latest.metric}</strong><p className="muted">{signal.latest.captured_on}</p></div><span className="pill">{signal.percent !== null ? `+${signal.percent.toFixed(1)}%` : `+${formatNumber(signal.delta ?? 0)}`}</span></div>) : <div className="empty">No positive trend is measurable yet.</div>}
        </section>

        <form action={addMetric} className="card stack">
          <h2>Add one manual snapshot</h2>
          <p className="muted">Use Sources for OAuth and bulk exports. This form remains available for one-off source-visible measurements.</p>
          <div className="form-grid two">
            <label className="field"><span>Platform</span><select className="input" name="platform"><option>spotify</option><option>apple_music</option><option>youtube</option><option>instagram</option><option>tiktok</option><option>facebook</option><option>soundcloud</option><option>email</option><option>revenue</option></select></label>
            <label className="field"><span>Metric</span><input className="input" name="metric" placeholder="monthly_listeners" required /></label>
          </div>
          <label className="field"><span>Value</span><input className="input" type="number" step="any" name="value" required /></label>
          <label className="field"><span>Captured on</span><input className="input" type="date" name="capturedOn" /></label>
          <label className="field"><span>Artist</span><select className="input" name="artistId"><option value="">Workspace</option>{(artistsResult.data ?? []).map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
          <label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">All releases</option>{releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></label>
          <label className="field"><span>Source URL</span><input className="input" name="sourceUrl" type="url" required /></label>
          <button className="button primary" type="submit">Save snapshot</button>
          <Link className="button ghost" href="/connections">Connect or import a source instead</Link>
        </form>
      </section>
      </main>
    </>
  );
}
