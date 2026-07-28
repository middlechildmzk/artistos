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

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id, role").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) {
    const { error } = await supabase.rpc("ensure_artistos_workspace");
    if (error) return <main className="login-page"><section className="card stack"><div className="eyebrow">Workspace setup</div><h1>We could not finish onboarding</h1><p className="muted">Your account is authenticated, but ArtistOS could not create your workspace.</p><div className="notice">{error.message}</div><Link className="button primary" href="/dashboard">Try again</Link></section></main>;
    redirect("/dashboard");
  }
  const workspaceId = membership.workspace_id;
  const today = new Date().toISOString().slice(0, 10);
  const [workspaceResult, releaseResult, tasksResult, followUpsResult, peopleCountResult, fansCountResult, recommendationResult] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", workspaceId).single(),
    supabase.from("releases").select("*").eq("workspace_id", workspaceId).order("release_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("sort_order", { ascending: true }),
    supabase.from("interactions").select("id, subject, channel, follow_up_due, follow_up_done").eq("workspace_id", workspaceId).lte("follow_up_due", today).eq("follow_up_done", false).order("follow_up_due", { ascending: true }).limit(20),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("contactable_fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("recommendations").select("id,title,priority,rationale,action_path").eq("workspace_id", workspaceId).in("status", ["open","accepted"]).order("created_at", { ascending: false }).limit(3),
  ]);
  const workspace = workspaceResult.data;
  const release = releaseResult.data;
  const tasks = tasksResult.data ?? [];
  const followUps = followUpsResult.data ?? [];
  const recommendations = recommendationResult.data ?? [];
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "skipped");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const blockedTasks = openTasks.filter((task) => task.blocked_by && !task.blocker_cleared);
  const actionableTasks = openTasks.filter((task) => !task.blocked_by || task.blocker_cleared).slice(0, 8);
  const releaseCountdown = daysUntil(release?.release_date);
  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="logo">A</div><div><div className="eyebrow">{workspace?.name ?? "ArtistOS workspace"}</div><strong>ArtistOS</strong></div></div><div className="nav-links"><Link className="button primary" href="/operating">AI Manager</Link><Link className="button ghost" href="/brain">Artist Brain</Link><Link className="button ghost" href="/command-center">Command</Link><Link className="button ghost" href="/releases">Releases</Link><Link className="button ghost" href="/campaigns">Campaigns</Link><Link className="button ghost" href="/opportunities">Opportunities</Link><Link className="button ghost" href="/targets">CRM</Link><Link className="button ghost" href="/studio">Studio</Link><Link className="button ghost" href="/analytics">Analytics</Link><Link className="button ghost" href="/automations">Automations</Link><form action={signOut}><button className="button ghost" type="submit">Sign out</button></form></div></header>
    <section className="card release-card" style={{ marginBottom: 16 }}><div className="eyebrow">Current release</div><h1>{release?.title ?? "Create your first release"}</h1><p className="muted">{release ? `${formatDate(release.release_date)}${releaseCountdown === null ? "" : releaseCountdown > 0 ? ` · ${releaseCountdown} days remaining` : releaseCountdown === 0 ? " · Release day" : ` · Released ${Math.abs(releaseCountdown)} days ago`}` : "ArtistOS will organize readiness, assets, campaigns, and outcomes here."}</p><div className="tag-row"><Link className="button primary" href="/operating">Tell AI Manager what to accomplish</Link><Link className="button ghost" href="/opportunities">Find opportunities</Link><Link className="button ghost" href="/brain">Open Artist Brain</Link><Link className="button ghost" href="/command-center">Open command center</Link><Link className="button ghost" href="/releases">Release workspace</Link></div></section>
    <section className="grid stats" style={{ marginBottom: 16 }}><div className="card"><div className="eyebrow">Open tasks</div><div className="stat-value">{openTasks.length}</div></div><div className="card"><div className="eyebrow">Completed</div><div className="stat-value">{doneTasks.length}</div></div><div className="card"><div className="eyebrow">Industry contacts</div><div className="stat-value">{peopleCountResult.count ?? 0}</div></div><div className="card"><div className="eyebrow">Contactable fans</div><div className="stat-value">{fansCountResult.count ?? 0}</div></div></section>
    <section className="grid two-col"><div className="stack">{recommendations.length ? <div className="card"><div className="section-heading"><h2>ArtistOS recommends</h2><Link className="next-action" href="/command-center">View all →</Link></div>{recommendations.map(item=><div className="row" key={item.id}><div><span className="pill">{item.priority}</span><strong style={{display:"block",marginTop:8}}>{item.title}</strong>{item.rationale ? <p className="muted">{item.rationale}</p> : null}</div>{item.action_path ? <Link className="button" href={item.action_path}>Open</Link> : null}</div>)}</div> : null}<div className="card"><h2>Do next</h2>{actionableTasks.length ? actionableTasks.map((task) => <div className="row" key={task.id}><div><strong>{task.title}</strong>{task.detail ? <p className="muted">{task.detail}</p> : null}</div><form action={toggleTask}><input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="currentStatus" value={task.status ?? "open"}/><button className="button" type="submit">Complete</button></form></div>) : <div className="empty">No actionable tasks.</div>}</div>{blockedTasks.length ? <div className="card"><h2>Blocked</h2>{blockedTasks.map(task=><div className="row" key={task.id}><div><strong>{task.title}</strong><p className="muted">{task.blocked_by}</p></div><span className="pill blocked">Blocked</span></div>)}</div> : null}</div>
    <aside className="stack"><div className="card"><h2>Follow-ups due</h2>{followUps.length ? followUps.map((interaction)=><div className="row" key={interaction.id}><div><strong>{interaction.subject || interaction.channel || "Outreach"}</strong><p className="muted">{formatDate(interaction.follow_up_due)}</p></div><form action={completeFollowUp}><input type="hidden" name="interactionId" value={interaction.id}/><button className="button" type="submit">Done</button></form></div>) : <div className="empty">No overdue follow-ups.</div>}</div><div className="card"><h2>Workspace health</h2><div className="row"><span>Membership</span><span className="pill">{membership.role}</span></div><div className="row"><span>Release tasks</span><span>{doneTasks.length}/{tasks.length}</span></div><div className="row"><span>Blocked items</span><span>{blockedTasks.length}</span></div></div></aside></section>
  </main>;
}
