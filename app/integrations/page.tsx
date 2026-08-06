import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";

type Status = "verified" | "authorized" | "configured" | "identified" | "export" | "partner" | "manual" | "blocked";

type IntegrationCard = {
  name: string;
  status: Status;
  detail: string;
  href: string;
  action: string;
};

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    verified: "Provider verified",
    authorized: "Authorized",
    configured: "Configured",
    identified: "Identity verified",
    export: "Export workflow",
    partner: "Partner access",
    manual: "Human-approved",
    blocked: "Needs owner action",
  };
  return labels[status];
}

function statusTone(status: Status) {
  if (["verified", "authorized", "configured", "identified"].includes(status)) return "success";
  if (status === "blocked") return "blocked";
  return "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function Cards({ items }: { items: IntegrationCard[] }) {
  return <div className="grid two-col">{items.map((item) => <article className="card stack" key={item.name}>
    <div className="section-heading tight"><strong>{item.name}</strong><span className={`pill ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></div>
    <p className="muted">{item.detail}</p>
    <Link className="button" href={item.href}>{item.action}</Link>
  </article>)}</div>;
}

export default async function IntegrationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");

  const workspaceId = membership.workspace_id;
  const [oauthResult, platformsResult, profilesResult, identitiesResult, metricsResult, releasesResult] = await Promise.all([
    supabase.from("oauth_connections").select("provider,last_success_at,last_error,metadata,encrypted_access_token,encrypted_refresh_token").eq("workspace_id", workspaceId).eq("user_id", auth.user.id),
    supabase.from("music_platforms").select("id,slug,name").eq("active", true),
    supabase.from("artist_platform_profiles").select("platform_id,connection_state,profile_url,last_verified_at").eq("workspace_id", workspaceId),
    supabase.from("artist_external_identities").select("provider,external_id,verification_status,last_verified_at").eq("workspace_id", workspaceId),
    supabase.from("metric_snapshots").select("platform,captured_on").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(5000),
    supabase.from("releases").select("id,isrc,status").eq("workspace_id", workspaceId),
  ]);

  const oauth = oauthResult.data ?? [];
  const platforms = platformsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const identities = identitiesResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const oauthByProvider = new Map(oauth.map((connection) => [connection.provider, connection]));
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const profileBySlug = new Map(profiles.map((profile) => [platformById.get(profile.platform_id)?.slug ?? profile.platform_id, profile]));
  const identityByProvider = new Map(identities.map((identity) => [identity.provider, identity]));
  const metricPlatforms = new Set(metrics.map((metric) => metric.platform));

  const google = oauthByProvider.get("google") ?? null;
  const googleMetadata = asObject(google?.metadata);
  const youtubeVerified = Boolean(google?.last_success_at && !googleMetadata.youtube_error && googleMetadata.youtube_channel_id);
  const googleAuthorized = isCurrentTokenEnvelope(google?.encrypted_access_token);
  const soundcharts = oauthByProvider.get("soundcharts") ?? null;
  const soundchartsConfigured = isCurrentTokenEnvelope(soundcharts?.encrypted_access_token) && isCurrentTokenEnvelope(soundcharts?.encrypted_refresh_token);
  const spotontrack = oauthByProvider.get("spotontrack") ?? null;
  const spotontrackConfigured = isCurrentTokenEnvelope(spotontrack?.encrypted_access_token);
  const kit = oauthByProvider.get("kit") ?? null;
  const kitConfigured = isCurrentTokenEnvelope(kit?.encrypted_access_token);
  const lastfm = oauthByProvider.get("lastfm") ?? null;
  const lastfmConfigured = isCurrentTokenEnvelope(lastfm?.encrypted_access_token);
  const ticketmaster = oauthByProvider.get("ticketmaster") ?? null;
  const ticketmasterConfigured = isCurrentTokenEnvelope(ticketmaster?.encrypted_access_token);
  const spotifyIdentified = Boolean(profileBySlug.get("spotify"));
  const musicBrainzIdentity = identityByProvider.get("musicbrainz") ?? null;
  const listenBrainzIdentity = identityByProvider.get("listenbrainz") ?? musicBrainzIdentity;
  const releasesWithIsrc = releases.filter((release) => release.isrc).length;

  const intelligence: IntegrationCard[] = [
    {
      name: "Google + YouTube",
      status: youtubeVerified ? "verified" : googleAuthorized ? "authorized" : "blocked",
      detail: youtubeVerified ? `Owned channel request verified ${formatDate(google?.last_success_at)}.` : googleAuthorized ? "Google is authorized. Enable the YouTube APIs and complete a channel sync." : "OAuth and YouTube API owner setup are required.",
      href: "/connections",
      action: youtubeVerified ? "Review YouTube source" : "Finish YouTube setup",
    },
    {
      name: "Soundcharts",
      status: soundcharts?.last_success_at ? "verified" : soundchartsConfigured ? "configured" : "blocked",
      detail: soundcharts?.last_success_at ? `Cross-platform intelligence verified ${formatDate(soundcharts.last_success_at)}.` : "Licensed market-intelligence connector is built; client credentials are still required.",
      href: "/connections",
      action: soundchartsConfigured ? "Run Soundcharts sync" : "Connect Soundcharts",
    },
    {
      name: "Spotontrack",
      status: spotontrack?.last_success_at ? "verified" : spotontrackConfigured ? "configured" : "blocked",
      detail: spotontrack?.last_success_at ? `Exact-ISRC provider request verified ${formatDate(spotontrack.last_success_at)}.` : `${releasesWithIsrc} release${releasesWithIsrc === 1 ? "" : "s"} ready for exact-ISRC sync after an API key is added.`,
      href: "/connections/spotontrack",
      action: spotontrackConfigured ? "Sync a release" : "Connect Spotontrack",
    },
    {
      name: "Spotify for Artists",
      status: spotifyIdentified ? "identified" : "blocked",
      detail: spotifyIdentified ? "Canonical public artist identity is verified. Private artist-dashboard analytics remain an export workflow." : "The canonical Spotify artist identity must be confirmed first.",
      href: "/connections",
      action: "Import Spotify export",
    },
    {
      name: "Last.fm",
      status: lastfm?.last_success_at ? "verified" : lastfmConfigured ? "configured" : "blocked",
      detail: lastfm?.last_success_at ? `Public popularity data verified ${formatDate(lastfm.last_success_at)}.` : "Free public listeners, playcounts, top tracks, and similar-artist signals require an API key and confirmed identity.",
      href: "/connections",
      action: lastfmConfigured ? "Run Last.fm sync" : "Configure Last.fm",
    },
    {
      name: "MusicBrainz + ListenBrainz",
      status: musicBrainzIdentity && listenBrainzIdentity ? "identified" : "blocked",
      detail: musicBrainzIdentity ? "Stable public identity is present for open metadata and listening signals." : "No safe external identity is stored. ArtistOS will not name-match Middle Child automatically.",
      href: "/connections",
      action: musicBrainzIdentity ? "Sync open sources" : "Confirm exact identity",
    },
    {
      name: "Ticketmaster",
      status: ticketmaster?.last_success_at ? "verified" : ticketmasterConfigured ? "configured" : "blocked",
      detail: ticketmaster?.last_success_at ? `Event request verified ${formatDate(ticketmaster.last_success_at)}.` : "A confirmed attraction ID and developer key are required before event discovery can run.",
      href: "/connections",
      action: ticketmasterConfigured ? "Sync events" : "Configure Ticketmaster",
    },
    {
      name: "Kit",
      status: kit?.last_success_at ? "verified" : kitConfigured ? "configured" : "blocked",
      detail: kit?.last_success_at ? `Aggregate audience data verified ${formatDate(kit.last_success_at)}.` : "The connector stores aggregate subscriber and broadcast metrics without copying raw contacts.",
      href: "/connections",
      action: kitConfigured ? "Sync Kit" : "Connect Kit",
    },
  ];

  const licensed: IntegrationCard[] = [
    { name: "Chartmetric", status: "partner", detail: "Optional licensed adapter for catalog, playlist, radio, social, and market data when Soundcharts and Spotontrack leave a documented gap.", href: "/analytics", action: "Review intelligence gaps" },
    { name: "Viberate", status: "partner", detail: "Optional licensed adapter. Add only when its data materially improves a decision that current sources cannot support.", href: "/analytics", action: "Review intelligence coverage" },
    { name: "Songstats", status: "partner", detail: "Developer access is not configured. Treat as a future partner feed, not as connected analytics.", href: "/analytics", action: "Review source roadmap" },
    { name: "LANDR", status: "partner", detail: "Mastering API access requires a commercial partnership. Release tools can prepare approved masters and hand off while partnership access is pursued.", href: "/studio", action: "Open release tools" },
  ];

  const submissions: IntegrationCard[] = [
    { name: "SubmitHub", status: "manual", detail: "ArtistOS prepares the release, fit rationale, pitch, links, budget, approval, submission record, follow-up, and outcome. Final portal submission stays human-controlled.", href: "/campaigns", action: "Open Campaign Intelligence" },
    { name: "Groover", status: "manual", detail: "Use the same campaign target and Proof graph while recording portal status, feedback, deliverables, and outcomes.", href: "/campaigns", action: "Prepare Groover campaign" },
    { name: "One Submit", status: "manual", detail: "Record spend, selected package, submitted assets, provider claims, responses, placements, and verified outcomes without assuming results.", href: "/campaigns", action: "Prepare submission" },
    { name: "PlaylistPitch", status: "manual", detail: "Keep targeting, approval, spend, evidence, and post-campaign learning inside ArtistOS even when the final action occurs in an external portal.", href: "/campaigns", action: "Prepare playlist campaign" },
    { name: "Spotify editorial pitch", status: "manual", detail: "Build the pitch and readiness packet in Release Workspace, then complete the final editorial submission in Spotify for Artists before release.", href: "/releases", action: "Open Release Workspace" },
  ];

  const creation: IntegrationCard[] = [
    { name: "Release creator tools", status: "configured", detail: "Release-grounded positioning, pitches, content concepts, originality review, asset approval, and reusable creative context.", href: "/studio", action: "Create release content" },
    { name: "Content scheduler", status: "configured", detail: "Plan approved content against releases and campaigns. Publishing remains gated until each platform app is authorized and provider-verified.", href: "/automations", action: "Open scheduling" },
    { name: "YouTube publishing", status: youtubeVerified ? "authorized" : "blocked", detail: "Upload execution can be enabled only after the owned channel and developer project are verified. Publishing always requires human approval.", href: "/connections", action: "Review YouTube state" },
    { name: "TikTok + Meta publishing", status: "partner", detail: "Developer applications, permissions, account authorization, review, and real posting verification are still required. ArtistOS must not claim these channels connected beforehand.", href: "/studio", action: "Prepare approved content" },
  ];

  return <>
    <AppHeader />
    <main className="shell">
    <header className="app-page-heading">
      <div><div className="eyebrow">Workspace settings</div><h1>Integrations</h1><p>Manage the services that support your release, pitching, content and measurement workflows.</p></div>
      <Link className="button ghost" href="/settings">Back to settings</Link>
    </header>

    <section className="grid stats" style={{ marginBottom: 16 }}>
      <div className="card"><div className="eyebrow">Credential records</div><div className="stat-value">{oauth.length}</div></div>
      <div className="card"><div className="eyebrow">Mapped identities</div><div className="stat-value">{profiles.length + identities.length}</div></div>
      <div className="card"><div className="eyebrow">Sources with data</div><div className="stat-value">{metricPlatforms.size}</div></div>
      <div className="card"><div className="eyebrow">ISRC-ready releases</div><div className="stat-value">{releasesWithIsrc}</div></div>
    </section>

    <section style={{ marginBottom: 24 }}><div className="section-heading"><div><div className="eyebrow">Performance</div><h2>Connected insights and artist-owned data</h2><p className="muted">Bring trusted performance signals into ArtistOS while keeping their source visible.</p></div></div><Cards items={intelligence} /></section>
    <section style={{ marginBottom: 24 }}><div className="section-heading"><div><div className="eyebrow">Specialist services</div><h2>Licensed and partner integrations</h2><p className="muted">Add specialist services when they support a specific release or measurement goal.</p></div></div><Cards items={licensed} /></section>
    <section style={{ marginBottom: 24 }}><div className="section-heading"><div><div className="eyebrow">Pitching</div><h2>Submission services</h2><p className="muted">Prepare and track each submission in ArtistOS, then complete any required final step on the connected service.</p></div></div><Cards items={submissions} /></section>
    <section style={{ marginBottom: 24 }}><div className="section-heading"><div><div className="eyebrow">Content</div><h2>Creation and publishing</h2><p className="muted">Create from your release workspace, approve deliberately and publish through authorized services.</p></div></div><Cards items={creation} /></section>

    <section className="card stack">
      <div className="section-heading"><div><div className="eyebrow">Connected by design</div><h2>Keep every service tied to the release</h2></div><span className="pill">ArtistOS</span></div>
      <p className="muted">Connections should make Today, Network, Releases, Campaigns and Insights more useful without creating another workflow to manage.</p>
      <div className="tag-row"><Link className="button primary" href="/dashboard">Open Today</Link><Link className="button" href="/campaigns">Campaigns</Link><Link className="button" href="/releases">Releases</Link><Link className="button" href="/analytics">Insights</Link></div>
    </section>
    </main>
  </>;
}
