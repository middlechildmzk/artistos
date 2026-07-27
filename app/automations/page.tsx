import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/application/workspace-context";
import { addAutomation } from "../intelligence/actions";

export default async function AutomationsPage() {
  let context: Awaited<ReturnType<typeof getWorkspaceContext>>;

  try {
    context = await getWorkspaceContext();
  } catch {
    redirect("/login");
  }

  const { supabase, workspaceId } = context;
  const { data: rules, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Workflow planning</div>
          <h1>Planned automations</h1>
          <p className="muted">
            Design repeatable workflows here. These rules are stored as plans only and do not run automatically yet.
          </p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/command-center">Command</Link>
          <Link className="button ghost" href="/studio">Studio</Link>
          <Link className="button ghost" href="/analytics">Analytics</Link>
        </nav>
      </header>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="eyebrow">Execution status</div>
        <h2>Planning mode</h2>
        <p className="muted">
          ArtistOS will not claim that a trigger fired or an action completed until the durable evaluator, evidence receipts,
          and execution policies are connected. Saving a rule below only preserves the intended workflow.
        </p>
      </section>

      <section className="grid two-col">
        <div className="stack">
          <div className="card">
            <h2>Saved plans</h2>
            {(rules ?? []).length ? (
              (rules ?? []).map((rule) => (
                <div className="row" key={rule.id}>
                  <div>
                    <div className="tag-row">
                      <span className="pill">{rule.trigger_type}</span>
                      <span className="pill">{rule.action_type}</span>
                      <span className="pill">Not running</span>
                    </div>
                    <strong>{rule.name}</strong>
                    <p className="muted">
                      When: {rule.trigger_config?.detail || rule.trigger_type}
                      <br />
                      Then: {rule.action_config?.detail || rule.action_type}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">No planned automation rules yet.</div>
            )}
          </div>

          <div className="card">
            <h2>Recommended recipes</h2>
            <div className="row">
              <div>
                <strong>Reply creates follow-up</strong>
                <p className="muted">When a curator replies, create a response task and move the target to replied.</p>
              </div>
              <span className="pill">CRM</span>
            </div>
            <div className="row">
              <div>
                <strong>Release-day checklist</strong>
                <p className="muted">When release day arrives, surface distribution, social, email, and monitoring tasks.</p>
              </div>
              <span className="pill">Release</span>
            </div>
            <div className="row">
              <div>
                <strong>Placement amplification</strong>
                <p className="muted">When an outcome is accepted or placed, create a thank-you and share workflow.</p>
              </div>
              <span className="pill">Growth</span>
            </div>
          </div>
        </div>

        <form action={addAutomation} className="card stack">
          <h2>Design a workflow</h2>
          <label className="field">
            <span>Name</span>
            <input className="input" name="name" required placeholder="Release-day launch checklist" />
          </label>
          <label className="field">
            <span>Trigger</span>
            <select className="input" name="triggerType">
              <option value="release_date">Release date</option>
              <option value="reply_received">Reply received</option>
              <option value="outcome_recorded">Outcome recorded</option>
              <option value="follow_up_due">Follow-up due</option>
              <option value="metric_threshold">Metric threshold</option>
              <option value="content_published">Content published</option>
            </select>
          </label>
          <label className="field">
            <span>Trigger detail</span>
            <textarea className="input textarea" name="triggerDetail" />
          </label>
          <label className="field">
            <span>Action</span>
            <select className="input" name="actionType">
              <option value="create_task">Create task</option>
              <option value="create_recommendation">Create recommendation</option>
              <option value="update_relationship">Update relationship</option>
              <option value="create_content_idea">Create content idea</option>
              <option value="notify_owner">Notify owner</option>
            </select>
          </label>
          <label className="field">
            <span>Action detail</span>
            <textarea className="input textarea" name="actionDetail" />
          </label>
          <button className="button primary" type="submit">Save workflow plan</button>
        </form>
      </section>
    </main>
  );
}
