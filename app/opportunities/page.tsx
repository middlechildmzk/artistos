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
          <div className="