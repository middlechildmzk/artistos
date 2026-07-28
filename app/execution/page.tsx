import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveAgentRun, createAgentRun, materializeAgentRun, reviewArtifact } from "./actions";

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function ExecutionPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", auth.user.id).limit(1).single();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [workspaceResult, requestsResult, runsResult, stepsResult, artifactsResult] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
    supabase.from("manager_requests").select("id,request_text,status,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    supabase.from("agent_runs").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    supabase.from("agent_run_steps").select("*").eq("workspace_id", workspaceId).order("sort_order"),
    supabase.from("agent_artifacts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(40),
  ]);

  const requests = requestsResult.data ?? [];
  const runs = runsResult.data ?? [];
  const steps = stepsResult.data ?? [];
  const artifacts = artifactsResult.data ?? [];

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><div className="logo">A</div><div><div className="eyebrow">{workspaceResult.data?.name ?? "ArtistOS"}</div><strong>Agent Control Plane</strong></div></div>
      <div className="nav-links"><Link className="button ghost" href="/dashboard">Today</Link><Link className="button ghost" href="/operating-center">AI Manager</Link><Link className="button ghost" href="/automations">Automations</Link></div>
    </header>

    <section className="card release-card stack" style={{ marginBottom: 16 }}>
      <div className="eyebrow">Controlled execution</div>
      <h1>Approve the plan before ArtistOS creates work.</h1>
      <p className="muted">Every run is auditable. No background action is treated as complete until its approved steps produce reviewable tasks, content ideas, recommendations, or insights.</p>
      <form action={createAgentRun} className="row">
        <select name="managerRequestId" required defaultValue=""><option value="" disabled>Select a Manager plan</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.request_text}</option>)}</select>
        <button className="button primary" type="submit">Prepare agent run</button>
      </form>
    </section>

    <section className="grid stats" style={{ marginBottom: 16 }}>
      <div className="card"><div className="eyebrow">Runs</div><div className="stat-value">{runs.length}</div></div>
      <div className="card"><div className="eyebrow">Awaiting approval</div><div className="stat-value">{runs.filter((run) => run.status === "awaiting_approval").length}</div></div>
      <div className="card"><div className="eyebrow">Completed outputs</div><div className="stat-value">{artifacts.length}</div></div>
      <div className="card"><div className="eyebrow">Review queue</div><div className="stat-value">{artifacts.filter((artifact) => artifact.approval_state === "review").length}</div></div>
    </section>

    <section className="grid two-col">
      <div className="stack">
        <div className="card stack"><div><div className="eyebrow">Execution runs</div><h2>Approval and materialization</h2></div>
          {runs.length ? runs.map((run) => {
            const runSteps = steps.filter((step) => step.agent_run_id === run.id);
            return <div className="notice stack" key={run.id}>
              <div className="row"><div><strong>{run.title}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{formatDate(run.created_at)} · {runSteps.length} steps</p></div><span className="pill">{run.status}</span></div>
              {runSteps.map((step) => <div className="row" key={step.id}><div><span className="eyebrow">{step.department}</span><p style={{ margin: "4px 0" }}>{step.instruction}</p></div><span className="pill">{step.status}</span></div>)}
              {run.result_summary ? <p className="muted">{run.result_summary}</p> : null}
              <div className="tag-row">
                {run.status === "awaiting_approval" ? <form action={approveAgentRun}><input type="hidden" name="runId" value={run.id}/><button className="button primary" type="submit">Approve run</button></form> : null}
                {run.status === "approved" ? <form action={materializeAgentRun}><input type="hidden" name="runId" value={run.id}/><button className="button primary" type="submit">Create reviewable work</button></form> : null}
              </div>
            </div>;
          }) : <div className="empty">Create a Manager plan first, then prepare its first agent run.</div>}
        </div>
      </div>

      <aside className="stack">
        <div className="card stack"><div><div className="eyebrow">Artifact review</div><h2>Human checkpoint</h2></div>
          {artifacts.length ? artifacts.map((artifact) => <div className="notice stack" key={artifact.id}>
            <div className="row"><div><strong>{artifact.title}</strong><p className="muted" style={{ margin: "5px 0 0" }}>{artifact.artifact_type} · {formatDate(artifact.created_at)}</p></div><span className="pill">{artifact.approval_state}</span></div>
            {artifact.body ? <p>{artifact.body}</p> : null}
            <form action={reviewArtifact} className="row"><input type="hidden" name="artifactId" value={artifact.id}/><select name="approvalState" defaultValue={artifact.approval_state}><option value="review">Needs review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="button" type="submit">Save review</button></form>
          </div>) : <div className="empty">Approved agent runs will create artifacts here.</div>}
        </div>
      </aside>
    </section>
  </main>;
}
