import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSourceAdapters } from "@/lib/network-intelligence/source-runtime/registry";
import type { SourceSearchPlan } from "@/lib/network-intelligence/source-runtime/types";
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

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sourcePlan(value: unknown): SourceSearchPlan | null {
  const plan = objectValue(value);
  return typeof plan.planVersion === "string" ? plan as unknown as SourceSearchPlan : null;
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
  last_verified_at: string | null;
  discovery_cluster_key?: string | null;
  corroborating_sources?: unknown;
  corroboration_count?: number | null;
  identity_urls?: unknown;
  external_identifiers?: unknown;
};

type MatchRow = {
  id: string;
  opportunity_id: string;
  candidate_entity_type: string;
  candidate_entity_id: string;
  match_score: number;
  match_reasons: unknown;
  conflicting_fields?: unknown;
  review_status: string;
};

const laneOptions = [
  ["radio", "Radio"], ["playlist", "Playlists"], ["youtube_channel", "YouTube"], ["publication", "Media"],
  ["creator", "Creators"], ["podcast", "Podcasts"], ["label", "Labels"], ["sync", "Sync"],
  ["music_library", "Libraries"], ["booking", "Live"],
] as const;

export default async function OpportunitiesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [searchResult, opportunityResult, runProbe, releasesResult, campaignsResult, observationResult, graphResult] = await Promise.all([
    supabase.from("opportunity_searches").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(20),
    supabase.from("opportunities").select("*").eq("workspace_id", workspaceId).order("corroboration_count", { ascending: false, nullsFirst: false }).order("fit_score", { ascending: false, nullsFirst: false }).limit(100),
    supabase.from("opportunity_search_runs").select("id,estimated_request_count", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("releases").select("id,title,release_date,status").eq("workspace_id", workspaceId).order("release_date", { ascending: false, nullsFirst: false }).limit(30),
    supabase.from("campaigns").select("id,name,status,release_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    supabase.from("opportunity_source_observations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("knowledge_entities").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const runtimeReady = !runProbe.error;
  const searches = (searchResult.data ?? []) as SearchRow[];
  const opportunities = (opportunityResult.data ?? []) as OpportunityRow[];
  const matchesResult = runtimeReady && opportunities.length
    ? await supabase.from("opportunity_match_candidates").select("id,opportunity_id,candidate_entity_type,candidate_entity_id,match_score,match_reasons,conflicting_fields,review_status").eq("workspace_id", workspaceId).in("opportunity_id", opportunities.map((item) => item.id)).order("match_score", { ascending: false })
    : { data: [] as MatchRow[], error: null };
  const matches = (matchesResult.data ?? []) as MatchRow[];
  const matchesByOpportunity = new Map<string, MatchRow[]>();
  for (const match of matches) matchesByOpportunity.set(match.opportunity_id, [...(matchesByOpportunity.get(match.opportunity_id) ?? []), match]);

  const unassessed = opportunities.filter((item) => item.legitimacy_status === "unreviewed").length;
  const pendingReview = opportunities.filter((item) => !item.review_status || item.review_status === "pending").length;
  const corroborated = opportunities.filter((item) => (item.corroboration_count ?? 1) > 1).length;
  const sourceHealth = listSourceAdapters().map((adapter) => ({ ...adapter.policy, health: adapter.health() }));

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">SourcingOS for music · evidence-first source discovery</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Opportunity Intelligence</h1>
          <p className="muted">Discover across approved public sources, cluster the same identity across providers, preserve every observation, and stop at human review. Follower count alone never determines quality.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/targets">Network</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
          <Link className="button ghost" href="/approvals">Approvals</Link>
        </nav>
      </header>

      {!runtimeReady ? <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Runtime migration pending</h2><p className="muted">This branch is implemented but the pending migrations are not applied to this environment. Planning and execution remain disabled.</p></div><span className="pill blocked">Not live</span></div>
      </section> : null}

      <section className="grid stats discovery-stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Search plans</div><div className="stat-value">{searches.length}</div></div>
        <div className="card"><div className="eyebrow">Clustered discoveries</div><div className="stat-value">{opportunities.length}</div></div>
        <div className="card"><div className="eyebrow">Cross-source matches</div><div className="stat-value">{corroborated}</div></div>
        <div className="card"><div className="eyebrow">Pending review</div><div className="stat-value">{pendingReview}</div></div>
        <div className="card"><div className="eyebrow">Unassessed legitimacy</div><div className="stat-value">{unassessed}</div></div>
        <div className="card"><div className="eyebrow">Source observations</div><div className="stat-value">{observationResult.count ?? 0}</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <form action={createOpportunitySearch} className="card stack discovery-planner">
          <input type="hidden" name="submissionNonce" value={randomUUID()} />
          <div className="section-heading"><div><h2>Start a sourcing session</h2><p className="muted">Create the plan now. Provider execution remains a separate explicit action.</p></div><span className="pill">15-minute mode</span></div>
          <label className="field"><span>What are you looking for?</span><input className="input" name="query" required placeholder="melodic bass radio stations and curators" /></label>
          <label className="field"><span>Session name</span><input className="input" name="title" required placeholder="Never Alone radio discovery" /></label>
          <label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">Workspace-level search</option>{(releasesResult.data ?? []).map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></label>

          <div className="quick-lanes"><span className="muted">Quick lane</span><div className="tag-row">{laneOptions.map(([value, text], index) => <label className="pill" key={value}><input type="checkbox" name="lanes" value={value} defaultChecked={index === 0} /> {text}</label>)}</div></div>

          <details className="advanced-panel"><summary>Advanced source plan</summary><div className="stack" style={{ marginTop: 12 }}>
            <label className="field"><span>Objective</span><textarea className="input" name="objective" rows={3} defaultValue="Find legitimate, current identities with source-visible evidence and no assumed submission or outreach permission." /></label>
            <label className="field"><span>Release fit context</span><textarea className="input" name="fitContext" rows={3} placeholder="Emotional electronic, future bass, melodic bass, released July 31, 2026" /></label>
            <fieldset className="field"><legend>Sources</legend><div className="stack">{sourceHealth.map((source) => <label className="source-choice" key={source.slug}>
              <span><strong>{source.label}</strong><small className="muted">{source.health.detail}</small><small className="muted">{source.costLabel} · {source.estimatedRequestsPerLane} request{source.estimatedRequestsPerLane === 1 ? "" : "s"}/lane · {source.supportedLanes.map((lane) => label(lane)).join(", ")}</small></span>
              <span className="tag-row"><span className={`pill ${source.health.status === "available" ? "success" : "blocked"}`}>{label(source.health.status)}</span><input type="checkbox" name="sources" value={source.slug} defaultChecked={source.health.status === "available"} disabled={source.health.status !== "available"} /></span>
            </label>)}</div></fieldset>
          </div></details>
          <button className="button primary sticky-mobile-action" type="submit" disabled={!runtimeReady}>Create reviewable plan</button>
        </form>

        <div className="card stack">
          <div className="section-heading"><div><h2>Source advantage</h2><p className="muted">More coverage only counts when the rights, identity, and evidence are clear. Identity and duplicate resolution remain reviewable. Feature-level fit scoring stays source-visible.</p></div><span className="pill">Policy enforced</span></div>
          {sourceHealth.map((source) => <div className="source-boundary" key={source.slug}><div><strong>{source.label}</strong><p className="muted">{source.allowedUse}</p></div><div className="tag-row"><span className={`pill ${source.health.status === "available" ? "success" : "blocked"}`}>{source.costLabel}</span><span className="pill">{label(source.disposition)}</span></div></div>)}
          <div className="source-boundary"><div><strong>Automatic CRM creation</strong><p className="muted">Discovery, identity review, and CRM promotion stay separate.</p></div><span className="pill blocked">Approval required</span></div>
          <div className="source-boundary"><div><strong>Outreach or sending</strong><p className="muted">This build discovers and reviews. It does not contact anyone.</p></div><span className="pill blocked">Not included</span></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Search plans</h2><p className="muted">See query expansion, source coverage, expected request cost, and actual run usage before reviewing results.</p></div><span className="pill">{searches.length} plans</span></div>
        {searches.length ? searches.map((search) => {
          const plan = sourcePlan(search.source_plan);
          const summary = search.last_run_summary ?? {};
          const variants = plan ? [...new Set(plan.lanes.flatMap((lane) => lane.queryVariants ?? [lane.query]))] : [];
          return <article className="directory-row discovery-plan-row" key={search.id}>
            <div className="directory-main stack">
              <div><strong>{search.title}</strong><p className="muted">{search.objective}</p></div>
              <div className="tag-row"><span className="pill">{label(search.status)}</span><span className="pill">{plan?.lanes.length ?? 0} lanes</span><span className="pill">Est. {plan?.estimatedRequestCount ?? 0} requests</span><span className={`pill ${search.last_run_status === "failed" ? "blocked" : ""}`}>Last: {label(search.last_run_status, "not run")}</span></div>
              {plan ? <details><summary>Plan evidence and query expansion</summary><div className="stack" style={{ marginTop: 8 }}><div className="tag-row">{plan.sourcePolicies.map((source) => <span className="pill" key={source.slug}>{source.label}: {source.costLabel}</span>)}</div>{variants.map((variant) => <code className="query-variant" key={variant}>{variant}</code>)}{plan.skippedSources.length ? <p className="muted">Blocked or skipped: {plan.skippedSources.map((source) => `${source.slug} (${source.reason})`).join(" · ")}</p> : null}</div></details> : null}
              <p className="muted">Last run: {formatDate(search.last_run_at)}{summary.discovered_count != null ? ` · ${String(summary.discovered_count)} clustered discoveries · ${String(summary.corroborated_count ?? 0)} corroborated · ${String(summary.actual_request_count ?? 0)} requests` : ""}</p>
            </div>
            <form action={executeOpportunitySearch} className="run-plan-form"><input type="hidden" name="searchId" value={search.id} /><input type="hidden" name="submissionNonce" value={randomUUID()} /><label className="field compact-field"><span>Results/lane</span><select className="input" name="maxResultsPerLane" defaultValue="10"><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label><button className="button primary" type="submit" disabled={!runtimeReady}>Run approved sources</button></form>
          </article>;
        }) : <div className="empty">No source plan exists yet.</div>}
      </section>

      <section className="card">
        <div className="section-heading"><div><h2>Discovery review queue</h2><p className="muted">One identity can carry several independent source observations. Corroboration strengthens identity confidence, not legitimacy or permission.</p></div><span className="pill">{opportunities.length} records</span></div>
        {opportunities.length ? opportunities.map((item) => {
          const risks = stringArray(item.risk_flags);
          const sources = stringArray(item.corroborating_sources).length ? stringArray(item.corroborating_sources) : item.source_slug ? [item.source_slug] : [];
          const identityUrls = stringArray(item.identity_urls);
          const identifiers = objectValue(item.external_identifiers);
          const candidateMatches = matchesByOpportunity.get(item.id) ?? [];
          const accepted = item.review_status === "accepted";
          return <article className="directory-row discovery-result" key={item.id}>
            <div className="directory-main stack">
              <div className="result-heading"><div><strong>{item.title}</strong><p className="muted">{label(item.opportunity_type, "Industry opportunity")}{item.summary ? ` · ${item.summary}` : ""}</p></div>{sources.length > 1 ? <span className="pill success">{sources.length} sources corroborate identity</span> : <span className="pill">Single-source lead</span>}</div>
              <div className="tag-row"><span className="pill">Fit {score(item.fit_score)}</span><span className="pill">Legitimacy {score(item.legitimacy_score)}</span><span className="pill">Reach {score(item.reach_quality_score)}</span><span className="pill">Access {score(item.accessibility_score)}</span><span className="pill">Relationship {score(item.relationship_score)}</span><span className={`pill ${(item.risk_score ?? 0) >= 60 ? "blocked" : ""}`}>Risk {score(item.risk_score)}</span></div>
              <div className="tag-row">{sources.map((source) => <span className="pill success" key={source}>{label(source)}</span>)}<span className="pill">{label(item.candidate_kind, "candidate")}</span><span className="pill">{label(item.review_status, "pending")}</span><span className="pill">{label(item.confidence)}</span>{risks.slice(0, 4).map((risk) => <span className="pill blocked" key={risk}>{label(risk)}</span>)}</div>

              <details><summary>Identity evidence</summary><div className="stack" style={{ marginTop: 8 }}>{identityUrls.length ? identityUrls.map((url) => <a href={`https://${url.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" key={url}>{url}</a>) : <p className="muted">No official identity URL was returned.</p>}{Object.keys(identifiers).length ? <div className="tag-row">{Object.entries(identifiers).map(([key, value]) => <span className="pill" key={key}>{label(key)}: {String(value)}</span>)}</div> : null}{item.discovery_cluster_key ? <code className="query-variant">{item.discovery_cluster_key}</code> : null}</div></details>

              {candidateMatches.length ? <details><summary><strong>{candidateMatches.length} possible existing matches</strong></summary><div className="stack" style={{ marginTop: 8 }}>{candidateMatches.map((match) => <div className="source-boundary" key={match.id}><span>{label(match.candidate_entity_type)} · {match.candidate_entity_id}</span><span className="tag-row"><span className="pill">{Math.round(match.match_score * 100)}%</span>{stringArray(match.conflicting_fields).map((conflict) => <span className="pill blocked" key={conflict}>{label(conflict)}</span>)}</span></div>)}</div></details> : <p className="muted">No deterministic existing match was found.</p>}

              <form action={reviewOpportunity} className="stack"><input type="hidden" name="opportunityId" value={item.id} /><input type="hidden" name="submissionNonce" value={randomUUID()} /><div className="form-grid two"><label className="field"><span>Review decision</span><select className="input" name="disposition" defaultValue={item.review_disposition ?? "verify_more"}><option value="verify_more">Verify more</option><option value="create_new">Accept as new</option><option value="enrich_existing">Enrich existing</option><option value="merge_existing">Possible merge</option><option value="quarantine">Quarantine</option><option value="reject">Reject</option></select></label><label className="field"><span>Existing match</span><select className="input" name="match" defaultValue=""><option value="">No selected match</option>{candidateMatches.map((match) => <option key={match.id} value={`${match.id}:${match.candidate_entity_type}:${match.candidate_entity_id}`}>{label(match.candidate_entity_type)} · {Math.round(match.match_score * 100)}%</option>)}</select></label></div><label className="field"><span>Review note</span><input className="input" name="note" defaultValue={item.review_note ?? ""} placeholder="What was verified, conflicted, or still needs review?" /></label><button className="button" type="submit" disabled={!runtimeReady}>Save review</button></form>
              {accepted ? <form action={requestOpportunityPromotion} className="row promotion-row"><input type="hidden" name="opportunityId" value={item.id} /><input type="hidden" name="submissionNonce" value={randomUUID()} /><label className="field" style={{ flex: 1 }}><span>Optional campaign</span><select className="input" name="campaignId"><option value="">Promote to CRM only</option>{(campaignsResult.data ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><button className="button primary align-end" type="submit">Request CRM promotion</button></form> : null}
            </div>
            <div className="nav-links">{item.source_url ? <a className="button ghost" href={item.source_url} target="_blank" rel="noreferrer">Primary source</a> : null}{item.external_id ? <span className="pill">ID {item.external_id}</span> : null}</div>
          </article>;
        }) : <div className="empty">No discoveries yet. Create a plan, inspect the source boundaries, and run it explicitly.</div>}
      </section>
      <p className="muted" style={{ marginTop: 12 }}>Knowledge graph entities currently available: {graphResult.count ?? 0}. Discovery results are not verified contacts or submission routes.</p>
    </main>
  );
}
