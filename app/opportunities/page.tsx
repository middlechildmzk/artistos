import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSourceAdapters } from "@/lib/network-intelligence/source-runtime/registry";
import { createOpportunitySearch, executeOpportunitySearch, requestOpportunityPromotion, reviewOpportunity } from "./actions";

function score(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toString();
}

function label(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim().replaceAll("_", " ") || fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not run";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

type SearchRow = {
  id: string;
  title: string;
  objective: string;
  status: string;
  execution_mode: string;
  search_lanes: unknown;
  source_plan?: unknown;
  last_run_at?: string | null;
  last_run_status?: string | null;
  last_run_summary?: Record<string, unknown> | null;
  updated_at: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  summary: string | null;
  opportunity_type: string;
  status: string;
  freshness_status: string;
  legitimacy_status: string;
  confidence: string;
  fit_score: number | null;
  legitimacy_score: number | null;
  reach_quality_score: number | null;
  accessibility_score: number | null;
  relationship_score: number | null;
  risk_score: number | null;
  risk_flags: unknown;
  source_url: string | null;
  source_slug?: string | null;
  source_policy_disposition?: string | null;
  external_id?: string | null;
  candidate_kind?: string | null;
  review_status?: string | null;
  review_disposition?: string | null;
  review_note?: string | null;
  matched_entity_type?: string | null;
  matched_entity_id?: string | null;
  match_confidence?: number | null;
  match_reasons?: unknown;
  last_verified_at: string | null;
};

type MatchRow = {
  id: string;
  opportunity_id: string;
  candidate_entity_type: string;
  candidate_entity_id: string;
  match_score: number;
  match_reasons: unknown;
  review_status: string;
};

export default async function OpportunitiesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [searchResult, opportunityResult, runProbe, releasesResult, campaignsResult, observationResult, graphResult] = await Promise.all([
    supabase.from("opportunity_searches").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(20),
    supabase.from("opportunities").select("*").eq("workspace_id", workspaceId).order("fit_score", { ascending: false, nullsFirst: false }).limit(100),
    supabase.from("opportunity_search_runs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("releases").select("id,title,release_date,status").eq("workspace_id", workspaceId).order("release_date", { ascending: false, nullsFirst: false }).limit(30),
    supabase.from("campaigns").select("id,name,status,release_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    supabase.from("opportunity_source_observations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("knowledge_entities").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const runtimeReady = !runProbe.error;
  const searches = (searchResult.data ?? []) as SearchRow[];
  const opportunities = (opportunityResult.data ?? []) as OpportunityRow[];
  const matchesResult = runtimeReady && opportunities.length
    ? await supabase.from("opportunity_match_candidates").select("id,opportunity_id,candidate_entity_type,candidate_entity_id,match_score,match_reasons,review_status").eq("workspace_id", workspaceId).in("opportunity_id", opportunities.map((item) => item.id)).order("match_score", { ascending: false })
    : { data: [] as MatchRow[], error: null };
  const matches = (matchesResult.data ?? []) as MatchRow[];
  const matchesByOpportunity = new Map<string, MatchRow[]>();
  for (const match of matches) matchesByOpportunity.set(match.opportunity_id, [...(matchesByOpportunity.get(match.opportunity_id) ?? []), match]);
  const rows = opportunities;
  const unassessed = rows.filter((item) => item.legitimacy_status === "unreviewed").length;
  const pendingReview = rows.filter((item) => !item.review_status || item.review_status === "pending").length;
  const sourceHealth = listSourceAdapters().map((adapter) => ({ ...adapter.policy, health: adapter.health() }));

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">SourcingOS for music</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Opportunity Intelligence</h1>
          <p className="muted">Plan approved sources, collect live public observations, resolve likely duplicates, and keep every discovery reviewable before CRM promotion.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/targets">Network</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
          <Link className="button ghost" href="/approvals">Approvals</Link>
        </nav>
      </header>

      {!runtimeReady ? <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Runtime migration pending</h2><p className="muted">The source runtime is implemented on this branch, but its pending migration has not been applied to this environment. Search creation and execution remain disabled until replay, approval, and migration are complete.</p></div><span className="pill blocked">Not live</span></div>
      </section> : null}

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Search plans</div><div className="stat-value">{searches.length}</div></div>
        <div className="card"><div className="eyebrow">Discoveries</div><div className="stat-value">{rows.length}</div></div>
        <div className="card"><div className="eyebrow">Unassessed legitimacy</div><div className="stat-value">{unassessed}</div></div>
        <div className="card"><div className="eyebrow">Pending review</div><div className="stat-value">{pendingReview}</div></div>
        <div className="card"><div className="eyebrow">Source observations</div><div className="stat-value">{observationResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Knowledge entities</div><div className="stat-value">{graphResult.count ?? 0}</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <form action={createOpportunitySearch} className="card stack"><input type="hidden" name="submissionNonce" value={randomUUID()} />
          <div className="section-heading"><div><h2>Create a source plan</h2><p className="muted">This stores a plan only. Running it is a second explicit human action.</p></div><span className="pill">Human operated</span></div>
          <label className="field"><span>Search title</span><input className="input" name="title" required placeholder="Melodic bass YouTube and radio targets" /></label>
          <label className="field"><span>Target description</span><input className="input" name="query" required placeholder="active melodic bass channels accepting released music" /></label>
          <label className="field"><span>Objective</span><textarea className="input" name="objective" rows={3} defaultValue="Find legitimate, current targets with source-visible identity and no assumed outreach permission." /></label>
          <label className="field"><span>Release fit context</span><textarea className="input" name="fitContext" rows={3} placeholder="Emotional electronic, future bass, melodic bass, cinematic, released July 31, 2026" /></label>
          <label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">Workspace-level search</option>{(releasesResult.data ?? []).map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></label>
          <fieldset className="field"><legend>Search lanes</legend><div className="tag-row">
            {[["youtube_channel","YouTube"],["playlist","Playlists"],["publication","Media"],["creator","Creators"],["radio","Radio"],["podcast","Podcasts"],["sync","Sync"],["music_library","Libraries"],["label","Labels"],["booking","Live"]].map(([value, text], index) => <label className="pill" key={value}><input type="checkbox" name="lanes" value={value} defaultChecked={index === 4} /> {text}</label>)}
          </div></fieldset>
          <fieldset className="field"><legend>Approved sources</legend><div className="stack">
            {sourceHealth.map((source) => <label className="row" key={source.slug}><span><strong>{source.label}</strong><small className="muted" style={{ display: "block" }}>{source.health.detail}</small></span><span className="tag-row"><span className={`pill ${source.health.status === "available" ? "success" : source.health.status === "blocked_by_policy" ? "blocked" : ""}`}>{label(source.health.status)}</span><input type="checkbox" name="sources" value={source.slug} defaultChecked={source.health.status === "available"} disabled={source.health.status !== "available"} /></span></label>)}
          </div></fieldset>
          <button className="button primary" type="submit" disabled={!runtimeReady}>Create reviewable plan</button>
        </form>

        <div className="card stack">
          <div className="section-heading"><div><h2>Source boundaries</h2><p className="muted">The registry blocks unsupported providers before execution.</p></div><span className="pill">Policy enforced</span></div>
          <div className="row"><span>Wikidata</span><span className="pill success">CC0 identity discovery</span></div>
          <div className="row"><span>YouTube Data API</span><span className="pill blocked">Blocked pending compliance controls</span></div>
          <div className="row"><span>TikTok Research API</span><span className="pill blocked">Commercial use rejected</span></div>
          <div className="row"><span>SubmitHub and Groover</span><span className="pill">External handoff only</span></div>
          <div className="row"><span>Automatic CRM creation</span><span className="pill blocked">Approval required</span></div>
          <div className="row"><span>Outreach or sending</span><span className="pill blocked">Not included</span></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Trust model</h2><p className="muted">Every result stays source-visible, explainable, and reviewable.</p></div><span className="pill">Evidence first</span></div>
        <div className="grid three-col">
          <div><strong>Follower count alone never determines quality</strong><p className="muted">Only source-supported dimensions are shown. Missing reach, legitimacy, accessibility, relationship, freshness, or risk evidence remains unassessed rather than receiving a synthetic score.</p></div>
          <div><strong>Identity and duplicate resolution</strong><p className="muted">Stable IDs, canonical URLs, and normalized names create suggestions only. A human decides whether to create, enrich, quarantine, reject, or use a dedicated merge workflow.</p></div>
          <div><strong>Feature-level fit scoring</strong><p className="muted">Each score preserves its feature value, weight, contribution, explanation, confidence, and evidence record.</p></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Search plans</h2><p className="muted">Plans preserve the exact lanes, source policy, configuration state, and last execution summary.</p></div><span className="pill">{searches.length} plans</span></div>
        {searches.length ? searches.map((search) => {
          const lanes = Array.isArray(search.search_lanes) ? search.search_lanes : [];
          const summary = search.last_run_summary ?? {};
          return <article className="directory-row" key={search.id}>
            <div className="directory-main"><strong>{search.title}</strong><p className="muted">{search.objective}</p><div className="tag-row"><span className="pill">{label(search.status)}</span><span className="pill">{label(search.execution_mode)}</span><span className="pill">{lanes.length} lanes</span><span className={`pill ${search.last_run_status === "failed" ? "blocked" : ""}`}>Last: {label(search.last_run_status, "not run")}</span></div><p className="muted">Last run: {formatDate(search.last_run_at)}{summary.discovered_count != null ? ` · ${String(summary.discovered_count)} discoveries · ${String(summary.matched_count ?? 0)} possible matches` : ""}</p></div>
            <form action={executeOpportunitySearch} className="nav-links"><input type="hidden" name="searchId" value={search.id} /><input type="hidden" name="maxResultsPerLane" value="12" /><input type="hidden" name="submissionNonce" value={randomUUID()} /><button className="button primary" type="submit" disabled={!runtimeReady}>Run approved sources</button></form>
          </article>;
        }) : <div className="empty">No source plan exists yet.</div>}
      </section>

      <section className="card">
        <div className="section-heading"><div><h2>Discovery review queue</h2><p className="muted">No result becomes a CRM target merely because an API returned it.</p></div><span className="pill">{rows.length} records</span></div>
        {rows.length ? rows.map((item) => {
          const risks = Array.isArray(item.risk_flags) ? item.risk_flags.map(String) : [];
          const candidateMatches = matchesByOpportunity.get(item.id) ?? [];
          const accepted = item.review_status === "accepted";
          return <article className="directory-row" key={item.id}>
            <div className="directory-main stack">
              <div><strong>{item.title}</strong><p className="muted">{label(item.opportunity_type, "Industry opportunity")}{item.summary ? ` · ${item.summary}` : ""}</p></div>
              <div className="tag-row"><span className="pill">Fit {score(item.fit_score)}</span><span className="pill">Legitimacy {score(item.legitimacy_score)}</span><span className="pill">Reach {score(item.reach_quality_score)}</span><span className="pill">Access {score(item.accessibility_score)}</span><span className="pill">Relationship {score(item.relationship_score)}</span><span className={`pill ${(item.risk_score ?? 0) >= 60 ? "blocked" : ""}`}>Risk {score(item.risk_score)}</span></div>
              <div className="tag-row"><span className="pill">{label(item.source_slug, "legacy source")}</span><span className="pill">{label(item.source_policy_disposition, "policy unknown")}</span><span className="pill">{label(item.candidate_kind, "candidate")}</span><span className="pill">{label(item.review_status, "pending")}</span><span className="pill">{label(item.confidence)}</span>{risks.slice(0, 3).map((risk) => <span className="pill blocked" key={risk}>{label(risk)}</span>)}</div>
              {candidateMatches.length ? <details><summary><strong>{candidateMatches.length} possible existing matches</strong></summary><div className="stack" style={{ marginTop: 8 }}>{candidateMatches.map((match) => <div className="row" key={match.id}><span>{label(match.candidate_entity_type)} · {match.candidate_entity_id}</span><span className="pill">{Math.round(match.match_score * 100)}%</span></div>)}</div></details> : <p className="muted">No deterministic existing match was found.</p>}
              <form action={reviewOpportunity} className="stack"><input type="hidden" name="opportunityId" value={item.id} /><input type="hidden" name="submissionNonce" value={randomUUID()} /><div className="form-grid two"><label className="field"><span>Review decision</span><select className="input" name="disposition" defaultValue={item.review_disposition ?? "verify_more"}><option value="verify_more">Verify more</option><option value="create_new">Accept as new</option><option value="enrich_existing">Enrich existing</option><option value="merge_existing">Possible merge</option><option value="quarantine">Quarantine</option><option value="reject">Reject</option></select></label><label className="field"><span>Existing match</span><select className="input" name="match" defaultValue=""><option value="">No selected match</option>{candidateMatches.map((match) => <option key={match.id} value={`${match.id}:${match.candidate_entity_type}:${match.candidate_entity_id}`}>{label(match.candidate_entity_type)} · {Math.round(match.match_score * 100)}%</option>)}</select></label></div><label className="field"><span>Review note</span><input className="input" name="note" defaultValue={item.review_note ?? ""} placeholder="What was verified, conflicted, or still needs review?" /></label><button className="button" type="submit" disabled={!runtimeReady}>Save review</button></form>
              {accepted ? <form action={requestOpportunityPromotion} className="row"><input type="hidden" name="opportunityId" value={item.id} /><input type="hidden" name="submissionNonce" value={randomUUID()} /><label className="field" style={{ flex: 1 }}><span>Optional campaign</span><select className="input" name="campaignId"><option value="">Promote to CRM only</option>{(campaignsResult.data ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><button className="button primary align-end" type="submit">Request CRM promotion</button></form> : null}
            </div>
            <div className="nav-links">{item.source_url ? <a className="button ghost" href={item.source_url} target="_blank" rel="noreferrer">Official source</a> : null}{item.external_id ? <span className="pill">ID {item.external_id}</span> : null}</div>
          </article>;
        }) : <div className="empty">No discoveries yet. Create a plan, inspect its sources, and run it explicitly.</div>}
      </section>
    </main>
  );
}
