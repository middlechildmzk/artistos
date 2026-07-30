import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";
import { SOURCE_COVERAGE, SOURCE_COVERAGE_BY_SLUG } from "@/lib/integrations/source-catalog";
import {
  connectApiProvider,
  importMetricCsv,
  savePlatformProfile,
  syncGoogleYouTube,
  syncKit,
  syncSoundcharts,
} from "./actions";
import FreeSourcePanels from "./free-source-panels";

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "Not connected";
  return status.replace(/_/g, " ");
}

function configuredPublicOrigin() {
  const value = process.env.ARTISTOS_PUBLIC_ORIGIN?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConnectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [platformResult, profilesResult, oauthResult, artistsResult, metricsResult] = await Promise.all([
    supabase.from("music_platforms").select("id,slug,name,category,priority,supported_modes,active").eq("active", true).order("priority").order("name"),
    supabase.from("artist_platform_profiles").select("id,platform_id,artist_name,external_artist_id,profile_url,connection_state,source_type,last_synced_at,last_verified_at,freshness_status,metadata").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    supabase.from("oauth_connections").select("provider,provider_account_id,account_email,expires_at,scopes,last_success_at,last_error,metadata,encrypted_access_token,encrypted_refresh_token").eq("workspace_id", workspaceId).eq("user_id", auth.user.id),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId).order("name"),
    supabase.from("metric_snapshots").select("platform,captured_on").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(5000),
  ]);

  const platforms = platformResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const oauthConnections = oauthResult.data ?? [];
  const artists = artistsResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const profilesByPlatform = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const list = profilesByPlatform.get(profile.platform_id) ?? [];
    list.push(profile);
    profilesByPlatform.set(profile.platform_id, list);
  }
  const metricCounts = new Map<string, number>();
  const latestMetricDate = new Map<string, string>();
  for (const metric of metrics) {
    metricCounts.set(metric.platform, (metricCounts.get(metric.platform) ?? 0) + 1);
    if (!latestMetricDate.has(metric.platform)) latestMetricDate.set(metric.platform, metric.captured_on);
  }

  const publicOrigin = configuredPublicOrigin();
  const googleConnectHref = publicOrigin ? `${publicOrigin}/api/integrations/google/connect` : "/api/integrations/google/connect";
  const google = oauthConnections.find((connection) => connection.provider === "google") ?? null;
  const soundcharts = oauthConnections.find((connection) => connection.provider === "soundcharts") ?? null;
  const kit = oauthConnections.find((connection) => connection.provider === "kit") ?? null;
  const googleTokenCurrent = isCurrentTokenEnvelope(google?.encrypted_access_token);
  const soundchartsTokenCurrent = isCurrentTokenEnvelope(soundcharts?.encrypted_access_token) && isCurrentTokenEnvelope(soundcharts?.encrypted_refresh_token);
  const kitTokenCurrent = isCurrentTokenEnvelope(kit?.encrypted_access_token);
  const encryptionConfigured = Boolean(process.env.ARTISTOS_TOKEN_ENCRYPTION_KEY);
  const googleExpired = google?.expires_at ? new Date(google.expires_at).getTime() < Date.now() : true;
  const googleConfigured = Boolean(publicOrigin && process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && encryptionConfigured);
  const youtubeError = typeof google?.metadata?.youtube_error === "string" ? google.metadata.youtube_error : null;
  const corePlatforms = platforms.filter((platform) => platform.priority === "core");
  const otherPlatforms = platforms.filter((platform) => platform.priority !== "core");
  const platformsWithData = new Set(metrics.map((metric) => metric.platform)).size;
  const connectedProfiles = profiles.filter((profile) => ["connected", "identified"].includes(profile.connection_state)).length;
  const error = typeof params.error === "string" ? params.error : null;
  const imported = typeof params.imported === "string" ? params.imported : null;
  const connected = typeof params.connected === "string" ? params.connected : null;
  const synced = typeof params.synced === "string" ? params.synced : null;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Identity, authentication, imports, and freshness</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Sources</h1>
          <p className="muted">Connect what exposes a legitimate API, import what requires artist-dashboard exports, and keep every metric tied to its source and retrieval date.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button primary" href="/analytics">View all stats</Link>
          <Link className="button ghost" href="/proof">Proof</Link>
        </nav>
      </header>

      {error ? <div className="notice" style={{ marginBottom: 16 }}><strong>Source action needs attention.</strong><div className="muted">{error}</div></div> : null}
      {connected ? <div className="notice" style={{ marginBottom: 16 }}><strong>{statusLabel(connected)} connected.</strong> Run the first sync to populate ArtistOS.</div> : null}
      {synced ? <div className="notice" style={{ marginBottom: 16 }}><strong>{statusLabel(synced)} synced.</strong> The latest source metrics are now in Music Intelligence and Proof.</div> : null}
      {imported ? <div className="notice" style={{ marginBottom: 16 }}><strong>{imported} metric rows imported.</strong> They are source-visible in Music Intelligence and Proof.</div> : null}

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Source credentials</div><div className="stat-value">{oauthConnections.length}</div></div>
        <div className="card"><div className="eyebrow">Mapped profiles</div><div className="stat-value">{connectedProfiles}</div></div>
        <div className="card"><div className="eyebrow">Platforms with data</div><div className="stat-value">{platformsWithData}</div></div>
        <div className="card"><div className="eyebrow">Metric snapshots</div><div className="stat-value">{metrics.length}</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <section className="card stack">
          <div className="section-heading">
            <div><div className="eyebrow">Owned source 01</div><h2>Google + YouTube</h2><p className="muted">Owned-channel totals and 28-day YouTube Analytics.</p></div>
            <span className={`pill ${youtubeError || !googleTokenCurrent ? "blocked" : ""}`}>{google && googleTokenCurrent ? "Connected" : google ? "Reconnect required" : "Not connected"}</span>
          </div>
          <div className="row"><span>Account</span><strong>{google?.account_email ?? "No account"}</strong></div>
          <div className="row"><span>Last successful sync</span><strong>{formatDate(google?.last_success_at)}</strong></div>
          <div className="row"><span>Access token</span><span className="pill">{googleTokenCurrent ? (googleExpired ? "Refreshable" : "Current") : "Legacy / unavailable"}</span></div>
          <div className="row"><span>Stable OAuth origin</span><strong>{publicOrigin ?? "Not configured"}</strong></div>
          <div className="row"><span>Server configuration</span><span className={`pill ${googleConfigured ? "" : "blocked"}`}>{googleConfigured ? "Ready" : "Missing environment keys"}</span></div>
          {!googleConfigured ? <div className="notice"><strong>Required setup</strong><p className="muted">Set ARTISTOS_PUBLIC_ORIGIN, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and ARTISTOS_TOKEN_ENCRYPTION_KEY in Vercel. Enable YouTube Data API v3 and YouTube Analytics API, then authorize the exact ArtistOS callback URI.</p></div> : null}
          {youtubeError ? <div className="notice"><strong>YouTube API blocker</strong><p className="muted">{youtubeError}</p></div> : null}
          {google?.last_error ? <div className="notice"><strong>Last sync error</strong><p className="muted">{google.last_error}</p></div> : null}
          <div className="tag-row">
            <Link className="button primary" href={googleConnectHref}>{google ? "Reconnect Google + YouTube" : "Connect Google + YouTube"}</Link>
            {google && googleTokenCurrent ? <form action={syncGoogleYouTube}><button className="button" type="submit">Sync YouTube now</button></form> : null}
          </div>
          <p className="muted">OAuth uses a stable ArtistOS origin so login, CSRF state, and callback cookies remain on the same hostname across deployments.</p>
        </section>

        <section className="card stack">
          <div className="section-heading"><div><div className="eyebrow">Universal fallback</div><h2>Import artist-dashboard exports</h2><p className="muted">Use this for Spotify for Artists, Apple Music for Artists, DistroKid, TikTok, Meta, Bandcamp, and reports without a usable analytics API.</p></div></div>
          <form action={importMetricCsv} className="stack">
            <label className="field"><span>CSV file</span><input className="input" type="file" name="file" accept=".csv,text/csv" required /></label>
            <div className="notice"><strong>Accepted columns</strong><p className="muted">platform, metric, value, date, artist, release, source_url. Artist and release are optional but must match ArtistOS names when provided.</p></div>
            <button className="button primary" type="submit">Import metrics</button>
          </form>
          <p className="muted">Repeated imports of the same file are idempotent. Each import creates a Proof receipt instead of silently overwriting provenance.</p>
        </section>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <section className="card stack">
          <div className="section-heading"><div><div className="eyebrow">Market intelligence pilot</div><h2>Soundcharts</h2><p className="muted">Resolve your Spotify identity into cross-platform audience and playlist intelligence.</p></div><span className={`pill ${soundchartsTokenCurrent ? "" : "blocked"}`}>{soundchartsTokenCurrent ? "Connected" : "Credentials required"}</span></div>
          <div className="row"><span>Last successful sync</span><strong>{formatDate(soundcharts?.last_success_at)}</strong></div>
          <div className="row"><span>Free starting allowance</span><strong>1,000 production requests</strong></div>
          {soundcharts?.last_error ? <div className="notice"><strong>Last error</strong><p className="muted">{soundcharts.last_error}</p></div> : null}
          {!encryptionConfigured ? <div className="notice"><strong>Encryption key required first.</strong><p className="muted">Set ARTISTOS_TOKEN_ENCRYPTION_KEY before saving Soundcharts credentials.</p></div> : null}
          {!soundchartsTokenCurrent ? (
            <form action={connectApiProvider} className="stack">
              <input type="hidden" name="provider" value="soundcharts" />
              <label className="field"><span>Soundcharts client ID</span><input className="input" type="password" name="primarySecret" autoComplete="off" required disabled={!encryptionConfigured} /></label>
              <label className="field"><span>Soundcharts client secret</span><input className="input" type="password" name="secondarySecret" autoComplete="off" required disabled={!encryptionConfigured} /></label>
              <label className="field"><span>Team ID or name</span><input className="input" name="teamId" placeholder="Optional when one team exists" disabled={!encryptionConfigured} /></label>
              <button className="button primary" type="submit" disabled={!encryptionConfigured}>Validate and save Soundcharts</button>
            </form>
          ) : (
            <form action={syncSoundcharts} className="stack">
              <label className="field"><span>Artist to sync</span><select className="input" name="artistId" required><option value="">Choose artist</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
              <button className="button primary" type="submit">Sync Soundcharts now</button>
            </form>
          )}
          <p className="muted">Credentials are encrypted. ArtistOS requests short-lived access tokens server-side and records only entitled aggregate observations plus Proof receipts.</p>
        </section>

        <section className="card stack">
          <div className="section-heading"><div><div className="eyebrow">Owned audience source</div><h2>Kit</h2><p className="muted">Subscriber totals and aggregate broadcast recipients, opens, clicks, and unsubscribes.</p></div><span className={`pill ${kitTokenCurrent ? "" : "blocked"}`}>{kitTokenCurrent ? "Connected" : "API key required"}</span></div>
          <div className="row"><span>Last successful sync</span><strong>{formatDate(kit?.last_success_at)}</strong></div>
          <div className="row"><span>Stored source data</span><strong>Aggregate metrics only</strong></div>
          {kit?.last_error ? <div className="notice"><strong>Last error</strong><p className="muted">{kit.last_error}</p></div> : null}
          {!encryptionConfigured ? <div className="notice"><strong>Encryption key required first.</strong><p className="muted">Set ARTISTOS_TOKEN_ENCRYPTION_KEY before saving the Kit API key.</p></div> : null}
          {!kitTokenCurrent ? (
            <form action={connectApiProvider} className="stack">
              <input type="hidden" name="provider" value="kit" />
              <label className="field"><span>Kit v4 API key</span><input className="input" type="password" name="primarySecret" autoComplete="off" required disabled={!encryptionConfigured} /></label>
              <label className="field"><span>Account label</span><input className="input" name="accountLabel" placeholder="Middle Child email list" disabled={!encryptionConfigured} /></label>
              <button className="button primary" type="submit" disabled={!encryptionConfigured}>Validate and save Kit</button>
            </form>
          ) : <form action={syncKit}><button className="button primary" type="submit">Sync Kit now</button></form>}
          <p className="muted">The first sync does not copy raw emails into ArtistOS. Fan-CRM reconciliation will be a separate consent and deduplication workflow.</p>
        </section>
      </section>

      <FreeSourcePanels />

      <section style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Core platform identities</h2><p className="muted">Map the correct artist profile first. This prevents metrics and releases from attaching to the wrong artist with a similar name.</p></div><span className="pill">{corePlatforms.length} core sources</span></div>
        <div className="grid two-col">
          {corePlatforms.map((platform) => {
            const mappedProfiles = profilesByPlatform.get(platform.id) ?? [];
            const coverage = SOURCE_COVERAGE_BY_SLUG.get(platform.slug);
            const platformMetrics = metricCounts.get(platform.slug) ?? metricCounts.get(platform.slug.replace(/-/g, "_")) ?? 0;
            return (
              <article className="card stack" key={platform.id}>
                <div className="section-heading"><div><h3>{platform.name}</h3><p className="muted">{coverage?.summary ?? `${platform.category} source with ${platform.supported_modes.join(", ")} coverage.`}</p></div><span className="pill">{platform.priority}</span></div>
                <div className="row"><span>Supported modes</span><span>{platform.supported_modes.join(" · ")}</span></div>
                <div className="row"><span>Stored snapshots</span><strong>{platformMetrics}</strong></div>
                <div className="row"><span>Latest data</span><strong>{latestMetricDate.get(platform.slug) ?? latestMetricDate.get(platform.slug.replace(/-/g, "_")) ?? "None"}</strong></div>
                {mappedProfiles.length ? mappedProfiles.map((profile) => <div className="notice" key={profile.id}><strong>{profile.artist_name}</strong><p className="muted">{profile.profile_url ?? profile.external_artist_id ?? "Identity saved"}</p><div className="tag-row"><span className="pill">{profile.connection_state}</span><span className="pill">{profile.source_type}</span><span className="pill">{profile.freshness_status}</span></div></div>) : <div className="empty">No artist profile is mapped.</div>}
                <form action={savePlatformProfile} className="stack">
                  <input type="hidden" name="platformId" value={platform.id} />
                  <label className="field"><span>Artist</span><select className="input" name="artistId" required><option value="">Choose artist</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
                  <label className="field"><span>Profile URL</span><input className="input" type="url" name="profileUrl" placeholder="https://..." /></label>
                  <label className="field"><span>External artist/channel ID</span><input className="input" name="externalArtistId" placeholder="Optional platform ID" /></label>
                  <button className="button" type="submit">Save profile identity</button>
                </form>
                {coverage?.limitation ? <p className="muted">{coverage.limitation}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Additional distribution coverage</h2><p className="muted">These stores are tracked for release identity and distributor reporting even when they do not expose artist analytics APIs.</p></div><span className="pill">{otherPlatforms.length} sources</span></div>
        {otherPlatforms.map((platform) => {
          const mapped = profilesByPlatform.get(platform.id)?.length ?? 0;
          return <div className="row" key={platform.id}><div><strong>{platform.name}</strong><p className="muted">{platform.category} · {platform.supported_modes.join(" · ")}</p></div><div className="tag-row"><span className="pill">{mapped} profiles</span><span className="pill">{metricCounts.get(platform.slug) ?? 0} snapshots</span></div></div>;
        })}
      </section>

      <section className="card">
        <div className="section-heading"><div><h2>Free and paid connector roadmap</h2><p className="muted">Coverage is classified by what the provider actually permits, not by what a dashboard mockup implies.</p></div></div>
        {SOURCE_COVERAGE.filter((source) => !platforms.some((platform) => platform.slug === source.slug) && !["soundcharts", "kit", "lastfm", "listenbrainz", "musicbrainz", "ticketmaster"].includes(source.slug)).map((source) => <div className="row" key={source.slug}><div><strong>{source.label}</strong><p className="muted">{source.summary}{source.limitation ? ` ${source.limitation}` : ""}</p></div><div className="tag-row"><span className="pill">{statusLabel(source.connection)}</span><span className={`pill ${source.status !== "available" ? "blocked" : ""}`}>{statusLabel(source.status)}</span></div></div>)}
      </section>
    </main>
  );
}
