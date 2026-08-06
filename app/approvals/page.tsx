import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewApproval } from "./actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function tone(decision: string) {
  if (["succeeded", "approved", "consumed", "verified", "supported"].includes(decision)) return "pill success";
  if (["failed", "denied", "rejected", "revoked", "conflicting"].includes(decision)) return "pill blocked";
  return "pill";
}

export default async function ApprovalCenterPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");

  const [approvalResult, auditResult, evidenceResult] = await Promise.all([
    supabase.from("capability_approvals").select("id,capability_name,capability_version,status,preview,preview_hash,requested_by,decided_by,decided_at,decision_note,execution_error,created_at").eq("workspace_id", membership.workspace_id).order("created_at", { ascending: false }).limit(100),
    supabase.from("capability_audit_log").select("id,capability_name,capability_version,risk_class,decision,policy_id,error_code,error_message,evidence_ids,created_at").eq("workspace_id", membership.workspace_id).order("created_at", { ascending: false }).limit(150),
    supabase.from("evidence_records").select("id,evidence_type,source_type,source_url,summary,confidence,observed_at,captured_at,replaces_evidence_id,revoked_at,revocation_reason").eq("workspace_id", membership.workspace_id).order("captured_at", { ascending: false }).limit(60),
  ]);

  const approvals = approvalResult.data ?? [];
  const audits = auditResult.data ?? [];
  const evidence = evidenceResult.data ?? [];
  const pending = approvals.filter((item) => item.status === "pending");
  const successes = audits.filter((item) => item.decision === "succeeded");
  const canReview = membership.role === "admin" || membership.role === "owner";

  return <>
    <AppHeader />
    <main className="shell">
    <header className="app-page-heading"><div><div className="eyebrow">Workspace settings</div><h1>Approvals</h1><p>Review sensitive actions before ArtistOS carries them out and keep a clear history of your decisions.</p></div><Link className="button ghost" href="/settings">Back to settings</Link></header>
    {(approvalResult.error || auditResult.error || evidenceResult.error) ? <section className="notice" style={{ marginBottom: 16 }}>Approval history is temporarily unavailable. No action will run without its required review.</section> : null}
    <section className="grid stats" style={{ marginBottom: 16 }}><div className="card"><div className="eyebrow">Pending review</div><div className="stat-value">{pending.length}</div></div><div className="card"><div className="eyebrow">Successful actions</div><div className="stat-value">{successes.length}</div></div><div className="card"><div className="eyebrow">Evidence records</div><div className="stat-value">{evidence.length}</div></div><div className="card"><div className="eyebrow">Workspace role</div><div className="stat-value" style={{ fontSize: 24 }}>{membership.role}</div></div></section>
    <section className="grid two-col">
      <div className="stack">
        <div className="card"><div className="section-heading"><h2>Pending approvals</h2><span className="pill">{pending.length}</span></div>{pending.length ? pending.map((item) => <article className="row" key={item.id} style={{ alignItems: "flex-start" }}><div style={{ minWidth: 0, width: "100%" }}><strong>{item.capability_name}</strong><p className="muted">Requested {formatDate(item.created_at)}</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(item.preview, null, 2)}</pre>{canReview ? <form action={reviewApproval} className="stack" style={{ marginTop: 12 }}><input type="hidden" name="approvalId" value={item.id}/><input className="input" name="note" maxLength={1000} placeholder="Optional review note"/><div className="tag-row"><button className="button primary" type="submit" name="decision" value="approved">Approve and run</button><button className="button ghost" type="submit" name="decision" value="rejected">Reject</button></div></form> : <p className="muted">Admin or owner role required to review.</p>}</div><span className="pill">pending</span></article>) : <div className="empty">No protected actions are waiting for review.</div>}</div>
        <div className="card"><div className="section-heading"><h2>Supporting sources</h2><span className="pill">{evidence.length}</span></div>{evidence.length ? evidence.slice(0, 30).map((item) => <div className="row" key={item.id} style={{ alignItems: "flex-start" }}><div><strong>{item.evidence_type}</strong><p className="muted">{item.source_type} · captured {formatDate(item.captured_at)}</p><p>{item.summary}</p>{item.source_url ? <p><a href={item.source_url} target="_blank" rel="noreferrer">Open source</a></p> : null}{item.revocation_reason ? <p className="muted">Removed: {item.revocation_reason}</p> : null}</div><span className={tone(item.revoked_at ? "revoked" : item.confidence)}>{item.revoked_at ? "removed" : item.confidence}</span></div>) : <div className="empty">No supporting sources yet.</div>}</div>
      </div>
      <aside className="stack"><div className="card"><div className="section-heading"><h2>Recent actions</h2><span className="pill">{audits.length}</span></div>{audits.length ? audits.slice(0, 40).map((item) => <div className="row" key={item.id} style={{ alignItems: "flex-start" }}><div><strong>{item.capability_name}</strong><p className="muted">{item.risk_class} · {formatDate(item.created_at)}</p>{item.error_message ? <p className="muted">{item.error_message}</p> : null}</div><span className={tone(item.decision)}>{item.decision}</span></div>) : <div className="empty">No recorded actions yet.</div>}</div><div className="card"><div className="section-heading"><h2>Approval history</h2><span className="pill">{approvals.length}</span></div>{approvals.filter((item) => item.status !== "pending").slice(0, 30).map((item) => <div className="row" key={item.id}><div><strong>{item.capability_name}</strong><p className="muted">{item.decided_at ? formatDate(item.decided_at) : formatDate(item.created_at)}{item.decision_note ? ` · ${item.decision_note}` : ""}</p>{item.execution_error ? <p className="muted">{item.execution_error}</p> : null}</div><span className={tone(item.status)}>{item.status}</span></div>)}</div></aside>
    </section>
    </main>
  </>;
}
