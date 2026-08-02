import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeFollowUp, signOut, toggleTask } from "./actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "No date set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value ?? 0);
}

function sourceTone(status: string) {
  return status === "verified" || status === "current" ? "success" : status === "blocked" || status === "needs attention" ? "blocked" : "";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const { error } = await supabase.rpc("ensure_artistos_workspace");
    if (error) {
      return <main className="login-page"><section className="card stack"><div className="eyebrow">Workspace setup</div><h1>We could not finish onboarding</h1><p className="muted">Your account is authenticated, but ArtistOS could not create your workspace.</p><div className="notice">{error.message}</div><Link className="button primary" href="/dashboard">Try again</Link></section></main>;
    }
    redirect("/dashboard");
  }

  const workspaceId = membership.workspace_id;
  const today = new Date().toISOString().slice(0, 10);
  const [
    workspaceResult,
    artistsResult,
    releasesResult,
    tasksResult,
    followUpsResult,
    peopleCountResult,
    organizationsCountResult,
    fansCountResult,
    verifiedFansCountResult,
    suppressionsCountResult,
    recommendationResult,
    metricsResult,
    oauthResult,
    profilesResult,
    platformsResult,
    campaignsCountResult,
    outcomesCountResult,
    smartLinksCountResult,
    linkEventsCountResult,
    evidenceCountResult,
    brainMemoriesCountResult,
  ] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", workspaceId).single(),
    supabase.from("artists").select("id,name,genre_tags,spotify_url").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    supabase.from("releases").select("id,artist_id,title,featured_artist,release_date,status,spotify_url,upc,isrc").eq("workspace_id", workspaceId).order("release_date", { ascending: false, nullsFirst: false }),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("sort_order", { ascending: true }),
    supabase.from("interactions").select("id, subject, channel, follow_up_due, follow_up_done").eq("workspace_id", workspaceId).lte("follow_up_due", today).eq("follow_up_done", false).order("follow_up_due", { ascending: true }).limit(20),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("verification_status", "Deliverable").is("archived_at", null),
    supabase.from("suppressions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("recommendations").select("id,title,priority,rationale,action_path").eq("workspace_id", workspaceId).in("status", ["open", "accepted"]).order("created_at", { ascending: false }).limit(4),
    supabase.from("metric_snapshots").select("platform,metric,value,captured_on,source_url,release_id").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(250),
    supabase.from("oauth_connections").select("provider,account_email,last_success_at,last_error,expires_at,metadata").eq("workspace_id", workspaceId).eq("user_id", userData.user.id),
    supabase.from("artist_platform_profiles").select("platform_id,artist_name,connection_state,source_type,last_synced_at,last_verified_at,freshness_status,profile_url").eq("workspace_id", workspaceId),
    supabase.from("music_platforms").select("id,slug,name,priority").eq("active", true),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("outcomes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("smart_links").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("link_events").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("evidence_records").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("brain_memories").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const workspace = workspaceResult.data;
  const artists = artistsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const release = releases[0] ?? null;
  const activeArtist = artists.find((artist) => artist.id === release?.artist_id) ?? artists.find((artist) => artist.name === "Middle Child") ?? artists[0] ?? null;
  const tasks = tasksResult.data ?? [];
  const followUps = followUpsResult.data ?? [];
  const recommendations = recommendationResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const oauthConnections = oauthResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const platforms = platformsResult.data ?? [];

  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "skipped");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const blockedTasks = openTasks.filter((task) => task.blocked_by && !task.blocker_cleared);
  const actionableTasks = openTasks.filter((task) => !task.blocked_by || task.blocker_cleared).slice(0, 6);
  const releaseCountdown = daysUntil(release?.release_date);
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const profileBySlug = new Map(profiles.map((profile) => [platformById.get(profile.platform_id)?.slug ?? profile.platform_id, profile]));
  const oauthByProvider = new Map(oauthConnections.map((connection) => [connection.provider, connection]));

  const latestMetric = (platform: string, metric: string) => metrics.find((item) => item.platform === platform && item.metric === metric) ?? null;
  const monthlyListeners = latestMetric("spotify", "monthly_listeners");
  const publicStreams = latestMetric("spotify", "public_streams");
  const shazams = latestMetric("shazam", "shazams");
  const google = oauthByProvider.get("google") ?? null;
  const youtubeError = typeof google?.metadata?.youtube_error === "string" ? google.metadata.youtube_error : null;
  const spotifyProfile = profileBySlug.get("spotify") ?? null;
  const youtubeProfile = profileBySlug.get("youtube") ?? profileBySlug.get("youtube-music") ?? null;
  const kit = oauthByProvider.get("kit") ?? null;
  const soundcharts = oauthByProvider.get("soundcharts") ?? null;

  const sourceCards = [
    {
      name: "Google + YouTube",
      status: google ? (youtubeError ? "needs attention" : google.last_success_at ? "verified" : "configured") : "not connected",
      detail: google ? (youtubeError ? "Google is authorized, but YouTube APIs still need to be enabled and synced." : `Last successful provider request ${formatDate(google.last_success_at)}.`) : "Connect the owned Google account and run a verified YouTube sync.",
    },
    {
      name: "Spotify",
      status: spotifyProfile ? "current" : "not connected",
      detail: spotifyProfile ? `Identity confirmed${monthlyListeners ? ` · ${formatNumber(Number(monthlyListeners.value))} monthly listeners as of ${formatDate(monthlyListeners.captured_on)}` : ""}.` : "Confirm the canonical Middle Child Spotify artist identity.",
    },
    {
      name: "Kit",
      status: kit?.last_success_at ? "verified" : kit ? "configured" : "not connected",
      detail: kit?.last_success_at ? `Aggregate audience metrics last synced ${formatDate(kit.last_success_at)}.` : "The connector is built. Add and validate the Kit v4 API key.",
    },
    {
      name: "Soundcharts",
      status: soundcharts?.last_success_at ? "verified" : soundcharts ? "configured" : "not connected",
      detail: soundcharts?.last_success_at ? `Market intelligence last synced ${formatDate(soundcharts.last_success_at)}.` : "The connector is built. Credentials and a verified request are still required.",
    },
  ];

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><div className="logo">A</div><div><div className="eyebrow">Private artist workspace</div><strong>{workspace?.name ?? "ArtistOS"}</strong></div></div>
      <div className="nav-links"><Link className="button primary" href="/command-center">Command Center</Link><Link className="button ghost" href="/releases">Releases</Link><Link className="button ghost" href="/connections">Sources</Link><Link className="button ghost" href="/analytics">Intelligence</Link><Link className="button ghost" href="/targets">Network</Link><Link className="button ghost" href="/opportunities">Opportunities</Link><form action={signOut}><button className="button ghost" type="submit">Sign out</button></form></div>
    </header>

    <section className="card release-card" style={{ marginBottom: 16 }}>
      <div className="section-heading tight"><div><div className="eyebrow">{activeArtist?.name ?? "Current artist"}</div><h1>{release?.title ?? "Create your first release"}</h1><p className="muted">{release ? `${formatDate(release.release_date)}${releaseCountdown === null ? "" : releaseCountdown > 0 ? ` · ${releaseCountdown} days remaining` : releaseCountdown === 0 ? " · Release day" : ` · Released ${Math.abs(releaseCountdown)} days ago`}` : "ArtistOS will organize releases, sources, campaigns, relationships, evidence, and learning here."}</p></div>{release?.status ? <span className="pill">{release.status}</span> : null}</div>
      <div className="tag-row"><Link className="button primary" href="/releases">Open release workspace</Link><Link className="button ghost" href="/campaigns">Campaign Intelligence</Link><Link className="button ghost" href="/links">ArtistOS Links</Link><Link className="button ghost" href="/proof">Proof</Link><Link className="button ghost" href="/brain">Artist Brain</Link>{release?.spotify_url ? <a className="button ghost" href={release.spotify_url} target="_blank" rel="noreferrer">Open on Spotify</a> : null}</div>
    </section>

    <section className="grid stats" style={{ marginBottom: 16 }}>
      <div className="card"><div className="eyebrow">Spotify listeners</div><div className="stat-value">{monthlyListeners ? formatNumber(Number(monthlyListeners.value)) : "No current snapshot"}</div><p className="muted">{monthlyListeners ? `Public snapshot · ${formatDate(monthlyListeners.captured_on)}` : "Import or sync a source"}</p></div>
      <div className="card"><div className="eyebrow">Mercy streams</div><div className="stat-value">{publicStreams ? formatNumber(Number(publicStreams.value)) : "No snapshot"}</div><p className="muted">{publicStreams ? `Public Spotify count · ${formatDate(publicStreams.captured_on)}` : "No public count loaded"}</p></div>
      <div className="card"><div className="eyebrow">Imported fan records</div><div className="stat-value">{formatNumber(fansCountResult.count)}</div><p className="muted">{formatNumber(verifiedFansCountResult.count)} marked deliverable; suppression and consent must still be checked before sending.</p></div>
      <div className="card"><div className="eyebrow">Industry contacts</div><div className="stat-value">{formatNumber(peopleCountResult.count)}</div><p className="muted">Across {formatNumber(organizationsCountResult.count)} organizations</p></div>
    </section>

    <section className="grid two-col" style={{ marginBottom: 16 }}>
      <div className="stack">
        <div className="card">
          <div className="section-heading"><div><h2>Source health</h2><p className="muted">What is identified, configured, authorized, and provider-verified.</p></div><Link className="next-action" href="/connections">Manage sources →</Link></div>
          <div className="grid two-col" style={{ marginTop: 12 }}>{sourceCards.map((source) => <div className="card" key={source.name}><div className="section-heading tight"><strong>{source.name}</strong><span className={`pill ${sourceTone(source.status)}`}>{source.status}</span></div><p className="muted">{source.detail}</p></div>)}</div>
          {youtubeProfile && youtubeError ? <div className="notice" style={{ marginTop: 12 }}><strong>YouTube needs one owner action.</strong><p className="muted">Enable YouTube Data API v3 and YouTube Analytics API in the connected Google Cloud project, then reconnect and sync.</p></div> : null}
        </div>

        {recommendations.length ? <div className="card"><div className="section-heading"><h2>ArtistOS recommends</h2><Link className="next-action" href="/command-center">View all →</Link></div>{recommendations.map((item) => <div className="row" key={item.id}><div><span className="pill">{item.priority}</span><strong style={{ display: "block", marginTop: 8 }}>{item.title}</strong>{item.rationale ? <p className="muted">{item.rationale}</p> : null}</div>{item.action_path ? <Link className="button" href={item.action_path}>Open</Link> : null}</div>)}</div> : null}

        <div className="card"><h2>Do next</h2>{actionableTasks.length ? actionableTasks.map((task) => <div className="row" key={task.id}><div><strong>{task.title}</strong>{task.detail ? <p className="muted">{task.detail}</p> : null}</div><form action={toggleTask}><input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="currentStatus" value={task.status ?? "open"}/><button className="button" type="submit">Complete</button></form></div>) : <div className="empty">No actionable tasks.</div>}</div>
        {blockedTasks.length ? <div className="card"><h2>Blocked</h2>{blockedTasks.map((task) => <div className="row" key={task.id}><div><strong>{task.title}</strong><p className="muted">{task.blocked_by}</p></div><span className="pill blocked">Blocked</span></div>)}</div> : null}
      </div>

      <aside className="stack">
        <div className="card"><h2>Workspace data</h2><div className="row"><span>Releases</span><strong>{releases.length}</strong></div><div className="row"><span>Campaigns</span><strong>{campaignsCountResult.count ?? 0}</strong></div><div className="row"><span>Recorded outcomes</span><strong>{outcomesCountResult.count ?? 0}</strong></div><div className="row"><span>Smart links</span><strong>{smartLinksCountResult.count ?? 0}</strong></div><div className="row"><span>Link events</span><strong>{linkEventsCountResult.count ?? 0}</strong></div><div className="row"><span>Proof records</span><strong>{evidenceCountResult.count ?? 0}</strong></div><div className="row"><span>Artist Brain memories</span><strong>{brainMemoriesCountResult.count ?? 0}</strong></div><div className="row"><span>Suppression records</span><strong>{suppressionsCountResult.count ?? 0}</strong></div>{shazams ? <div className="row"><span>Mercy Shazams</span><strong>{formatNumber(Number(shazams.value))}</strong></div> : null}</div>

        <div className="card"><h2>Follow-ups due</h2>{followUps.length ? followUps.map((interaction) => <div className="row" key={interaction.id}><div><strong>{interaction.subject || interaction.channel || "Outreach"}</strong><p className="muted">{formatDate(interaction.follow_up_due)}</p></div><form action={completeFollowUp}><input type="hidden" name="interactionId" value={interaction.id}/><button className="button" type="submit">Done</button></form></div>) : <div className="empty">No overdue follow-ups.</div>}</div>

        <div className="card"><h2>Workspace health</h2><div className="row"><span>Membership</span><span className="pill">{membership.role}</span></div><div className="row"><span>Release tasks</span><span>{doneTasks.length}/{tasks.length}</span></div><div className="row"><span>Blocked items</span><span>{blockedTasks.length}</span></div><div className="notice" style={{ marginTop: 12 }}><strong>Execution remains human-controlled.</strong><p className="muted">ArtistOS can organize, prepare, and verify work. Sending, publishing, spending, deletion, access changes, and production rollout still require explicit approval.</p></div></div>
      </aside>
    </section>
  </main>;
}
