import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMemory, reviewClaim } from "./actions";

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function tone(value: string) {
  if (["verified","accepted","current","none"].includes(value)) return "pill success";
  if (["conflicting","rejected","stale","confirmed"].includes(value)) return "pill blocked";
  return "pill";
}

export default async function BrainPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const [memoryResult, claimResult, artistResult, evidenceResult, learningResult] = await Promise.all([
    supabase.from("brain_memories").select("id,memory_class,namespace,title,summary,source_kind,confidence,freshness_status,observed_at,created_at,revoked_at").eq("workspace_id", membership.workspace_id).order("created_at", { ascending: false }).limit(100),
    supabase.from("brain_claims").select("id,memory_id,claim_type,predicate,object_value,confidence,contradiction_state,review_status,review_note,created_at").eq("workspace_id", membership.workspace_id).order("created_at", { ascending: false }).limit(100),
    supabase.from("artists").select("id,name").eq("workspace_id", membership.workspace_id).order("name"),
    supabase.from("evidence_records").select("id,summary,confidence").eq("workspace_id", membership.workspace_id).is("revoked_at", null).order("captured_at", { ascending: false }).limit(30),
    supabase.from("brain_learning_observations").select("id,metric_key,sample_size,metric_value,baseline_value,effect_size,confidence,observed_until").eq("workspace_id", membership.workspace_id).order("created_at", { ascending: false }).limit(30),
  ]);
  const memories = memoryResult.data ?? [];
  const claims = claimResult.data ?? [];
  const artists = artistResult.data ?? [];
  const evidence = evidenceResult.data ?? [];
  const learning = learningResult.data ?? [];
  const pending = claims.filter((claim) => claim.review_status === "pending" || claim.review_status === "needs_evidence");
  const canReview = ["editor","admin","owner"].includes(membership.role);

  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="logo">A</div><div><div className="eyebrow">Memory and learning</div><strong>Artist Brain</strong></div></div><div className="nav-links"><Link className="button ghost" href="/dashboard">Dashboard</Link><Link className="button ghost" href="/approvals">Approvals</Link><Link className="button ghost" href="/analytics">Analytics</Link></div></header>
    <section className="card release-card" style={{ marginBottom: 16 }}><div className="eyebrow">Artist Brain v2</div><h1>Facts, experiences, and learned insights with evidence</h1><p className="muted">ArtistOS separates accepted facts from inference, weak signals, stale data, and contradictions. Nothing becomes trusted memory without visible provenance and review state.</p></section>
    {(memoryResult.error || claimResult.error || learningResult.error) ? <section className="notice" style={{ marginBottom: 16 }}>Artist Brain tables are not available in this environment yet. Replay the source-controlled migration before production use.</section> : null}
    <section className="grid stats" style={{ marginBottom: 16 }}><div className="card"><div className="eyebrow">Memories</div><div className="stat-value">{memories.length}</div></div><div className="card"><div className="eyebrow">Claims to review</div><div className="stat-value">{pending.length}</div></div><div className="card"><div className="eyebrow">Evidence sources</div><div className="stat-value">{evidence.length}</div></div><div className="card"><div className="eyebrow">Learning observations</div><div className="stat-value">{learning.length}</div></div></section>
    <section className="grid two-col">
      <div className="stack">
        <div className="card"><h2>Add trusted memory</h2><form action={createMemory} className="stack"><select className="input" name="artistId"><option value="">Workspace-wide</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select><select className="input" name="memoryClass"><option value="semantic">Semantic fact</option><option value="episodic">Episodic event</option><option value="learned">Learned insight</option></select><input className="input" name="namespace" placeholder="Namespace, e.g. brand.voice" required/><input className="input" name="title" placeholder="Memory title" required/><textarea className="input" name="summary" placeholder="What should ArtistOS remember?" rows={4}/><input className="input" name="value" placeholder="Structured value or concise statement"/><select className="input" name="confidence"><option value="verified">Verified fact</option><option value="supported">Supported</option><option value="weak">Weak signal</option><option value="unknown">Unknown</option><option value="conflicting">Conflicting</option></select><input className="input" name="evidenceIds" placeholder="Optional evidence UUIDs, comma-separated"/><button className="button primary" type="submit">Save to Artist Brain</button></form></div>
        <div className="card"><div className="section-heading"><h2>Memory library</h2><span className="pill">{memories.length}</span></div>{memories.length ? memories.map((memory) => <div className="row" key={memory.id} style={{ alignItems: "flex-start" }}><div><strong>{memory.title}</strong><p className="muted">{memory.memory_class} · {memory.namespace} · {memory.source_kind}</p>{memory.summary ? <p>{memory.summary}</p> : null}<p className="muted">Observed {formatDate(memory.observed_at)} · saved {formatDate(memory.created_at)}</p></div><div className="tag-row"><span className={tone(memory.confidence)}>{memory.confidence}</span><span className={tone(memory.freshness_status)}>{memory.freshness_status}</span></div></div>) : <div className="empty">No memories yet.</div>}</div>
      </div>
      <aside className="stack">
        <div className="card"><div className="section-heading"><h2>Claim review</h2><span className="pill">{pending.length}</span></div>{pending.length ? pending.map((claim) => <div className="row" key={claim.id} style={{ alignItems: "flex-start" }}><div style={{ width: "100%" }}><strong>{claim.predicate}</strong><pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(claim.object_value, null, 2)}</pre><div className="tag-row"><span className={tone(claim.confidence)}>{claim.confidence}</span><span className={tone(claim.contradiction_state)}>{claim.contradiction_state}</span></div>{canReview ? <form action={reviewClaim} className="stack" style={{ marginTop: 10 }}><input type="hidden" name="claimId" value={claim.id}/><input className="input" name="reviewNote" placeholder="Review note"/><div className="tag-row"><button className="button primary" name="reviewStatus" value="accepted">Accept</button><button className="button ghost" name="reviewStatus" value="needs_evidence">Need evidence</button><button className="button ghost" name="reviewStatus" value="rejected">Reject</button></div></form> : null}</div></div>) : <div className="empty">No claims waiting for review.</div>}</div>
        <div className="card"><div className="section-heading"><h2>Learning observations</h2><span className="pill">{learning.length}</span></div>{learning.length ? learning.map((item) => <div className="row" key={item.id}><div><strong>{item.metric_key}</strong><p className="muted">n={item.sample_size} · value {item.metric_value ?? "—"} · baseline {item.baseline_value ?? "—"}</p><p className="muted">Through {formatDate(item.observed_until)}</p></div><span className={tone(item.confidence)}>{item.confidence}</span></div>) : <div className="empty">No measured learning observations yet.</div>}</div>
      </aside>
    </section>
  </main>;
}