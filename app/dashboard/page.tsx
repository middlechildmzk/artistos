import { ArrowRight, CalendarClock, Check, CircleDot, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeFollowUp, toggleTask } from "./actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((new Date(value + "T00:00:00Z").getTime() - Date.now()) / 86_400_000);
}

function formatNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { notation: number >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(number);
}

function readable(value: string | null | undefined) {
  return (value || "Other").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ releaseId?: string }>;
}) {
  const requestedReleaseId = (await searchParams).releaseId ?? null;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const { error } = await supabase.rpc("ensure_artistos_workspace");
    if (error) {
      return (
        <main className="login-page">
          <section className="card stack">
            <div className="eyebrow">Workspace setup</div>
            <h1>We could not finish onboarding</h1>
            <p className="muted">Your account is ready, but ArtistOS could not create the workspace.</p>
            <div className="notice">{error.message}</div>
            <Link className="button primary" href="/dashboard">Try again</Link>
          </section>
        </main>
      );
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
    recommendationResult,
    metricsResult,
    opportunitiesResult,
  ] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    supabase.from("releases").select("id,artist_id,title,featured_artist,release_date,status,subgenre_tags,mood_tags,spotify_url").eq("workspace_id", workspaceId).order("release_date", { ascending: false, nullsFirst: false }),
    supabase.from("tasks").select("id,release_id,title,detail,status,due_date,blocked_by,blocker_cleared,sort_order").eq("workspace_id", workspaceId).order("sort_order", { ascending: true }),
    supabase.from("interactions").select("id,subject,channel,follow_up_due,follow_up_done").eq("workspace_id", workspaceId).lte("follow_up_due", today).eq("follow_up_done", false).order("follow_up_due", { ascending: true }).limit(5),
    supabase.from("recommendations").select("id,release_id,title,priority,rationale,action_path,due_date").eq("workspace_id", workspaceId).in("status", ["open", "accepted"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("metric_snapshots").select("platform,metric,value,captured_on,release_id").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(100),
    supabase.from("opportunities").select("id,title,opportunity_type,fit_score,summary,source_url,confidence").eq("workspace_id", workspaceId).neq("status", "rejected").order("fit_score", { ascending: false, nullsFirst: false }).limit(3),
  ]);

  const workspace = workspaceResult.data;
  const artists = artistsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const activeRelease = releases.find((item) => item.id === requestedReleaseId) ?? releases[0] ?? null;
  const activeArtist = artists.find((artist) => artist.id === activeRelease?.artist_id) ?? artists[0] ?? null;
  const releaseTasks = (tasksResult.data ?? []).filter((task) => !activeRelease || task.release_id === activeRelease.id);
  const openTasks = releaseTasks.filter((task) => !["done", "skipped"].includes(task.status));
  const actionableTasks = openTasks.filter((task) => !task.blocked_by || task.blocker_cleared);
  const completedTasks = releaseTasks.filter((task) => task.status === "done").length;
  const readiness = releaseTasks.length ? Math.round((completedTasks / releaseTasks.length) * 100) : 0;
  const countdown = daysUntil(activeRelease?.release_date);
  const recommendations = (recommendationResult.data ?? []).filter((item) => !item.release_id || !activeRelease || item.release_id === activeRelease.id);
  const followUps = followUpsResult.data ?? [];
  const opportunities = opportunitiesResult.data ?? [];

  const campaignResult = activeRelease
    ? await supabase.from("campaigns").select("id,name,status").eq("workspace_id", workspaceId).eq("release_id", activeRelease.id)
    : { data: [] };
  const campaigns = campaignResult.data ?? [];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const campaignTargets = campaignIds.length
    ? (await supabase.from("campaign_targets").select("id,status").in("campaign_id", campaignIds)).data ?? []
    : [];

  const priorities = [
    ...recommendations.map((item) => ({
      id: "recommendation-" + item.id,
      title: item.title,
      detail: item.rationale || "ArtistOS identified this as a useful next step.",
      href: item.action_path || "/network",
      priority: item.priority,
      taskId: null,
      taskStatus: null,
    })),
    ...actionableTasks.map((task) => ({
      id: "task-" + task.id,
      title: task.title,
      detail: task.detail || (task.due_date ? "Due " + formatDate(task.due_date) : "Ready to complete"),
      href: null,
      priority: task.due_date && task.due_date <= today ? "high" : "medium",
      taskId: task.id,
      taskStatus: task.status,
    })),
  ].slice(0, 5);

  const primaryAction = priorities[0] ?? (activeRelease
    ? { title: "Review the best new opportunity matches", detail: "Start with the strongest routes for " + activeRelease.title + ".", href: "/network?releaseId=" + activeRelease.id }
    : { title: "Create your first release", detail: "ArtistOS builds its recommendations and workflow around a release.", href: "/releases" });

  const relevantMetric = (metricsResult.data ?? []).find((metric) => metric.release_id === activeRelease?.id)
    ?? (metricsResult.data ?? [])[0]
    ?? null;
  const metricInsight = relevantMetric
    ? readable(relevantMetric.platform) + " " + readable(relevantMetric.metric).toLowerCase() + " is " + formatNumber(relevantMetric.value) + " as of " + formatDate(relevantMetric.captured_on) + "."
    : "Publish a release link to start learning which channels bring listeners and fans back to your music.";

  const campaignPulse = {
    queued: campaignTargets.filter((target) => target.status === "queued").length,
    pitched: campaignTargets.filter((target) => target.status === "pitched").length,
    replies: campaignTargets.filter((target) => target.status === "replied").length,
    results: campaignTargets.filter((target) => ["accepted", "placed"].includes(target.status)).length,
  };

  const releaseContext = [
    ...(activeRelease?.subgenre_tags ?? []),
    ...(activeRelease?.mood_tags ?? []),
  ].slice(0, 5);

  return (
    <>
      <AppHeader active="today" workspaceName={workspace?.name} />
      <main className="shell today-shell">
        <header className="app-page-heading">
          <div>
            <div className="eyebrow">Your artist workspace</div>
            <h1>Today</h1>
            <p>The few things that matter most for the release you are moving right now.</p>
          </div>
          {releases.length ? (
            <form className="release-context-picker" method="get">
              <label htmlFor="today-release">Current release</label>
              <div>
                <select id="today-release" name="releaseId" defaultValue={activeRelease?.id}>
                  {releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}
                </select>
                <button type="submit">Switch</button>
              </div>
            </form>
          ) : null}
        </header>

        <section className="today-release-hero">
          <div className="today-release-copy">
            <div className="today-artwork" aria-hidden="true">{activeRelease?.title.slice(0, 1).toUpperCase() || "A"}</div>
            <div>
              <span className="eyebrow">{activeArtist?.name || "Current artist"}</span>
              <h2>{activeRelease?.title || "Create your first release"}</h2>
              <p>
                {activeRelease
                  ? formatDate(activeRelease.release_date) + (countdown === null ? "" : countdown > 0 ? " · " + countdown + " days to release" : countdown === 0 ? " · Release day" : " · Released " + Math.abs(countdown) + " days ago")
                  : "ArtistOS will organize the people, campaigns and performance around it."}
              </p>
              {releaseContext.length ? <div className="tag-row">{releaseContext.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div> : null}
            </div>
          </div>
          <div className="today-readiness">
            <span>{readiness}% ready</span>
            <div className="progress"><i style={{ width: readiness + "%" }} /></div>
            <small>{completedTasks} of {releaseTasks.length} release tasks complete</small>
          </div>
        </section>

        <section className="today-primary-action">
          <div className="today-primary-icon"><Sparkles aria-hidden="true" size={20} /></div>
          <div>
            <span>Best next move</span>
            <h2>{primaryAction.title}</h2>
            <p>{primaryAction.detail}</p>
          </div>
          {"href" in primaryAction && primaryAction.href ? <Link href={primaryAction.href}>Open <ArrowRight aria-hidden="true" size={15} /></Link> : null}
        </section>

        <div className="today-grid">
          <section className="card today-priorities">
            <div className="section-heading tight">
              <div><span className="eyebrow">Priority actions</span><h2>Move the release forward</h2></div>
              <span className="pill">{priorities.length} today</span>
            </div>
            {priorities.length ? priorities.map((item, index) => (
              <div className="today-action-row" key={item.id}>
                <span className="today-action-number">{index + 1}</span>
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                {item.href ? <Link className="button ghost compact" href={item.href}>Open</Link> : item.taskId ? (
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={item.taskId} />
                    <input type="hidden" name="currentStatus" value={item.taskStatus || "open"} />
                    <button className="button ghost compact" type="submit"><Check aria-hidden="true" size={14} /> Done</button>
                  </form>
                ) : null}
              </div>
            )) : <div className="empty">No urgent actions. Review Network for new release opportunities.</div>}
          </section>

          <aside className="card today-followups">
            <div className="section-heading tight">
              <div><span className="eyebrow">Relationships</span><h2>Follow-ups due</h2></div>
              <CalendarClock aria-hidden="true" className="muted" size={18} />
            </div>
            {followUps.length ? followUps.map((interaction) => (
              <div className="today-followup-row" key={interaction.id}>
                <div><strong>{interaction.subject || readable(interaction.channel) || "Industry outreach"}</strong><span>{formatDate(interaction.follow_up_due)}</span></div>
                <form action={completeFollowUp}>
                  <input type="hidden" name="interactionId" value={interaction.id} />
                  <button aria-label="Complete follow-up" type="submit"><Check aria-hidden="true" size={14} /></button>
                </form>
              </div>
            )) : <div className="empty">Nothing overdue.</div>}
            <Link className="next-action" href="/targets?view=relationships">Open relationships →</Link>
          </aside>
        </div>

        <section className="card today-matches">
          <div className="section-heading">
            <div><span className="eyebrow">ArtistOS Network</span><h2>Strong opportunities to review</h2><p className="muted">Start with the most relevant routes, then inspect the fit evidence before saving.</p></div>
            <Link className="button primary" href={activeRelease ? "/network?releaseId=" + activeRelease.id : "/network"}>Explore Network</Link>
          </div>
          <div className="today-match-grid">
            {opportunities.map((opportunity) => (
              <article key={opportunity.id}>
                <div><span className="today-match-type">{readable(opportunity.opportunity_type)}</span><span className="today-match-score">{opportunity.fit_score == null ? "Review" : Math.round(Number(opportunity.fit_score)) + "% fit"}</span></div>
                <h3>{opportunity.title}</h3>
                <p>{opportunity.summary || "Open the opportunity to review its route, evidence and release fit."}</p>
                <Link href={"/network?releaseId=" + (activeRelease?.id || "")}>View fit <ArrowRight aria-hidden="true" size={13} /></Link>
              </article>
            ))}
          </div>
        </section>

        <div className="today-grid">
          <section className="card today-campaign-pulse">
            <div className="section-heading tight"><div><span className="eyebrow">Campaign pulse</span><h2>{campaigns.length ? campaigns[0].name : "No campaign started"}</h2></div><Link className="next-action" href="/campaigns">Open campaigns →</Link></div>
            <div className="today-pulse-grid">
              <div><strong>{campaignPulse.queued}</strong><span>Queued</span></div>
              <div><strong>{campaignPulse.pitched}</strong><span>Pitched</span></div>
              <div><strong>{campaignPulse.replies}</strong><span>Replies</span></div>
              <div><strong>{campaignPulse.results}</strong><span>Results</span></div>
            </div>
          </section>

          <aside className="card today-insight">
            <span className="eyebrow">One useful signal</span>
            <div className="today-insight-icon"><CircleDot aria-hidden="true" size={18} /></div>
            <p>{metricInsight}</p>
            <Link className="next-action" href="/analytics">See insights →</Link>
          </aside>
        </div>
      </main>
    </>
  );
}
