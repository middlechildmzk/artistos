import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AudiencePage() {
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

  const [{ data: fans }, { count: allFans }, { count: suppressionCount }, { count: importCount }] = await Promise.all([
    supabase
      .from("contactable_fans")
      .select("id, email, name, first_name, segment, consent_status, consent_source, location, verification_status, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("fans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("suppressions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const unsuppressed = fans ?? [];
  // Suppression filtering is not the same as confirmed contact permission.
  // This screen is informational; it must not imply any fan is send-eligible.

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Audience Intelligence</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Audience</h1>
          <p className="muted">Suppression-filtered fan records, imported labels, segments, and source lineage. This is not a verified marketing send list.</p>
        </div>
        <nav className="nav-links"><Link className="button ghost" href="/dashboard">Today</Link><Link className="button ghost" href="/targets">Targets</Link></nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">All fan records</div><div className="stat-value">{allFans ?? 0}</div></div>
        <div className="card"><div className="eyebrow">Unsuppressed loaded</div><div className="stat-value">{unsuppressed.length}</div></div>
        <div className="card"><div className="eyebrow">Marketing permission</div><div className="stat-value">Not evaluated</div></div>
        <div className="card"><div className="eyebrow">Suppressions</div><div className="stat-value">{suppressionCount ?? 0}</div></div>
      </section>

      <div className="card" role="note" style={{ marginBottom: 16 }}>
        <strong>Marketing permission is not confirmed by this audience list.</strong>
        <p className="muted">The source view filters suppressed emails only. Imported consent labels and deliverability checks do not establish a verified opt-in. Sending requires separate, per-fan consent evidence, confirmed contact ownership, and suppression checks. No bulk messaging is available here.</p>
      </div>

      <section className="grid two-col">
        <div className="card">
          <div className="section-heading"><div><h2>Recent unsuppressed records</h2><p className="muted">Suppression-filtered only. Not a list of contacts approved for email or SMS marketing.</p></div><span className="pill">{unsuppressed.length} loaded</span></div>
          {unsuppressed.length ? unsuppressed.map((fan) => (
            <article className="directory-row" key={fan.id}>
              <div className="directory-main">
                <strong>{fan.name || fan.first_name || fan.email}</strong>
                <p className="muted">{fan.email}{fan.location ? ` · ${fan.location}` : ""}</p>
                <div className="tag-row">
                  <span className="pill">{fan.segment || "Unsegmented"}</span>
                  <span className="pill">Imported consent label: {fan.consent_status || "Unknown"}</span>
                  <span className="pill">Data verification: {fan.verification_status || "Unverified"}</span>
                </div>
              </div>
            </article>
          )) : <div className="empty">No unsuppressed records are available yet.</div>}
        </div>

        <aside className="stack">
          <div className="card">
            <div className="eyebrow">Import center</div>
            <h2 style={{ marginTop: 8 }}>Safe data onboarding</h2>
            <p className="muted">The secure importer is the next active build: private upload, column mapping, dry run, dedupe, suppression checks, audit, and rollback.</p>
            <div className="row"><span>Import batches</span><strong>{importCount ?? 0}</strong></div>
            <div className="row"><span>Storage</span><span className="pill">Private</span></div>
            <div className="row"><span>Suppression-aware</span><span className="pill">Required</span></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
