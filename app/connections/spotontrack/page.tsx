import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";
import { connectSpotOnTrack, syncSpotOnTrack } from "./actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SpotOnTrackPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");

  const [connectionResult, releaseResult, metricsResult, evidenceResult] = await Promise.all([
    supabase.from("oauth_connections").select("provider,last_success_at,last_error,metadata,encrypted_access_token").eq("workspace_id", membership.workspace_id).eq("user_id", auth.user.id).eq("provider", "spotontrack").maybeSingle(),
    supabase.from("releases").select("id,title,isrc,status,release_date").eq("workspace_id", membership.workspace_id).order("release_date", { ascending: false, nullsFirst: false }),
    supabase.from("metric_snapshots").select("release_id,metric,value,captured_on,source_url").eq("workspace_id", membership.workspace_id).eq("platform", "spotontrack").order("captured_on", { ascending: false }).limit(100),
    supabase.from("evidence_records").select("id,summary,observed_at,verification_status").eq("workspace_id", membership.workspace_id).eq("evidence_type", "spotontrack_release_sync").order("observed_at", { ascending: false }).limit(5),
  ]);

  const connection = connectionResult.data;
  const releases = releaseResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];
  const connected = isCurrentTokenEnvelope(connection?.encrypted_access_token);
  const encryptionConfigured = Boolean(process.env.ARTISTOS_TOKEN_ENCRYPTION_KEY);
  const error = typeof params.error === "string" ? params.error : null;
  const connectedNotice = params.connected === "1";
  const syncedNotice = params.synced === "1";

  return <main className="shell">
    <header className="topbar">
      <div><div className="eyebrow">Sources · Release intelligence</div><h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Spotontrack</h1><p className="muted">Exact-ISRC streams, Shazams, playlist movement, reach, and current chart observations inside ArtistOS.</p></div>
      <nav className="nav-links"><Link className="button ghost" href="/connections">All sources</Link><Link className="button primary" href="/analytics">Music Intelligence</Link><Link className="button ghost" href="/proof">Proof</Link></nav>
    </header>

    {error ? <div className="notice" style={{ marginBottom: 16 }}><strong>Spotontrack needs attention.</strong><p className="muted">{error}</p></div> : null}
    {connectedNotice ? <div className="notice" style={{ marginBottom: 16 }}><strong>API key verified and encrypted.</strong><p className="muted">Run the first release sync to create source-visible metrics and a Proof receipt.</p></div> : null}
    {syncedNotice ? <div className="notice" style={{ marginBottom: 16 }}><strong>Release sync verified.</strong><p className="muted">{typeof params.metrics === "string" ? params.metrics : "0"} observations were stored.</p></div> : null}

    <section className="grid stats" style={{ marginBottom: 16 }}>
      <div className="card"><div className="eyebrow">Provider state</div><div className="stat-value" style={{ fontSize: "1.5rem" }}>{connected ? "Configured" : "Not configured"}</div></div>
      <div className="card"><div className="eyebrow">Last verified request</div><div className="stat-value" style={{ fontSize: "1.1rem" }}>{formatDate(connection?.last_success_at)}</div></div>
      <div className="card"><div className="eyebrow">Stored observations</div><div className="stat-value">{metrics.length}</div></div>
      <div className="card"><div className="eyebrow">Proof receipts</div><div className="stat-value">{evidence.length}</div></div>
    </section>

    <section className="grid two-col" style={{ marginBottom: 16 }}>
      <section className="card stack">
        <div className="section-heading"><div><h2>{connected ? "Sync release" : "Connect API"}</h2><p className="muted">Credentials remain server-side and are stored in the authenticated encryption envelope.</p></div><span className={`pill ${connected ? "" : "blocked"}`}>{connected ? "API key verified" : "API key required"}</span></div>
        {!encryptionConfigured ? <div className="notice"><strong>Encryption key missing.</strong><p className="muted">ARTISTOS_TOKEN_ENCRYPTION_KEY must be configured in Vercel before any provider key can be stored.</p></div> : null}
        {connection?.last_error ? <div className="notice"><strong>Last provider error</strong><p className="muted">{connection.last_error}</p></div> : null}
        {!connected ? <form action={connectSpotOnTrack} className="stack"><label className="field"><span>Spotontrack API key</span><input className="input" type="password" name="apiKey" autoComplete="off" required disabled={!encryptionConfigured} /></label><label className="field"><span>Account label</span><input className="input" name="accountLabel" placeholder="Middle Child release intelligence" disabled={!encryptionConfigured} /></label><button className="button primary" type="submit" disabled={!encryptionConfigured}>Validate and save API key</button></form> : <form action={syncSpotOnTrack} className="stack"><label className="field"><span>Release</span><select className="input" name="releaseId" required><option value="">Choose ISRC-confirmed release</option>{releases.filter((release) => release.isrc).map((release) => <option key={release.id} value={release.id}>{release.title} · {release.isrc}</option>)}</select></label><button className="button primary" type="submit">Sync release now</button></form>}
        <p className="muted">ArtistOS never name-matches a release here. Every request is bound to the exact ISRC saved in Release Workspace.</p>
      </section>

      <section className="card stack">
        <div><div className="eyebrow">Coverage</div><h2>What this adapter records</h2></div>
        {[
          "Spotify total and daily stream observations",
          "Shazam total and daily observations",
          "Current Spotify, Apple Music, and Deezer playlist entries",
          "Spotify and Deezer playlist follower reach",
          "Removed Spotify playlist entries",
          "Current Spotify, Apple Music, Deezer, and Shazam chart entries and best positions",
        ].map((item) => <div className="row" key={item}><span>{item}</span><span className="pill">Source-visible</span></div>)}
        <p className="muted">Endpoint access depends on the paid Spotontrack plan. Partial successful responses remain distinguishable from unavailable endpoints.</p>
      </section>
    </section>

    <section className="grid two-col">
      <section className="card stack"><div className="section-heading"><h2>Latest observations</h2><span className="pill">{metrics.length}</span></div>{metrics.length ? metrics.slice(0, 20).map((metric, index) => <div className="row" key={`${metric.release_id}:${metric.metric}:${metric.captured_on}:${index}`}><div><strong>{metric.metric.replace(/_/g, " ")}</strong><p className="muted">{metric.captured_on}</p></div><strong>{Number(metric.value).toLocaleString()}</strong></div>) : <div className="empty">No Spotontrack observations yet.</div>}</section>
      <section className="card stack"><div className="section-heading"><h2>Proof receipts</h2><span className="pill">{evidence.length}</span></div>{evidence.length ? evidence.map((record) => <div className="notice" key={record.id}><strong>{record.verification_status}</strong><p>{record.summary}</p><p className="muted">{formatDate(record.observed_at)}</p></div>) : <div className="empty">The first verified sync will create a receipt.</div>}</section>
    </section>
  </main>;
}
