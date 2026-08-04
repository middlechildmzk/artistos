import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function label(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim() || fallback;
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

type TargetSearchParams = Promise<{
  q?: string;
  type?: string;
  platform?: string;
  contact?: string;
  trust?: string;
  verification?: string;
  activity?: string;
}>;

type PropertySummary = {
  organization_id: string | null;
  name: string;
  property_type: string | null;
  platform: string | null;
  url: string | null;
  followers_estimate: number | null;
  genre_tags: string[] | null;
  verification_status: string | null;
};

type PersonSummary = {
  organization_id: string | null;
  email: string | null;
  email_status: string | null;
  full_name: string | null;
  role: string | null;
};

type EndpointSummary = {
  organization_id: string | null;
  endpoint_type: string | null;
  submission_url: string | null;
  submission_email: string | null;
  verification_status: string | null;
};

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
  const platformFilter = String(filters.platform ?? "").trim();
  const contactFilter = String(filters.contact ?? "").trim();
  const trustFilter = String(filters.trust ?? "").trim();
  const verificationFilter = String(filters.verification ?? "").trim();
  const activityFilter = String(filters.activity ?? "").trim();

  let organizationQuery = supabase
    .from("organizations")
    .select("id, canonical_name, display_name, org_type, location, activity_status, trust_tier, risk_tier, verification_status, evidence_strength, website, primary_source_url, notes, relationship_stage, next_action, next_action_due", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("evidence_strength", { ascending: false, nullsFirst: false })
    .order("canonical_name")
    .limit(150);

  if (queryText) organizationQuery = organizationQuery.or(`canonical_name.ilike.%${queryText}%,display_name.ilike.%${queryText}%,org_type.ilike.%${queryText}%,location.ilike.%${queryText}%`);
  if (typeFilter) organizationQuery = organizationQuery.eq("org_type", typeFilter);
  if (trustFilter) organizationQuery = organizationQuery.eq("trust_tier", trustFilter);
  if (verificationFilter) organizationQuery = organizationQuery.eq("verification_status", verificationFilter);
  if (activityFilter) organizationQuery = organizationQuery.eq("activity_status", activityFilter);

  const [organizationResult, peopleCountResult, propertyCountResult, endpointCountResult, interactionResult] = await Promise.all([
    organizationQuery,
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("submission_endpoints").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const organizations = organizationResult.data ?? [];
  const organizationIds = organizations.map((organization) => organization.id);
  const [propertiesResult, peopleResult, endpointsResult] = organizationIds.length ? await Promise.all([
    supabase.from("properties").select("organization_id,name,property_type,platform,url,followers_estimate,genre_tags,verification_status").eq("workspace_id", workspaceId).in("organization_id", organizationIds).is("archived_at", null).limit(1000),
    supabase.from("people").select("organization_id,email,email_status,full_name,role").eq("workspace_id", workspaceId).in("organization_id", organizationIds).is("archived_at", null).limit(1000),
    supabase.from("submission_endpoints").select("organization_id,endpoint_type,submission_url,submission_email,verification_status").eq("workspace_id", workspaceId).in("organization_id", organizationIds).limit(1000),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  const propertiesByOrganization = new Map<string, PropertySummary[]>();
  for (const property of (propertiesResult.data ?? []) as PropertySummary[]) {
    if (!property.organization_id) continue;
    const list = propertiesByOrganization.get(property.organization_id) ?? [];
    list.push(property);
    propertiesByOrganization.set(property.organization_id, list);
  }

  const peopleByOrganization = new Map<string, PersonSummary[]>();
  for (const person of (peopleResult.data ?? []) as PersonSummary[]) {
    if (!person.organization_id) continue;
    const list = peopleByOrganization.get(person.organization_id) ?? [];
    list.push(person);
    peopleByOrganization.set(person.organization_id, list);
  }

  const endpointsByOrganization = new Map<string, EndpointSummary[]>();
  for (const endpoint of (endpointsResult.data ?? []) as EndpointSummary[]) {
    if (!endpoint.organization_id) continue;
    const list = endpointsByOrganization.get(endpoint.organization_id) ?? [];
    list.push(endpoint);
    endpointsByOrganization.set(endpoint.organization_id, list);
  }

  const rows = organizations.filter((organization) => {
    const properties = propertiesByOrganization.get(organization.id) ?? [];
    const people = peopleByOrganization.get(organization.id) ?? [];
    const endpoints = endpointsByOrganization.get(organization.id) ?? [];
    if (platformFilter && !properties.some((property) => property.platform === platformFilter)) return false;
    if (contactFilter === "email" && !people.some((person) => Boolean(person.email)) && !endpoints.some((endpoint) => Boolean(endpoint.submission_email))) return false;
    if (contactFilter === "form" && !endpoints.some((endpoint) => Boolean(endpoint.submission_url))) return false;
    if (contactFilter === "any" && !people.some((person) => Boolean(person.email)) && !endpoints.some((endpoint) => Boolean(endpoint.submission_email || endpoint.submission_url))) return false;
    return true;
  });

  const activeFilterCount = [queryText, typeFilter, platformFilter, contactFilter, trustFilter, verificationFilter, activityFilter].filter(Boolean).length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Music industry sourcing</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Network Intelligence</h1>
          <p className="muted">Find and qualify curators, playlist owners, YouTube channels, creators, radio, media, sync organizations, labels, and their public contact routes.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
          <Link className="button ghost" href="/proof">Proof</Link>
          <Link className="button ghost" href="/analytics">Music Intelligence</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Organizations</div><div className="stat-value">{organizationResult.count ?? organizations.length}</div></div>
        <div className="card"><div className="eyebrow">Pages and properties</div><div className="stat-value">{propertyCountResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">People</div><div className="stat-value">{peopleCountResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Submission routes</div><div className="stat-value">{endpointCountResult.count ?? 0}</div></div>
      </section>

      <form className="card stack" method="get" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><h2>Source music-industry targets</h2><p className="muted">Recruiter-style search across organizations, public pages, contacts, submission routes, trust, activity, and verification.</p></div>{activeFilterCount ? <Link className="button ghost" href="/targets">Clear {activeFilterCount} filters</Link> : null}</div>
        <div className="form-grid two">
          <label className="field"><span>Keywords</span><input className="input" name="q" defaultValue={queryText} placeholder="Future bass, sync, radio, YouTube, Minneapolis" /></label>
          <label className="field"><span>Target type</span><select className="input" name="type" defaultValue={typeFilter}><option value="">All target types</option><option value="playlist">Playlist or curator</option><option value="creator">Creator or influencer</option><option value="blog">Blog or publication</option><option value="radio">Radio</option><option value="sync">Sync or licensing</option><option value="label">Label</option><option value="agency">Agency</option><option value="platform">Platform</option></select></label>
          <label className="field"><span>Platform</span><select className="input" name="platform" defaultValue={platformFilter}><option value="">All platforms</option><option value="spotify">Spotify</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="soundcloud">SoundCloud</option><option value="apple_music">Apple Music</option><option value="radio">Radio</option><option value="website">Website</option></select></label>
          <label className="field"><span>Public contact route</span><select className="input" name="contact" defaultValue={contactFilter}><option value="">Any contact state</option><option value="any">Contact route exists</option><option value="email">Email exists</option><option value="form">Submission form exists</option></select></label>
          <label className="field"><span>Trust</span><select className="input" name="trust" defaultValue={trustFilter}><option value="">All trust tiers</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unknown">Unknown</option></select></label>
          <label className="field"><span>Verification</span><select className="input" name="verification" defaultValue={verificationFilter}><option value="">All verification states</option><option value="verified">Verified</option><option value="supported">Supported</option><option value="unverified">Unverified</option><option value="stale">Stale</option></select></label>
          <label className="field"><span>Activity</span><select className="input" name="activity" defaultValue={activityFilter}><option value="">Any activity</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="unknown">Unknown</option></select></label>
        </div>
        <button className="button primary" type="submit">Search network</button>
      </form>

      <section className="card">
        <div className="section-heading"><div><h2>Qualified target results</h2><p className="muted">Evidence-first results. Contact routes are public or manually confirmed and remain private to the workspace.</p></div><div className="tag-row"><span className="pill">{rows.length} shown</span><span className="pill">{interactionResult.count ?? 0} interactions</span></div></div>
        {rows.length ? rows.map((organization) => {
          const properties = propertiesByOrganization.get(organization.id) ?? [];
          const people = peopleByOrganization.get(organization.id) ?? [];
          const endpoints = endpointsByOrganization.get(organization.id) ?? [];
          const primaryProperty = [...properties].sort((a, b) => (b.followers_estimate ?? 0) - (a.followers_estimate ?? 0))[0] ?? null;
          const emails = people.filter((person) => person.email).length + endpoints.filter((endpoint) => endpoint.submission_email).length;
          const forms = endpoints.filter((endpoint) => endpoint.submission_url).length;
          const genres = [...new Set(properties.flatMap((property) => property.genre_tags ?? []))].slice(0, 4);
          return (
            <article className="directory-row" key={organization.id}>
              <div className="directory-main">
                <div className="section-heading tight"><div><strong>{organization.display_name || organization.canonical_name}</strong><p className="muted">{label(organization.org_type, "Industry target")}{organization.location ? ` · ${organization.location}` : ""}</p></div>{organization.evidence_strength !== null ? <span className="pill">Evidence {organization.evidence_strength}/5</span> : null}</div>
                <div className="tag-row">
                  {primaryProperty ? <span className="pill">{label(primaryProperty.platform, primaryProperty.property_type || "Property")}{primaryProperty.followers_estimate ? ` · ${formatNumber(primaryProperty.followers_estimate)}` : ""}</span> : null}
                  <span className="pill">{properties.length} properties</span>
                  <span className={`pill ${emails || forms ? "success" : "blocked"}`}>{emails ? `${emails} email route${emails === 1 ? "" : "s"}` : forms ? `${forms} form${forms === 1 ? "" : "s"}` : "No contact route"}</span>
                  <span className="pill">Stage: {label(organization.relationship_stage, "identified")}</span>
                  <span className="pill">Trust: {label(organization.trust_tier)}</span>
                  <span className={`pill ${String(organization.risk_tier ?? "").toLowerCase().includes("high") ? "blocked" : ""}`}>Risk: {label(organization.risk_tier)}</span>
                  <span className="pill">{label(organization.verification_status, "Unverified")}</span>
                </div>
                {genres.length ? <div className="tag-row" style={{ marginTop: 8 }}>{genres.map((genre) => <span className="pill" key={genre}>{genre}</span>)}</div> : null}
                {organization.next_action ? <p className="next-action">Next: {organization.next_action}{organization.next_action_due ? ` · ${organization.next_action_due}` : ""}</p> : null}
              </div>
              <div className="nav-links"><Link className="button primary" href={`/targets/${organization.id}`}>Open target</Link>{primaryProperty?.url ? <a className="button ghost" href={primaryProperty.url} target="_blank" rel="noreferrer">Open property</a> : organization.website ? <a className="button ghost" href={organization.website} target="_blank" rel="noreferrer">Website</a> : null}{organization.primary_source_url ? <a className="button ghost" href={organization.primary_source_url} target="_blank" rel="noreferrer">Evidence</a> : null}</div>
            </article>
          );
        }) : <div className="empty">No targets matched these filters.</div>}
      </section>
    </main>
  );
}
