import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  categoryMatches,
  deriveContactRouteState,
  derivePermissionState,
  normalize,
  normalizeEmail,
  parseContactEmails,
  routeStateLabel,
  sourceStrengthLabel,
  targetCategoryTerms,
  type ContactRouteState,
  type TargetCategory,
} from "@/lib/network-intelligence/entity-search";

const PAGE_SIZE = 30;

function label(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim() || fallback;
}

function formatNumber(value: string | number | null | undefined) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return label(String(value ?? ""), "Unknown");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(numeric);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not dated";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function safeSearchValue(value: string | null | undefined) {
  return String(value ?? "").replace(/[,%()]/g, " ").trim().slice(0, 120);
}

function propertyCategoryExpression(category: string) {
  const terms = targetCategoryTerms[category as TargetCategory] ?? [normalize(category)];
  return terms.flatMap((term) => [
    `name.ilike.%${term}%`,
    `property_type.ilike.%${term}%`,
    `platform.ilike.%${term}%`,
    `genres.ilike.%${term}%`,
  ]).join(",");
}

function peopleCategoryExpression(category: string) {
  const terms = targetCategoryTerms[category as TargetCategory] ?? [normalize(category)];
  return terms.flatMap((term) => [
    `contact_type.ilike.%${term}%`,
    `role.ilike.%${term}%`,
    `genres.ilike.%${term}%`,
    `titles_tracks_playlists.ilike.%${term}%`,
  ]).join(",");
}

type TargetSearchParams = Promise<{
  q?: string;
  type?: string;
  platform?: string;
  contact?: string;
  verification?: string;
  page?: string;
}>;

type OrganizationSummary = {
  id: string;
  display_name: string | null;
  canonical_name: string;
  org_type: string | null;
  location: string | null;
  verification_status: string | null;
  trust_tier: string | null;
  risk_tier: string | null;
  relationship_stage: string | null;
};

type PropertyResult = {
  id: string;
  organization_id: string | null;
  name: string;
  property_type: string | null;
  platform: string | null;
  url: string | null;
  platform_url: string | null;
  owner_or_operator: string | null;
  contact_emails: string | null;
  genre_tags: string[] | null;
  genres: string | null;
  followers_estimate: string | null;
  followers_asof: string | null;
  activity_status: string | null;
  verification_status: string | null;
  evidence_strength: number | null;
  source: string | null;
  source_file: string | null;
  source_record_id: string | null;
  relationship_stage: string | null;
};

type PersonResult = {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  role: string | null;
  contact_type: string | null;
  email: string | null;
  normalized_email: string | null;
  email_status: string | null;
  consent_status: string | null;
  verification_status: string | null;
  evidence_strength: number | null;
  source_category: string | null;
  source_file: string | null;
  source_record_id: string | null;
  genres: string | null;
  titles_tracks_playlists: string | null;
  relationship_stage: string | null;
};

type EndpointResult = {
  id: string;
  organization_id: string | null;
  property_id: string | null;
  endpoint_type: string | null;
  submission_url: string | null;
  submission_email: string | null;
  submission_status: string | null;
  verification_status: string | null;
  free_or_paid: string | null;
};

