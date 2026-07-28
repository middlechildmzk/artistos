import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBrainFact, createAnalyticsInsight, createManagerRequest, generateReleaseTimeline, scorePromotionOpportunities, updateManagerRequest } from "./actions";

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function OperatingCenterPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id, role").eq("user_id", auth.user.id).limit(1).single();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [workspaceResult, artistsResult, releasesResult, factsResult, requestsResult, milestonesResult, scoresResult, orgsResult, insightsResult, agentsResult] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId).order("name"),
    supabase.from("releases").select("id,title,release_date,status").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
    supabase.from("artist_brain_facts").select("*").eq("workspace_id", workspaceId).order("locked", { ascending: false }).order("created_at", { ascending: false }).limit(30),
    supabase.from("manager_requests").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(12),
    supabase.from("release_milestones").select("*").eq("workspace_id", workspaceId).order("due_date", { ascending: true }).limit(40),
    supabase.from("opportunity_scores").select("*").eq("workspace_id", workspaceId).order("total_score", { ascending: false }).limit(20),
    supabase.from("organizations").select("id,display_name,canonical_name,org_type,relationship_stage,verification_status").eq("workspace_id", workspaceId),
    supabase.from("analytics_insights").select("*").eq("workspace_id", workspaceId).eq("status", "active").order("created_at", { ascending: false }).limit(12),
    supabase.from("agent_profiles").select("*").eq("workspace_id", workspaceId).order("department"),
  ]);

  const artists = artistsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const facts = factsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const milestones = milestonesResult.data ?? [];
  const scores = scoresResult.data ?? [];
  const orgMap = new Map((orgsResult.data ?? []).map((org) => [org.id, org]));
  const insights = insightsResult.data ?? [];
  const agents = agentsResult.data ?? [];
  const currentRelease = releases.find((release) => release.status === "upcoming") ?? releases[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo">A</div><div><div className="eyebrow">{workspaceResult.data?.name ?? "ArtistOS"}</div><strong>Intelligence Operating Center</strong></div></div>
        <div className="nav-links"><Link className="button ghost" href="/dashboard">Today</Link><Link className="button ghost" href="/releases">Releases</Link><Link className="button ghost" href="/targets">CRM</Link><Link className="button ghost" href="/creator">Creator</Link><Link className="button ghost" href="/analytics">Analytics</Link></div>
      </header>

      <section className="card release-card stack" style={{ marginBottom: 16 }}>
        <div className="eyebrow">ArtistOS intelligence layer</div>
        <h1>Tell the system what you want accomplished.</h1>
        <p className="muted">Artist Brain preserves context. Manager turns goals into coordinated plans. Promotion ranks opportunities. Release Operations protects the timeline. Analytics converts evidence into decisions.</p>
        <form action={createManagerRequest} className="stack">
          <textarea name="requestText" rows={3} placeholder="Example: Promote Never Alone for the next 30 days and prioritize trusted melodic bass playlists, creators, and fan reactivation." required />
          <div className="form-grid"><select name="releaseId" defaultValue={currentRelease?.id ?? ""}><option value="">Entire artist workspace</option>{releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select><button className="button primary" type="submit">Create coordinated plan</button></div>
        </form>
      </section>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Brain facts</div><div className="stat-value">{facts.length}</div></div>
        <div className="card"><div className="eyebrow">Manager plans</div><div className="stat-value">{requests.length}</div></div>
        <div className="card"><div className="eyebrow">Scored opportunities</div><div className="stat-value">{scores.length}</div></div>
        <div className="card"><div className="eyebrow">AI departments</div><div className="stat-value">{agents.length}</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <div className="card stack">
          <div><div className="eyebrow">1. Artist Brain</div><h2>Persistent operating memory</h2></div>
          <form action={addBrainFact} className="stack">
            <div className="form-grid"><select name="artistId"><option value="">Workspace-wide</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select><select name="releaseId"><option value="">No release</option>{releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></div>
            <div className="form-grid"><select name="category"><option>identity</option><option>sound</option><option>story</option><option>rights</option><option>audience</option><option>promotion</option><option>constraint</option><option>preference</option></select><select name="confidence"><option value="verified">Verified fact</option><option value="supported">Supported inference</option><option value="weak">Weak signal</option><option value="conflicting">Conflicting evidence</option></select></div>
            <textarea name="fact" rows={2} placeholder="lowly sunday is Dan's own vocal alias, not an external collaborator." required />
            <input name="source" placeholder="Source or evidence note" />
            <button className="button" type="submit">Save to Artist Brain</button>
          </form>
          <div className="stack">{facts.length ? facts.map((fact) => <div className="row" key={fact.id}><div><strong>{fact.fact}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{fact.category} · {fact.confidence}{fact.source ? ` · ${fact.source}` : ""}</p></div><span className="pill">{fact.locked ? "Locked" : "Memory"}</span></div>) : <div className="empty">No saved intelligence yet.</div>}</div>
        </div>

        <div className="card stack">
          <div><div className="eyebrow">2. AI Manager</div><h2>Coordinated execution plans</h2></div>
          {requests.length ? requests.map((request) => {
            const plan = Array.isArray(request.plan) ? request.plan as Array<{ department?: string; action?: string }> : [];
            return <div className="notice stack" key={request.id}><div className="row"><strong>{request.request_text}</strong><span className="pill">{request.status}</span></div>{plan.map((step, index) => <div key={index}><span className="eyebrow">{step.department}</span><p style={{ margin: "4px 0" }}>{step.action}</p></div>)}<form action={updateManagerRequest} className="row"><input type="hidden" name="requestId" value={request.id} /><select name="status" defaultValue={request.status}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select><button className="button" type="submit">Update</button></form></div>;
          }) : <div className="empty">Your first manager request will appear here.</div>}
        </div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <div className="card stack">
          <div><div className="eyebrow">3. Promotion OS</div><h2>Evidence-weighted opportunity ranking</h2></div>
          <form action={scorePromotionOpportunities} className="row"><select name="releaseId" defaultValue={currentRelease?.id ?? ""}><option value="">Workspace score</option>{releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select><button className="button primary" type="submit">Score opportunities</button></form>
          {scores.length ? scores.map((score) => { const org = orgMap.get(score.target_id); return <div className="row" key={score.id}><div><strong>{org?.display_name || org?.canonical_name || "Organization"}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{org?.org_type || "opportunity"} · fit {score.fit_score} · trust {score.trust_score} · relationship {score.relationship_score}</p></div><span className="pill">{score.total_score}/100</span></div>; }) : <div className="empty">Run scoring to rank the strongest verified promotion opportunities.</div>}
        </div>

        <div className="card stack">
          <div><div className="eyebrow">4. Release Timeline Engine</div><h2>120 days to long tail</h2></div>
          {currentRelease ? <form action={generateReleaseTimeline} className="row"><input type="hidden" name="releaseId" value={currentRelease.id} /><input type="hidden" name="releaseDate" value={currentRelease.release_date ?? ""} /><div><strong>{currentRelease.title}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{formatDate(currentRelease.release_date)}</p></div><button className="button primary" type="submit" disabled={!currentRelease.release_date}>Generate timeline</button></form> : <div className="empty">Create a release first.</div>}
          {milestones.length ? milestones.map((milestone) => <div className="row" key={milestone.id}><div><strong>{milestone.title}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{milestone.phase} · {formatDate(milestone.due_date)} · {milestone.offset_days > 0 ? `+${milestone.offset_days}` : milestone.offset_days} days</p></div><span className="pill">{milestone.status}</span></div>) : <div className="empty">Generate the canonical release timeline to make missed milestones visible.</div>}
        </div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <div className="card stack">
          <div><div className="eyebrow">5. Analytics Intelligence</div><h2>Decisions, not raw charts</h2></div>
          <form action={createAnalyticsInsight} className="stack"><div className="form-grid"><select name="releaseId"><option value="">Workspace-wide</option>{releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select><select name="insightType"><option value="performance">Performance</option><option value="attribution">Attribution</option><option value="opportunity">Opportunity</option><option value="risk">Risk</option></select></div><input name="title" placeholder="Example: Fan reactivation is the highest-confidence launch lever" required /><textarea name="narrative" rows={2} placeholder="Explain what changed, why it matters, and what action follows." required /><button className="button" type="submit">Record insight</button></form>
          {insights.length ? insights.map((insight) => <div className="notice" key={insight.id}><strong>{insight.title}</strong><p>{insight.narrative}</p><span className="pill">{insight.insight_type}</span></div>) : <div className="empty">Insights will accumulate here as evidence and integrations grow.</div>}
        </div>

        <div className="card stack">
          <div><div className="eyebrow">6. Agent Workforce</div><h2>Specialized departments</h2></div>
          {agents.map((agent) => <div className="row" key={agent.id}><div><strong>{agent.name}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{agent.mission}</p><p className="muted" style={{ margin: "5px 0 0" }}>{(agent.capabilities ?? []).join(" · ")}</p></div><span className="pill">{agent.status}</span></div>)}
        </div>
      </section>

      <section className="card stack">
        <div className="eyebrow">What this ships now</div>
        <h2>One connected operating layer</h2>
        <p className="muted">The Manager can now preserve instructions as plans, the Brain can store evidence-backed context, Promotion can rank existing opportunities, Release Operations can generate the canonical timeline, Analytics can preserve decision narratives, and eight specialized departments are represented in the workspace. Live model execution, autonomous research, platform APIs, and scheduled agent workers remain the next infrastructure layer.</p>
      </section>
    </main>
  );
}
