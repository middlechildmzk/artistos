import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addMetric } from "../intelligence/actions";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatTrend(current: number, previous: number | null) {
  if (previous === null) return { delta: null, percent: null };
  const delta = current - previous;
  const percent = previous === 0 ? null : (delta / Math.abs(previous)) * 100;
  return { delta, percent };
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
  const [metricsResult, artistsResult, releasesResult, outcomesResult, interactionsResult, campaignsResult] = await Promise.all([
    supabase.from("metric_snapshots").select("id, artist_id, release_id, platform, metric, value, captured_on, source_url").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(500),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId),
    supabase.from("releases").select("id,title,release_date").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
    supabase.from("outcomes").select("id,campaign_id,release_id,outcome_type,outcome_date,confidence,url").eq("workspace_id", workspaceId).order("outcome_date", { ascending: false }).limit(200),
    supabase.from("interactions").select("id,campaign_id,reply_status,occurred_at").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("campaigns").select("id,name,release_id,status").eq("workspace_id", workspaceId),
  ]);

  const metrics = metricsResult.data ?? [];
  const outcomes = outcomesResult.data ?? [];
  const interactions = interactionsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const campaignById = new Map((campaignsResult.data ?? []).map((campaign) => [campaign.id, campaign]));
  const releaseById = new Map(releases.map((release) => [release.id, release]));

  const metricSeries = new Map<string, typeof metrics>();
  for (const metric of metrics) {
    const key = `${metric.artist_id ?? "workspace"}:${metric.release_id ?? "all"}:${metric.platform}:${metric.metric}`;
    const series = metricSeries.get(key) ?? [];
    series.push(metric);
    metricSeries.set(key, series);
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
  const platforms = new Set(metrics.map((metric) => metric.platform));

  const outcomesByRelease = releases.map((release) => ({
    release,
    outcomes: outcomes.filter((outcome) => outcome.release_id === release.id),
    signals: signals.filter((signal) => signal.latest.release_id === release.id),
  })).filter((item) => item.outcomes.length || item.signals.length);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Cross-platform performance and attribution</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Music Intelligence</h1>
          <p className="muted">Track momentum, detect changes, connect campaign outcomes to releases, and turn evidence into the next recommended action.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/campaigns">Campaign Intelligence</Link>
          <Link className="button ghost" href="/targets">Network</Link>
          <Link className="button ghost" href="/proof">Proof</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Tracked signals</div><div className="stat-value">{signals.length}</div></div>
        <div className="card"><div className="eyebrow">Rising signals</div><div className="stat-value">{risingSignals.length}</div></div>
        <div className="card"><div className="eyebrow">Verified outcomes</div><div className="stat-value">{verifiedOutcomes.length}</div></div>
        <div className="card"><div className="eyebrow">Platforms</div><div className="stat-value">{platforms.size}</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-heading"><div><h2>Momentum</h2><p className="muted">Latest value compared with the previous captured snapshot.</p></div><span className="pill">{signals.length} series</span></div>
          {signals.length ? signals.slice(0, 18).map((signal) => {
            const release = signal.latest.release_id ? releaseById.get(signal.latest.release_id) : null;
            const direction = signal.delta === null ? "New" : signal.delta > 0 ? "Rising" : signal.delta < 0 ? "Declining" : "Flat";
            const isDeclining = signal.delta !== null && signal.delta < 0;
            return (
              <div className="row" key={signal.key}>
                <div>
                  <strong>{signal.latest.platform} · {signal.latest.metric}</strong>
                  <p className="muted">{release?.title ?? "Workspace"} · {signal.latest.captured_on}</p>
                  <div className="tag-row"><span className={`pill ${isDeclining ? "blocked" : ""}`}>{direction}</span>{signal.percent !== null ? <span className="pill">{signal.percent > 0 ? "+" : ""}{signal.percent.toFixed(1)}%</span> : null}</div>
                </div>
                <div className="stat-value compact">{formatNumber(signal.currentValue)}</div>
              </div>
            );
          }) : <div className="empty">Add at least two snapshots for a metric to unlock trend detection.</div>}
        </div>

        <div className="stack">
          <section className="card">
            <div className="section-heading"><div><h2>Attention queue</h2><p className="muted">Signals and outcomes that should influence the next Artist Brain recommendation.</p></div></div>
            <div className="row"><span>Declining signals</span><strong>{decliningSignals.length}</strong></div>
            <div className="row"><span>Campaign replies</span><strong>{replies.length}</strong></div>
            <div className="row"><span>Recorded outcomes</span><strong>{outcomes.length}</strong></div>
            <div className="row"><span>Outcomes needing stronger proof</span><strong>{outcomes.length - verifiedOutcomes.length}</strong></div>
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Recent campaign impact</h2><p className="muted">Latest reported outcomes with campaign context.</p></div><Link className="next-action" href="/proof">Open Proof →</Link></div>
            {outcomes.length ? outcomes.slice(0, 8).map((outcome) => {
              const campaign = outcome.campaign_id ? campaignById.get(outcome.campaign_id) : null;
              const release = outcome.release_id ? releaseById.get(outcome.release_id) : null;
              return <div className="row" key={outcome.id}><div><strong>{outcome.outcome_type}</strong><p className="muted">{release?.title ?? "Release"}{campaign ? ` · ${campaign.name}` : ""} · {outcome.outcome_date}</p></div><span className="pill">{outcome.confidence ?? "unknown"}</span></div>;
            }) : <div className="empty">No campaign outcomes have been recorded.</div>}
          </section>
        </div>
      </section>

      {outcomesByRelease.length ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading"><div><h2>Release comparison</h2><p className="muted">Current measurement coverage and promotion results by release.</p></div></div>
          {outcomesByRelease.map(({ release, outcomes: releaseOutcomes, signals: releaseSignals }) => (
            <div className="row" key={release.id}><div><strong>{release.title}</strong><p className="muted">Released {release.release_date ?? "date unknown"}</p></div><div className="tag-row"><span className="pill">{releaseSignals.length} signals</span><span className="pill">{releaseOutcomes.length} outcomes</span><span className="pill">{releaseOutcomes.filter((outcome) => outcome.confidence === "verified").length} verified</span></div></div>
          ))}
        </section>
      ) : null}

      <section className="grid two-col">
        <section className="card">
          <div className="section-heading"><div><h2>Fastest growth</h2><p className="muted">Largest positive changes from the available snapshots.</p></div></div>
          {risingSignals.length ? risingSignals.slice(0, 8).map((signal) => <div className="row" key={signal.key}><div><strong>{signal.latest.platform} · {signal.latest.metric}</strong><p className="muted">{signal.latest.captured_on}</p></div><span className="pill">{signal.percent !== null ? `+${signal.percent.toFixed(1)}%` : `+${formatNumber(signal.delta ?? 0)}`}</span></div>) : <div className="empty">No positive trend is measurable yet.</div>}
        </section>

        <form action={addMetric} className="card stack">
          <h2>Add metric snapshot</h2>
          <p className="muted">Manual snapshots remain source-visible until automated platform connectors are enabled.</p>
          <div className="form-grid two">
            <label className="field"><span>Platform</span><select className="input" name="platform"><option>spotify</option><option>apple_music</option><option>youtube</option><option>instagram</option><option>tiktok</option><option>facebook</option><option>x</option><option>email</option><option>revenue</option></select></label>
            <label className="field"><span>Metric</span><input className="input" name="metric" placeholder="followers" required /></label>
          </div>
          <label className="field"><span>Value</span><input className="input" type="number" step="any" name="value" required /></label>
          <label className="field"><span>Captured on</span><input className="input" type="date" name="capturedOn" /></label>
          <label className="field"><span>Artist</span><select className="input" name="artistId"><option value="">Workspace</option>{(artistsResult.data ?? []).map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
          <label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">All releases</option>{releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></label>
          <label className="field"><span>Source URL</span><input className="input" name="sourceUrl" type="url" /></label>
          <button className="button primary" type="submit">Save snapshot</button>
        </form>
      </section>
    </main>
  );
}