function routePillClass(state: ContactRouteState) {
  if (state === "open") return "success";
  if (state === "blocked_suppressed" || state === "outreach_not_authorized") return "blocked";
  return "";
}

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
  const queryText = safeSearchValue(filters.q);
  const typeFilter = safeSearchValue(filters.type);
  const platformFilter = safeSearchValue(filters.platform);
  const contactFilter = safeSearchValue(filters.contact);
  const verificationFilter = safeSearchValue(filters.verification);
  const page = Math.max(1, Number.parseInt(String(filters.page ?? "1"), 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let propertyQuery = supabase
    .from("properties")
    .select("id,organization_id,name,property_type,platform,url,platform_url,owner_or_operator,contact_emails,genre_tags,genres,followers_estimate,followers_asof,activity_status,verification_status,evidence_strength,source,source_file,source_record_id,relationship_stage", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("evidence_strength", { ascending: false, nullsFirst: false })
    .order("name")
    .range(offset, offset + PAGE_SIZE - 1);

  if (queryText) propertyQuery = propertyQuery.or(`name.ilike.%${queryText}%,property_type.ilike.%${queryText}%,platform.ilike.%${queryText}%,owner_or_operator.ilike.%${queryText}%,genres.ilike.%${queryText}%,contact_emails.ilike.%${queryText}%`);
  if (typeFilter) propertyQuery = propertyQuery.or(propertyCategoryExpression(typeFilter));
  if (platformFilter) propertyQuery = propertyQuery.ilike("platform", platformFilter);
  if (contactFilter === "email") propertyQuery = propertyQuery.not("contact_emails", "is", null).neq("contact_emails", "");
  if (verificationFilter) propertyQuery = propertyQuery.eq("verification_status", verificationFilter);

  let peopleQuery = supabase
    .from("people")
    .select("id,organization_id,full_name,role,contact_type,email,normalized_email,email_status,consent_status,verification_status,evidence_strength,source_category,source_file,source_record_id,genres,titles_tracks_playlists,relationship_stage", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("evidence_strength", { ascending: false, nullsFirst: false })
    .order("full_name")
    .range(offset, offset + PAGE_SIZE - 1);

  if (queryText) peopleQuery = peopleQuery.or(`full_name.ilike.%${queryText}%,role.ilike.%${queryText}%,contact_type.ilike.%${queryText}%,email.ilike.%${queryText}%,genres.ilike.%${queryText}%,titles_tracks_playlists.ilike.%${queryText}%`);
  if (typeFilter) peopleQuery = peopleQuery.or(peopleCategoryExpression(typeFilter));
  if (platformFilter) peopleQuery = peopleQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  if (contactFilter === "email") peopleQuery = peopleQuery.not("email", "is", null).neq("email", "");
  if (verificationFilter) peopleQuery = peopleQuery.eq("verification_status", verificationFilter);

  const [
    propertyResult,
    peopleResult,
    organizationCountResult,
    propertyCountResult,
    peopleCountResult,
    linkedEntityCountResult,
    openEndpointCountResult,
    organizationsResult,
    endpointsResult,
    suppressionsResult,
    propertyOptionsResult,
    peopleOptionsResult,
    interactionCountResult,
  ] = await Promise.all([
    propertyQuery,
    peopleQuery,
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null).not("organization_id", "is", null),
    supabase.from("submission_endpoints").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("submission_status", "open"),
    supabase.from("organizations").select("id,display_name,canonical_name,org_type,location,verification_status,trust_tier,risk_tier,relationship_stage").eq("workspace_id", workspaceId).limit(1000),
    supabase.from("submission_endpoints").select("id,organization_id,property_id,endpoint_type,submission_url,submission_email,submission_status,verification_status,free_or_paid").eq("workspace_id", workspaceId).limit(1000),
    supabase.from("suppressions").select("normalized_email,email").eq("workspace_id", workspaceId).limit(10000),
    supabase.from("properties").select("platform,verification_status,property_type,name,genres").eq("workspace_id", workspaceId).is("archived_at", null).limit(5000),
    supabase.from("people").select("verification_status,contact_type,role,genres,titles_tracks_playlists").eq("workspace_id", workspaceId).is("archived_at", null).limit(10000),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const properties = (propertyResult.data ?? []) as PropertyResult[];
  const people = (peopleResult.data ?? []) as PersonResult[];
  const organizations = (organizationsResult.data ?? []) as OrganizationSummary[];
  const endpoints = (endpointsResult.data ?? []) as EndpointResult[];
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const suppressedEmails = new Set((suppressionsResult.data ?? []).map((row) => normalizeEmail(row.normalized_email || row.email)).filter(Boolean));

  const availablePlatforms = [...new Set((propertyOptionsResult.data ?? []).map((row) => normalize(row.platform)).filter((value) => value && value !== "unknown"))].sort();
  const verificationValues = [...new Set([
    ...(propertyOptionsResult.data ?? []).map((row) => normalize(row.verification_status)),
    ...(peopleOptionsResult.data ?? []).map((row) => normalize(row.verification_status)),
  ].filter(Boolean))].sort();

  const categoryOptions: Array<{ value: TargetCategory; label: string }> = [
    { value: "playlist", label: "Playlist or curator" },
    { value: "creator", label: "Creator or influencer" },
    { value: "media", label: "Blog, press, or podcast" },
    { value: "radio", label: "Radio" },
    { value: "sync", label: "Sync or licensing" },
    { value: "label", label: "Label or publishing" },
    { value: "agency", label: "Agency, management, or booking" },
    { value: "live", label: "Venue or festival" },
    { value: "platform", label: "Platform or directory" },
  ].filter((option) => {
    const propertyMatch = (propertyOptionsResult.data ?? []).some((row) => categoryMatches(option.value, [row.name, row.property_type, row.platform, row.genres]));
    const peopleMatch = (peopleOptionsResult.data ?? []).some((row) => categoryMatches(option.value, [row.contact_type, row.role, row.genres, row.titles_tracks_playlists]));
    return propertyMatch || peopleMatch;
  });

  const activeFilterCount = [typeFilter, platformFilter, contactFilter, verificationFilter].filter(Boolean).length;
  const propertyMatches = propertyResult.count ?? properties.length;
  const peopleMatches = peopleResult.count ?? people.length;
  const totalMatches = propertyMatches + peopleMatches;
  const hasNextPage = offset + properties.length < propertyMatches || offset + people.length < peopleMatches;
  const queryString = new URLSearchParams();
  if (queryText) queryString.set("q", queryText);
  if (typeFilter) queryString.set("type", typeFilter);
  if (platformFilter) queryString.set("platform", platformFilter);
  if (contactFilter) queryString.set("contact", contactFilter);
  if (verificationFilter) queryString.set("verification", verificationFilter);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Music industry sourcing</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Network Intelligence</h1>
          <p className="muted">Search properties and people directly. Organization resolution is enrichment, not a requirement for visibility.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
          <Link className="button ghost" href="/proof">Proof</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Searchable properties</div><div className="stat-value">{propertyCountResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Searchable people</div><div className="stat-value">{peopleCountResult.count ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Organization-linked people</div><div className="stat-value">{linkedEntityCountResult.count ?? 0}</div><p className="muted">of {peopleCountResult.count ?? 0}</p></div>
        <div className="card"><div className="eyebrow">Open submission routes</div><div className="stat-value">{openEndpointCountResult.count ?? 0}</div><p className="muted">{organizationCountResult.count ?? 0} organizations</p></div>
      </section>

      <form className="card stack" method="get" style={{ marginBottom: 16 }}>
        <div className="section-heading">
          <div><h2>Find evidence-backed targets</h2><p className="muted">No direct sending from search. Review identity, source, suppression, and route state before campaign assignment.</p></div>
          {queryText || activeFilterCount ? <Link className="button ghost" href="/targets">Clear search</Link> : null}
        </div>
        <div className="form-grid two">
          <label className="field"><span>Keywords</span><input className="input" name="q" defaultValue={queryText} placeholder="Future bass, radio, playlist, Minneapolis" /></label>
          <button className="button primary align-end" type="submit">Search network</button>
        </div>
        <details open={activeFilterCount > 0}>
          <summary><strong>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</strong></summary>
          <div className="form-grid two" style={{ marginTop: 12 }}>
            <label className="field"><span>Target category</span><select className="input" name="type" defaultValue={typeFilter}><option value="">All available categories</option>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="field"><span>Platform</span><select className="input" name="platform" defaultValue={platformFilter}><option value="">All available platforms</option>{availablePlatforms.map((platform) => <option key={platform} value={platform}>{platform === "spotify" ? "Spotify" : platform === "radio" ? "Radio" : label(platform)}</option>)}</select></label>
            <label className="field"><span>Contact evidence</span><select className="input" name="contact" defaultValue={contactFilter}><option value="">Any contact state</option><option value="email">Public email field exists</option></select></label>
            <label className="field"><span>Verification</span><select className="input" name="verification" defaultValue={verificationFilter}><option value="">All available states</option>{verificationValues.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          </div>
        </details>
      </form>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-heading">
          <div><h2>Search results</h2><p className="muted">{totalMatches} matching records. Showing up to {PAGE_SIZE} properties and {PAGE_SIZE} people on page {page}.</p></div>
          <div className="tag-row"><span className="pill">{properties.length + people.length} shown</span><span className="pill">{interactionCountResult.count ?? 0} interactions</span></div>
        </div>

        {properties.length ? <div className="stack">
          <div className="section-heading tight"><h3>Properties</h3><span className="pill">{propertyMatches} matches</span></div>
          {properties.map((property) => {
            const organization = property.organization_id ? organizationById.get(property.organization_id) : null;
            const relatedEndpoints = endpoints.filter((endpoint) => endpoint.property_id === property.id || (property.organization_id && endpoint.organization_id === property.organization_id));
            const contactEmails = parseContactEmails(property.contact_emails);
            const endpointEmails = relatedEndpoints.map((endpoint) => normalizeEmail(endpoint.submission_email)).filter(Boolean);
            const allEmails = [...new Set([...contactEmails, ...endpointEmails])];
            const endpoint = relatedEndpoints.find((candidate) => candidate.submission_status === "open") ?? relatedEndpoints[0] ?? null;
            const routeState = deriveContactRouteState({ emails: allEmails, suppressedEmails, submissionStatus: endpoint?.submission_status, permissionState: allEmails.length ? "unknown" : undefined });
            const sourceUrl = property.source_file?.startsWith("http") ? property.source_file : property.source?.startsWith("http") ? property.source : null;
            return (
              <article className="directory-row" key={`property-${property.id}`}>
                <div className="directory-main">
                  <div className="section-heading tight">
                    <div><strong>{property.name}</strong><p className="muted">{label(property.property_type, property.platform || "Property")}{organization ? ` · ${organization.display_name || organization.canonical_name}` : " · Organization unresolved"}</p></div>
                    <span className="pill">Evidence {property.evidence_strength ?? 1}/5</span>
                  </div>
                  <div className="tag-row">
                    <span className="pill">{label(property.platform, "Platform unknown")}</span>
                    <span className={`pill ${routePillClass(routeState)}`}>{routeStateLabel(routeState)}</span>
                    <span className="pill">{sourceStrengthLabel(property.source_record_id, property.source_file)}</span>
                    <span className="pill">{label(property.verification_status, "unverified")}</span>
                    {!organization ? <span className="pill blocked">Identity review needed</span> : <span className="pill">Stage: {label(property.relationship_stage, organization.relationship_stage || "identified")}</span>}
                  </div>
                  {property.followers_estimate ? <p className="muted">Audience signal: {formatNumber(property.followers_estimate)} · as of {formatDate(property.followers_asof)}</p> : <p className="muted">Audience signal not recorded.</p>}
                  {(property.genre_tags ?? []).length ? <div className="tag-row">{(property.genre_tags ?? []).slice(0, 4).map((genre) => <span className="pill" key={`${property.id}-${genre}`}>{genre}</span>)}</div> : null}
                </div>
                <div className="nav-links">
                  {organization ? <Link className="button primary" href={`/targets/${organization.id}`}>Open target</Link> : null}
                  {property.url || property.platform_url ? <a className="button ghost" href={property.url || property.platform_url || "#"} target="_blank" rel="noreferrer">Open property</a> : null}
                  {sourceUrl ? <a className="button ghost" href={sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}
                </div>
              </article>
            );
          })}
        </div> : null}

        {people.length ? <div className="stack" style={{ marginTop: properties.length ? 20 : 0 }}>
          <div className="section-heading tight"><h3>People and contact records</h3><span className="pill">{peopleMatches} matches</span></div>
          {people.map((person) => {
            const organization = person.organization_id ? organizationById.get(person.organization_id) : null;
            const email = normalizeEmail(person.normalized_email || person.email);
            const isSuppressed = Boolean(email && suppressedEmails.has(email));
            const permissionState = derivePermissionState(person.consent_status, isSuppressed);
            const routeState = deriveContactRouteState({ emails: email ? [email] : [], suppressedEmails, permissionState });
            const sourceUrl = person.source_file?.startsWith("http") ? person.source_file : null;
            return (
              <article className="directory-row" key={`person-${person.id}`}>
                <div className="directory-main">
                  <div className="section-heading tight">
                    <div><strong>{label(person.full_name, "Unnamed contact")}</strong><p className="muted">{label(person.role, person.contact_type || "Industry contact")}{organization ? ` · ${organization.display_name || organization.canonical_name}` : " · Organization unresolved"}</p></div>
                    <span className="pill">Evidence {person.evidence_strength ?? 1}/5</span>
                  </div>
                  <div className="tag-row">
                    <span className={`pill ${routePillClass(routeState)}`}>{routeStateLabel(routeState)}</span>
                    <span className="pill">{sourceStrengthLabel(person.source_record_id, person.source_file)}</span>
                    <span className="pill">{label(person.verification_status, "unverified")}</span>
                    <span className="pill">Stage: {label(person.relationship_stage, "identified")}</span>
                    {!organization ? <span className="pill blocked">Identity review needed</span> : null}
                  </div>
                  <p className="muted">{email || "No public email saved"} · {label(person.email_status, "email state unknown")}</p>
                  {person.consent_status?.includes("opt-in/download/old list") ? <p className="muted">Legacy import consent label detected. Treat as public business contact pending corrective migration and human review.</p> : null}
                </div>
                <div className="nav-links">
                  {organization ? <Link className="button primary" href={`/targets/${organization.id}`}>Open target</Link> : null}
                  {sourceUrl ? <a className="button ghost" href={sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}
                </div>
              </article>
            );
          })}
        </div> : null}

        {!properties.length && !people.length ? <div className="empty">No properties or people matched these filters. Available filter choices are derived from current workspace data.</div> : null}

        <div className="nav-links" style={{ marginTop: 20 }}>
          {page > 1 ? <Link className="button ghost" href={`/targets?${new URLSearchParams([...queryString.entries(), ["page", String(page - 1)]]).toString()}`}>Previous page</Link> : null}
          {hasNextPage ? <Link className="button" href={`/targets?${new URLSearchParams([...queryString.entries(), ["page", String(page + 1)]]).toString()}`}>Next page</Link> : null}
        </div>
      </section>
    </main>
  );
}
