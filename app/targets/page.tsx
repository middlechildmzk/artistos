import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function label(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim() || fallback;
}

export default async function TargetsPage() {
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
  const [{ data: organizations }, { count: peopleCount }, { count: endpointCount }, { count: interactionCount }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, canonical_name, org_type, location, trust_tier, risk_tier, verification_status, website, notes")
      .eq("workspace_id", workspaceId)
      .order("canonical_name")
      .limit(100),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("submission_endpoints").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const rows = organizations ?? [];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Campaign Intelligence</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Targets</h1>
          <p className="muted">Evidence-backed curators, media, playlists, labels, creators, and industry relationships.</p>
        </div>
        <nav className="nav-links"><Link className="button ghost" href="/dashboard">Today</Link><Link className="button ghost" href="/audience">Audience</Link></nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Organizations</div><div className="stat-value">{rows.length}</div></div>
        <div className="card"><div className="eyebrow">People</div><div className="stat-value">{peopleCount ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Submission routes</div><div className="stat-value">{endpointCount ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Interactions</div><div className="stat-value">{interactionCount ?? 0}</div></div>
      </section>

      <section className="card">
        <div className="section-heading"><div><h2>Network directory</h2><p className="muted">The first 100 workspace records, ordered alphabetically.</p></div><span className="pill">Private CRM</span></div>
        {rows.length ? rows.map((organization) => (
          <article className="directory-row" key={organization.id}>
            <div className="directory-main">
              <strong>{organization.canonical_name}</strong>
              <p className="muted">{label(organization.org_type, "Industry target")}{organization.location ? ` · ${organization.location}` : ""}</p>
              <div className="tag-row">
                <span className="pill">Trust: {label(organization.trust_tier)}</span>
                <span className={`pill ${String(organization.risk_tier ?? "").toLowerCase().includes("high") ? "blocked" : ""}`}>Risk: {label(organization.risk_tier)}</span>
                <span className="pill">{label(organization.verification_status, "Unverified")}</span>
              </div>
            </div>
            {organization.website ? <a className="button" href={organization.website} target="_blank" rel="noreferrer">Open site</a> : <span className="muted">No site saved</span>}
          </article>
        )) : <div className="empty">No targets have been added to this workspace yet.</div>}
      </section>
    </main>
  );
}
