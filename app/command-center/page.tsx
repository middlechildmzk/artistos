import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addRecommendation, updateRecommendation } from "../intelligence/actions";

export default async function CommandCenterPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;
  const [{ data: releases }, { data: recommendations }, { data: tasks }, { data: interactions }, { data: metrics }] = await Promise.all([
    supabase.from("releases").select("id,title,release_date,status").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
    supabase.from("recommendations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("tasks").select("id,title,status,due_date,blocked_by,blocker_cleared").eq("workspace_id", workspaceId),
    supabase.from("interactions").select("id,subject,follow_up_due,follow_up_done,reply_status").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(25),
    supabase.from("metric_snapshots").select("platform,metric,value,captured_on").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(20),
  ]);
  const openRecommendations = (recommendations ?? []).filter((item) => item.status === "open" || item.status === "accepted");
  const openTasks = (tasks ?? []).filter((item) => item.status !== "done" && item.status !== "skipped");
  const overdue = (interactions ?? []).filter((item) => item.follow_up_due && !item.follow_up_done && item.follow_up_due <= new Date().toISOString().slice(0,10));
  const latestRelease = releases?.[0];
  const releaseDays = latestRelease?.release_date ? Math.ceil((new Date(latestRelease.release_date).getTime() - Date.now()) / 86400000) : null;
  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">Artist intelligence</div><h1>Command Center</h1><p className="muted">Priorities, risks, momentum, and next-best actions in one view.</p></div><nav className="nav-links"><Link className="button ghost" href="/dashboard">Today</Link><Link className="button ghost" href="/studio">Studio</Link><Link className="button ghost" href="/analytics">Analytics</Link><Link className="button ghost" href="/automations">Automations</Link></nav></header>
    <section className="grid stats" style={{marginBottom:16}}>
      <div className="card"><div className="eyebrow">Open priorities</div><div className="stat-value">{openRecommendations.length}</div></div>
      <div className="card"><div className="eyebrow">Open tasks</div><div className="stat-value">{openTasks.length}</div></div>
      <div className="card"><div className="eyebrow">Follow-ups due</div><div className="stat-value">{overdue.length}</div></div>
      <div className="card"><div className="eyebrow">Release clock</div><div className="stat-value compact">{releaseDays === null ? "No date" : releaseDays >= 0 ? `${releaseDays} days` : "Live"}</div></div>
    </section>
    <section className="grid two-col">
      <div className="stack">
        <div className="card"><div className="section-heading"><div><h2>Recommended next actions</h2><p className="muted">Decision queue for the current release cycle.</p></div></div>{openRecommendations.length ? openRecommendations.map((item) => <div className="row" key={item.id}><div><div className="tag-row"><span className="pill">{item.priority}</span>{item.due_date ? <span className="pill">Due {item.due_date}</span> : null}</div><strong>{item.title}</strong>{item.rationale ? <p className="muted">{item.rationale}</p> : null}{item.action_path ? <Link href={item.action_path} className="next-action">Open action →</Link> : null}</div><form action={updateRecommendation}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value="done"/><button className="button" type="submit">Done</button></form></div>) : <div className="empty">No open recommendations yet.</div>}</div>
        <div className="card"><h2>Signals</h2>{(metrics ?? []).slice(0,8).map((metric, index) => <div className="row" key={`${metric.platform}-${metric.metric}-${index}`}><div><strong>{metric.platform} · {metric.metric}</strong><p className="muted">Captured {metric.captured_on}</p></div><span className="stat-value compact">{Number(metric.value).toLocaleString()}</span></div>)}</div>
      </div>
      <aside className="stack">
        <form action={addRecommendation} className="card stack"><h2>Add priority</h2><label className="field"><span>Recommendation</span><input className="input" name="title" required/></label><label className="field"><span>Why it matters</span><textarea className="input textarea" name="rationale"/></label><label className="field"><span>Priority</span><select className="input" name="priority"><option>critical</option><option>high</option><option>medium</option><option>low</option></select></label><label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">Workspace-wide</option>{(releases ?? []).map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></label><label className="field"><span>Action path</span><input className="input" name="actionPath" placeholder="/campaigns"/></label><label className="field"><span>Due date</span><input className="input" type="date" name="dueDate"/></label><button className="button primary" type="submit">Add to command center</button></form>
        <div className="card"><h2>Current release</h2><strong>{latestRelease?.title ?? "No active release"}</strong><p className="muted">{latestRelease?.status ?? "Create a release workspace"}</p><Link className="button ghost" href="/releases">Open release timeline</Link></div>
      </aside>
    </section>
  </main>;
}
