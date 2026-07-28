import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function score(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toString();
}

function label(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim().replaceAll("_", " ") || fallback;
}

export default async function OpportunitiesPage() {
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

  const [{ data: searches }, { data: opportunities }, { count: observationCount }, { count: graphCount }] = await Promise.all([
    supabase
      .from("opportunity_searches")
      .select("id,title,objective,status,execution_mode,search_lanes,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("opportunities")
      .select("id,title,summary,opportunity_type,status,freshness_status,legitimacy_status,confidence,fit_score,legitimacy_score,reach_quality_score,accessibility_score,relationship_score,risk_score,score_explanation,risk_flags,source_url,last_verified_at")
      .eq("workspace_id", workspaceId)
      .order("fit_score", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("opportunity_source_observations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("knowledge_entities").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const rows = opportunities ?? [];
  const credible = rows.filter((item) => item.legitimacy_status === "credible").length;
  const reviewNeeded = rows.filter((item) => ["unreviewed", "mixed", "suspicious"].includes(item.legitimacy_status)).length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">SourcingOS for music</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Opportunity Intelligence</h1>
          <p className="muted">Discover, resolve, verify, score, and promote curators, creators, media, sync, radio, and collaborators into the ArtistOS CRM.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/targets">CRM</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
          <Link className="button ghost" href="/brain">Artist Brain</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Search plans</div><div className="stat-value">{searches?.length ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Discovered</div><div className="stat-value">{rows.length}</div></div>
        <div className="card"><div className="eyebrow">Credible</div><div className="stat-value">{credible}</div></div>
        <div className="card"><div className="eyebrow">Needs review</div><div className="stat-value">{reviewNeeded}</div></div>
        <div className="card"><div className="eyebrow">Source observations</div><div className="stat-value">{observationCount ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Knowledge entities</div><div className="stat-value">{graphCount ?? 0}</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-heading">
            <div><h2>Multi-lane searches</h2><p className="muted">Each search preserves intake, lanes, approval state, and execution limits.</p></div>
            <span className="pill">Plan-first</span>
          </div>
          {searches?.length ? searches.map((search) => {
            const lanes = Array.isArray(search.search_lanes) ? search.search_lanes : [];
            return <article className="row" key={search.id}>
              <div>
                <strong>{search.title}</strong>
                <p className="muted">{search.objective}</p>
                <div className="tag-row"><span className="pill">{label(search.status)}</span><span className="pill">{label(search.execution_mode)}</span><span className="pill">{lanes.length} lanes</span></div>
              </div>
            </article>;
          }) : <div className="empty">No opportunity search has been created yet. The first proof should target Never Alone across playlist, media, creator, radio, DJ, and sync lanes.</div>}
        </div>

        <div className="card">
          <div className="section-heading"><div><h2>Trust model</h2><p className="muted">Follower count alone never determines quality.</p></div><span className="pill">Evidence-first</span></div>
          <div className="row"><span>Identity and duplicate resolution</span><span className="pill">Required</span></div>
          <div className="row"><span>Activity freshness</span><span className="pill">Visible</span></div>
          <div className="row"><span>Legitimacy and fraud review</span><span className="pill">Explainable</span></div>
          <div className="row"><span>Feature-level fit scoring</span><span className="pill">Evidence-linked</span></div>
          <div className="row"><span>CRM promotion</span><span className="pill">Human approved</span></div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div><h2>Opportunity review queue</h2><p className="muted">High-fit results remain reviewable before CRM promotion or outreach.</p></div>
          <span className="pill">{rows.length} records</span>
        </div>
        {rows.length ? rows.map((item) => {
          const risks = Array.isArray(item.risk_flags) ? item.risk_flags : [];
          return <article className="directory-row" key={item.id}>
            <div className="directory-main">
              <strong>{item.title}</strong>
              <p className="muted">{label(item.opportunity_type, "Industry opportunity")}{item.summary ? ` · ${item.summary}` : ""}</p>
              <div className="tag-row">
                <span className="pill">Fit {score(item.fit_score)}</span>
                <span className="pill">Legitimacy {score(item.legitimacy_score)}</span>
                <span className="pill">Reach {score(item.reach_quality_score)}</span>
                <span className="pill">Access {score(item.accessibility_score)}</span>
                <span className="pill">Relationship {score(item.relationship_score)}</span>
                <span className={`pill ${(item.risk_score ?? 0) >= 60 ? "blocked" : ""}`}>Risk {score(item.risk_score)}</span>
              </div>
              <div className="tag-row" style={{ marginTop: 8 }}>
                <span className="pill">{label(item.status)}</span>
                <span className="pill">{label(item.legitimacy_status)}</span>
                <span className="pill">{label(item.freshness_status)}</span>
                <span className="pill">{label(item.confidence)}</span>
                {risks.slice(0, 3).map((risk) => <span className="pill blocked" key={String(risk)}>{String(risk)}</span>)}
              </div>
            </div>
            <div className="nav-links">{item.source_url ? <a className="button ghost" href={item.source_url} target="_blank" rel="noreferrer">Source</a> : null}<Link className="button primary" href="/targets">Review in CRM</Link></div>
          </article>;
        }) : <div className="empty">No discoveries yet. This workspace is ready for evidence-backed source adapters and the first Never Alone search.</div>}
      </section>
    </main>
  );
}
