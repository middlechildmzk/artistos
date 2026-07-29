import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function displayName(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

export default async function ProofPage() {
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
  const [
    evidenceResult,
    outcomesResult,
    deliverablesResult,
    submissionsResult,
    campaignsResult,
    releasesResult,
    organizationsResult,
  ] = await Promise.all([
    supabase
      .from("evidence_records")
      .select("id, release_id, campaign_id, campaign_target_id, deliverable_id, evidence_type, source_type, source_uri, summary, confidence, verification_level, verification_method, verification_status, confidence_score, contradiction_state, observed_at, captured_at, expires_at, revoked_at")
      .eq("workspace_id", workspaceId)
      .order("captured_at", { ascending: false })
      .limit(200),
    supabase
      .from("outcomes")
      .select("id, campaign_id, release_id, organization_id, property_id, outcome_type, outcome_date, evidence_summary, url, confidence")
      .eq("workspace_id", workspaceId)
      .order("outcome_date", { ascending: false })
      .limit(100),
    supabase
      .from("campaign_deliverables")
      .select("id, campaign_id, campaign_target_id, channel, deliverable_type, description, due_at, status")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("campaign_submissions")
      .select("id, campaign_id, release_id, campaign_target_id, property_id, submission_mode, status, match_score, submitted_at, completed_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("campaigns").select("id, name, release_id, status").eq("workspace_id", workspaceId),
    supabase.from("releases").select("id, title").eq("workspace_id", workspaceId),
    supabase.from("organizations").select("id, display_name, canonical_name").eq("workspace_id", workspaceId),
  ]);

  const evidence = evidenceResult.data ?? [];
  const outcomes = outcomesResult.data ?? [];
  const deliverables = deliverablesResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  const campaignById = new Map((campaignsResult.data ?? []).map((campaign) => [campaign.id, campaign]));
  const releaseById = new Map((releasesResult.data ?? []).map((release) => [release.id, release]));
  const organizationById = new Map((organizationsResult.data ?? []).map((organization) => [organization.id, organization]));

  const verifiedEvidence = evidence.filter((item) => item.verification_status === "verified" || item.confidence === "verified");
  const contradictedEvidence = evidence.filter((item) => item.contradiction_state && item.contradiction_state !== "clear");
  const expiredEvidence = evidence.filter((item) => item.expires_at && new Date(item.expires_at).getTime() < Date.now());
  const completeDeliverables = deliverables.filter((item) => ["completed", "delivered", "verified"].includes(item.status ?? ""));
  const completedSubmissions = submissions.filter((item) => ["completed", "accepted", "placed"].includes(item.status ?? ""));

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Trust and verification layer</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>ArtistOS Proof</h1>
          <p className="muted">A source-visible ledger connecting submissions, deliverables, outcomes, and verified evidence back to each release and campaign.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/campaigns">Campaign Intelligence</Link>
          <Link className="button ghost" href="/targets">Network</Link>
          <Link className="button ghost" href="/analytics">Music Intelligence</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Evidence records</div><div className="stat-value">{evidence.length}</div></div>
        <div className="card"><div className="eyebrow">Verified</div><div className="stat-value">{verifiedEvidence.length}</div></div>
        <div className="card"><div className="eyebrow">Recorded outcomes</div><div className="stat-value">{outcomes.length}</div></div>
        <div className="card"><div className="eyebrow">Completed deliverables</div><div className="stat-value">{completeDeliverables.length}</div></div>
      </section>

      {(contradictedEvidence.length || expiredEvidence.length) ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading"><div><h2>Review queue</h2><p className="muted">Evidence requiring a human freshness or contradiction decision.</p></div><span className="pill blocked">{contradictedEvidence.length + expiredEvidence.length} items</span></div>
          <div className="tag-row"><span className="pill blocked">{contradictedEvidence.length} contradicted</span><span className="pill">{expiredEvidence.length} expired</span></div>
        </section>
      ) : null}

      <section className="grid two-col">
        <div className="card">
          <div className="section-heading"><div><h2>Evidence ledger</h2><p className="muted">Newest evidence first. Source links remain attached to the claim.</p></div><span className="pill">Append-only</span></div>
          {evidence.length ? evidence.map((item) => {
            const campaign = item.campaign_id ? campaignById.get(item.campaign_id) : null;
            const release = item.release_id ? releaseById.get(item.release_id) : null;
            const isProblem = (item.contradiction_state && item.contradiction_state !== "clear") || item.revoked_at;
            return (
              <article className="row" key={item.id}>
                <div>
                  <div className="tag-row"><span className={`pill ${isProblem ? "blocked" : ""}`}>{displayName(item.verification_status, displayName(item.confidence, "unknown"))}</span>{item.verification_level ? <span className="pill">{item.verification_level}</span> : null}</div>
                  <strong style={{ display: "block", marginTop: 8 }}>{displayName(item.summary, displayName(item.evidence_type, "Evidence record"))}</strong>
                  <p className="muted">{release?.title ?? "Workspace evidence"}{campaign ? ` · ${campaign.name}` : ""} · Captured {formatDate(item.captured_at)}</p>
                  {item.verification_method ? <p className="muted">Method: {item.verification_method}{item.confidence_score !== null ? ` · Confidence ${Number(item.confidence_score).toFixed(2)}` : ""}</p> : null}
                </div>
                {item.source_uri ? <a className="button ghost" href={item.source_uri} target="_blank" rel="noreferrer">Source</a> : null}
              </article>
            );
          }) : <div className="empty">Evidence will appear here as campaigns, links, and outcomes generate receipts.</div>}
        </div>

        <div className="stack">
          <section className="card">
            <div className="section-heading"><div><h2>Outcome receipts</h2><p className="muted">Promotion results tied to releases, campaigns, and source URLs.</p></div><span className="pill">{outcomes.length}</span></div>
            {outcomes.length ? outcomes.slice(0, 12).map((outcome) => {
              const campaign = outcome.campaign_id ? campaignById.get(outcome.campaign_id) : null;
              const release = outcome.release_id ? releaseById.get(outcome.release_id) : null;
              const organization = outcome.organization_id ? organizationById.get(outcome.organization_id) : null;
              return <div className="row" key={outcome.id}><div><strong>{outcome.outcome_type}</strong><p className="muted">{release?.title ?? "Release"}{campaign ? ` · ${campaign.name}` : ""}{organization ? ` · ${organization.display_name || organization.canonical_name}` : ""}</p><p className="muted">{formatDate(outcome.outcome_date)} · {outcome.confidence ?? "unknown confidence"}</p></div>{outcome.url ? <a className="button ghost" href={outcome.url} target="_blank" rel="noreferrer">Evidence</a> : null}</div>;
            }) : <div className="empty">No campaign outcomes have been recorded.</div>}
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Execution coverage</h2><p className="muted">The operational chain behind the evidence ledger.</p></div></div>
            <div className="row"><span>Submissions</span><strong>{submissions.length}</strong></div>
            <div className="row"><span>Completed submissions</span><strong>{completedSubmissions.length}</strong></div>
            <div className="row"><span>Deliverables</span><strong>{deliverables.length}</strong></div>
            <div className="row"><span>Completed deliverables</span><strong>{completeDeliverables.length}</strong></div>
          </section>
        </div>
      </section>
    </main>
  );
}
