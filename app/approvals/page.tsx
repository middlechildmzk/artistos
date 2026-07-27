import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function tone(decision: string) {
  if (decision === "succeeded" || decision === "approved") return "pill success";
  if (decision === "failed" || decision === "denied" || decision === "rejected") return "pill blocked";
  return "pill";
}

export default async function ApprovalCenterPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const [approvalResult, auditResult] = await Promise.all([
    supabase
      .from("capability_approvals")
      .select("id,capability_name,capability_version,status,preview,preview_hash,requested_by,reviewed_by,reviewed_at,review_note,created_at")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("capability_audit_log")
      .select("id,capability_name,capability_version,risk_class,decision,policy_id,error_code,error_message,evidence_ids,created_at")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const approvals = approvalResult.data ?? [];
  const audits = auditResult.data ?? [];
  const pending = approvals.filter((item) => item.status === "pending");
  const failures = audits.filter((item) => item.decision === "failed" || item.decision === "denied");
  const successes = audits.filter((item) => item.decision === "succeeded");

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo">A</div><div><div className="eyebrow">Control plane</div><strong>Approval Center</strong></div></div>
        <div className="nav-links"><Link className="button ghost" href="/dashboard">Dashboard</Link><Link className="button ghost" href="/execution">Execution</Link><Link className="button ghost" href="/automations">Automations</Link></div>
      </header>

      <section className="card release-card" style={{ marginBottom: 16 }}>
        <div className="eyebrow">Human authority</div>
        <h1>Review what ArtistOS may do, and why</h1>
        <p className="muted">Every protected capability creates a frozen preview and immutable audit trail. R2, R3, and R4 actions remain human-gated regardless of trust score.</p>
      </section>

      {(approvalResult.error || auditResult.error) ? (
        <section className="notice" style={{ marginBottom: 16 }}>
          Runtime ledger is not available in this environment yet. Apply the source-controlled migration to a disposable Supabase branch before enabling this page in production.
        </section>
      ) : null}

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Pending review</div><div className="stat-value">{pending.length}</div></div>
        <div className="card"><div className="eyebrow">Successful actions</div><div className="stat-value">{successes.length}</div></div>
        <div className="card"><div className="eyebrow">Denied or failed</div><div className="stat-value">{failures.length}</div></div>
        <div className="card"><div className="eyebrow">Workspace role</div><div className="stat-value" style={{ fontSize: 24 }}>{membership.role}</div></div>
      </section>

      <section className="grid two-col">
        <div className="stack">
          <div className="card">
            <div className="section-heading"><h2>Pending approvals</h2><span className="pill">{pending.length}</span></div>
            {pending.length ? pending.map((item) => (
              <article className="row" key={item.id} style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{item.capability_name}@{item.capability_version}</strong>
                  <p className="muted">Requested {formatDate(item.created_at)}</p>
                  <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(item.preview, null, 2)}</pre>
                  <p className="muted" style={{ fontSize: 12 }}>Preview hash: {item.preview_hash}</p>
                </div>
                <span className="pill">pending</span>
              </article>
            )) : <div className="empty">No protected actions are waiting for review.</div>}
            <p className="muted" style={{ marginTop: 16 }}>Approve/reject controls will activate only after atomic review-and-execute semantics are validated. This page intentionally does not offer a misleading button that merely changes status.</p>
          </div>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="section-heading"><h2>Recent runtime receipts</h2><span className="pill">{audits.length}</span></div>
            {audits.length ? audits.slice(0, 30).map((item) => (
              <div className="row" key={item.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <strong>{item.capability_name}</strong>
                  <p className="muted">{item.risk_class} · {formatDate(item.created_at)}</p>
                  {item.policy_id ? <p className="muted">Policy: {item.policy_id}</p> : null}
                  {item.error_message ? <p className="muted">{item.error_code}: {item.error_message}</p> : null}
                  {item.evidence_ids?.length ? <p className="muted">Evidence: {item.evidence_ids.length}</p> : null}
                </div>
                <span className={tone(item.decision)}>{item.decision}</span>
              </div>
            )) : <div className="empty">No runtime receipts yet.</div>}
          </div>
        </aside>
      </section>
    </main>
  );
}
