import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function label(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim() || fallback;
}

type TargetSearchParams = Promise<{
  q?: string;
  type?: string;
  trust?: string;
  verification?: string;
}>;

export default async function TargetsPage({ searchParams }: { searchParams: TargetSearchParams }) {
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
  const filters = await searchParams;
  const queryText = String(filters.q ?? "").replace(/[,%()]/g, " ").trim().slice(0, 120);
  const typeFilter = String(filters.type ?? "").trim();
  const trustFilter = String(filters.trust ?? "").trim();
  const verificationFilter = String(filters.verification ?? "").trim();

  let organizationQuery = supabase
    .from("organizations")
    .select("id, canonical_name, display_name, org_type, location, activity_status, trust_tier, risk_tier, verification_status, evidence_strength, website, primary_source_url, notes, relationship_stage, next_action, next_action_due", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("evidence_strength", { ascending: false, nullsFirst: false })
    .order("canonical_name")
    .limit(100);

  if (queryText) {
    organizationQuery = organizationQuery.or(`canonical_name.ilike.%${queryText}%,display_name.ilike.%${queryText}%,org_type.ilike.%${queryText}%,location.ilike.%${queryText}%`);
  }
  if (typeFilter) organizationQuery = organizationQuery.eq("org_type", typeFilter);
  if (trustFilter) organizationQuery = organizationQuery.eq("trust_tier", trustFilter);
  if (verificationFilter) organizationQuery = organizationQuery.eq("verification_status", verificationFilter);

  const [organizationResult, peopleResult, propertyResult, endpointResult, interactionResult] = await Promise.all([
    organizationQuery,
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("submission_endpoints").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const rows = organizationResult.data ?? [];
  const activeFilterCount = [queryText, typeFilter, trustFilter, verificationFilter].filter(Boolean).length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Campaign Intelligence</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Network Intelligence</h1>
          <p className="muted">Search and qualify evidence-backed curators, media, playlists, labels, creators, organizations, people, and submission routes.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
          <Link className="button ghost" href="/proof">Proof</Link>
          <Link className="button ghost" href="/analytics">Music Intelligence</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Organizations</div><div className="stat-value">{organizationResult.count ?? rows.length}</div></div>
        <div className="card"><div className="eyebrow">Properties</div><div className="stat-value">{propertyResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">People</div><div className="stat-value">{peopleResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Submission routes</div><div className="stat-value">{endpointResult.count ?? 0}</div></div>
      </section>

      <form className="card stack" method="get" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Find the right targets</h2><p className="muted">Filter the private network without exposing contact data publicly.</p></div>{activeFilterCount ? <Link className="button ghost" href="/targets">Clear {activeFilterCount} filters</Link> : null}</div>
        <div className="form-grid two">
          <label className="field"><span>Search</span><input className="input" name="q" defaultValue={queryText} placeholder="Name, channel type, or location" /></label>
          <label className="field"><span>Organization type</span><select className="input" name="type" defaultValue={typeFilter}><option value="">All types</option><option value="playlist">Playlist</option><option value="blog">Blog or publication</option><option value="radio">Radio</option><option value="label">Label</option><option value="creator">Creator</option><option value="agency">Agency</option><option value="platform">Platform</option></select></label>
          <label className="field"><span>Trust</span><select className="input" name="trust" defaultValue={trustFilter}><option value="">All trust tiers</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unknown">Unknown</option></select></label>
          <label className="field"><span>Verification</span><select className="input" name="verification" defaultValue={verificationFilter}><option value="">All verification states</option><option value="verified">Verified</option><option value="supported">Supported</option><option value="unverified">Unverified</option><option value="stale">Stale</option></select></label>
        </div>
        <button className="button primary" type="submit">Search network</button>
      </form>

      <section className="card">
        <div className="section-heading"><div><h2>Qualified target results</h2><p className="muted">Showing up to 100 records, prioritized by evidence strength and then name.</p></div><div className="tag-row"><span className="pill">{rows.length} shown</span><span className="pill">{interactionResult.count ?? 0} interactions</span></div></div>
        {rows.length ? rows.map((organization) => (
          <article className="directory-row" key={organization.id}>
            <div className="directory-main">
              <div className="section-heading tight"><div><strong>{organization.display_name || organization.canonical_name}</strong><p className="muted">{label(organization.org_type, "Industry target")}{organization.location ? ` · ${organization.location}` : ""}</p></div>{organization.evidence_strength !== null ? <span className="pill">Evidence {organization.evidence_strength}</span> : null}</div>
              <div className="tag-row">
                <span className="pill">Stage: {label(organization.relationship_stage, "identified")}</span>
                <span className="pill">Trust: {label(organization.trust_tier)}</span>
                <span className={`pill ${String(organization.risk_tier ?? "").toLowerCase().includes("high") ? "blocked" : ""}`}>Risk: {label(organization.risk_tier)}</span>
                <span className="pill">{label(organization.verification_status, "Unverified")}</span>
                <span className="pill">{label(organization.activity_status, "Activity unknown")}</span>
              </div>
              {organization.next_action ? <p className="next-action">Next: {organization.next_action}{organization.next_action_due ? ` · ${organization.next_action_due}` : ""}</p> : null}
            </div>
            <div className="nav-links"><Link className="button primary" href={`/targets/${organization.id}`}>Open workspace</Link>{organization.website ? <a className="button ghost" href={organization.website} target="_blank" rel="noreferrer">Website</a> : null}{organization.primary_source_url ? <a className="button ghost" href={organization.primary_source_url} target="_blank" rel="noreferrer">Evidence</a> : null}</div>
          </article>
        )) : <div className="empty">No targets matched these filters.</div>}
      </section>
    </main>
  );
}
