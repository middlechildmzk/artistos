import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addOrganizationToCampaign, logOutreach, updateRelationship } from "./actions";

function display(value: string | null | undefined, fallback = "Not recorded") {
  return value?.trim() || fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function TargetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const [organizationResult, campaignsResult, peopleResult, propertiesResult, endpointsResult, signalsResult, risksResult, interactionsResult, campaignTargetsResult] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("campaigns").select("id, name, status, release_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("people").select("id, full_name, role, email, email_status, linkedin_url, relationship_stage, verification_status").eq("workspace_id", workspaceId).eq("organization_id", id).is("archived_at", null).limit(25),
    supabase.from("properties").select("id, name, property_type, platform, url, genre_tags, followers_estimate, verification_status, relationship_stage").eq("workspace_id", workspaceId).eq("organization_id", id).is("archived_at", null).limit(25),
    supabase.from("submission_endpoints").select("id, endpoint_type, submission_url, submission_email, submission_status, free_or_paid, price_or_fee, accepts_unreleased, typical_turnaround, verification_status").eq("workspace_id", workspaceId).eq("organization_id", id).limit(20),
    supabase.from("relationship_signals").select("id, signal, relationship_status, interaction_date, evidence_summary, source").eq("workspace_id", workspaceId).eq("organization_id", id).order("interaction_date", { ascending: false }).limit(10),
    supabase.from("risk_events").select("id, event_type, event_date, measured_outcome, evidence, url, risk_classification").eq("workspace_id", workspaceId).eq("organization_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("interactions").select("id, campaign_id, channel, subject, body, occurred_at, reply_status, follow_up_due, follow_up_done, asset_link").eq("workspace_id", workspaceId).eq("organization_id", id).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("campaign_targets").select("id, campaign_id, status, notes, added_at").eq("workspace_id", workspaceId).eq("target_kind", "organization").eq("target_id", id),
  ]);

  const organization = organizationResult.data;
  if (!organization) notFound();

  const campaigns = campaignsResult.data ?? [];
  const people = peopleResult.data ?? [];
  const properties = propertiesResult.data ?? [];
  const endpoints = endpointsResult.data ?? [];
  const signals = signalsResult.data ?? [];
  const risks = risksResult.data ?? [];
  const interactions = interactionsResult.data ?? [];
  const campaignTargets = campaignTargetsResult.data ?? [];
  const campaignNameById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Target intelligence workspace</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>{organization.display_name || organization.canonical_name}</h1>
          <p className="muted">{display(organization.org_type, "Industry target")}{organization.location ? ` · ${organization.location}` : ""}</p>
        </div>
        <nav className="nav-links"><Link className="button ghost" href="/targets">All targets</Link><Link className="button ghost" href="/campaigns">Campaigns</Link><Link className="button ghost" href="/dashboard">Today</Link></nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Relationship</div><div className="stat-value compact">{display(organization.relationship_stage, "identified")}</div></div>
        <div className="card"><div className="eyebrow">Trust</div><div className="stat-value compact">{display(organization.trust_tier)}</div></div>
        <div className="card"><div className="eyebrow">Risk</div><div className="stat-value compact">{display(organization.risk_tier)}</div></div>
        <div className="card"><div className="eyebrow">Evidence</div><div className="stat-value compact">{organization.evidence_strength ?? 1}/5</div></div>
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <div className="stack">
          <section className="card release-card">
            <div className="section-heading"><div><div className="eyebrow">Next best action</div><h2>{display(organization.next_action, "Qualify this target")}</h2></div>{organization.next_action_due ? <span className="pill">Due {formatDate(organization.next_action_due)}</span> : null}</div>
            <p className="muted">{display(organization.notes, "No workspace notes have been added yet.")}</p>
            <div className="tag-row">
              <span className="pill">{display(organization.verification_status, "unverified")}</span>
              <span className="pill">Activity: {display(organization.activity_status)}</span>
              {organization.website ? <a className="button" href={organization.website} target="_blank" rel="noreferrer">Open website</a> : null}
              {organization.primary_source_url ? <a className="button ghost" href={organization.primary_source_url} target="_blank" rel="noreferrer">View source</a> : null}
            </div>
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Campaign assignment</h2><p className="muted">Queue this organization inside an active release campaign.</p></div><span className="pill">{campaignTargets.length} assigned</span></div>
            <form action={addOrganizationToCampaign} className="form-grid">
              <input type="hidden" name="organizationId" value={organization.id} />
              <label className="field"><span>Campaign</span><select className="input" name="campaignId" required defaultValue=""><option value="" disabled>Select campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.status}</option>)}</select></label>
              <button className="button primary align-end" type="submit">Add to campaign</button>
            </form>
            {campaignTargets.length ? <div className="stack compact-stack">{campaignTargets.map((target) => <div className="row" key={target.id}><div><strong>{campaignNameById.get(target.campaign_id) || "Campaign"}</strong><p className="muted">Added {formatDate(target.added_at)}</p></div><span className="pill">{target.status}</span></div>)}</div> : <div className="empty">Not assigned to a campaign yet.</div>}
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Log outreach</h2><p className="muted">Record what was sent and automatically create the follow-up.</p></div><span className="pill">Workspace-scoped</span></div>
            <form action={logOutreach} className="stack">
              <input type="hidden" name="organizationId" value={organization.id} />
              <div className="form-grid two">
                <label className="field"><span>Campaign</span><select className="input" name="campaignId" defaultValue=""><option value="">No campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
                <label className="field"><span>Submission route</span><select className="input" name="endpointId" defaultValue=""><option value="">General outreach</option>{endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{display(endpoint.endpoint_type, endpoint.submission_email || "Saved endpoint")}</option>)}</select></label>
                <label className="field"><span>Channel</span><select className="input" name="channel" defaultValue="email"><option value="email">Email</option><option value="submission_form">Submission form</option><option value="instagram">Instagram</option><option value="x">X / Twitter</option><option value="linkedin">LinkedIn</option><option value="other">Other</option></select></label>
                <label className="field"><span>Follow-up due</span><input className="input" type="date" name="followUpDue" /></label>
              </div>
              <label className="field"><span>Subject or outreach label</span><input className="input" name="subject" required placeholder="Never Alone submission" /></label>
              <label className="field"><span>Message sent</span><textarea className="input textarea" name="body" placeholder="Paste the final pitch or note what was submitted." /></label>
              <label className="field"><span>Asset or smart-link URL</span><input className="input" type="url" name="assetLink" placeholder="https://" /></label>
              <button className="button primary" type="submit">Record outreach and schedule follow-up</button>
            </form>
          </section>

          <section className="card">
            <div className="section-heading"><div><h2>Interaction history</h2><p className="muted">A durable timeline of pitches, replies, and follow-ups.</p></div><span className="pill">{interactions.length} records</span></div>
            {interactions.length ? interactions.map((interaction) => <article className="timeline-item" key={interaction.id}><div className="timeline-dot" /><div><div className="section-heading tight"><strong>{display(interaction.subject, "Outreach")}</strong><span className="pill">{display(interaction.reply_status, "none")}</span></div><p className="muted">{display(interaction.channel, "channel")} · {formatDate(interaction.occurred_at)}{interaction.follow_up_due ? ` · follow up ${formatDate(interaction.follow_up_due)}` : ""}</p>{interaction.body ? <p>{interaction.body}</p> : null}{interaction.asset_link ? <a href={interaction.asset_link} target="_blank" rel="noreferrer">Open attached link</a> : null}</div></article>) : <div className="empty">No outreach has been recorded for this target.</div>}
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            <h2>Relationship control</h2>
            <form action={updateRelationship} className="stack">
              <input type="hidden" name="organizationId" value={organization.id} />
              <label className="field"><span>Stage</span><select className="input" name="relationshipStage" defaultValue={organization.relationship_stage || "identified"}>{["identified", "qualified", "pitched", "replied", "negotiating", "placed", "declined", "dormant"].map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label>
              <label className="field"><span>Next action</span><input className="input" name="nextAction" defaultValue={organization.next_action || ""} /></label>
              <label className="field"><span>Due date</span><input className="input" type="date" name="nextActionDue" defaultValue={organization.next_action_due || ""} /></label>
              <button className="button" type="submit">Update relationship</button>
            </form>
          </section>

          <section className="card"><div className="section-heading"><h2>Submission routes</h2><span className="pill">{endpoints.length}</span></div>{endpoints.length ? endpoints.map((endpoint) => <div className="row" key={endpoint.id}><div><strong>{display(endpoint.endpoint_type, "Submission")}</strong><p className="muted">{endpoint.submission_email || endpoint.submission_url || "Route saved"}</p><div className="tag-row"><span className="pill">{display(endpoint.free_or_paid)}</span><span className="pill">{display(endpoint.verification_status)}</span>{endpoint.accepts_unreleased === true ? <span className="pill">Accepts unreleased</span> : null}</div></div>{endpoint.submission_url ? <a className="button" href={endpoint.submission_url} target="_blank" rel="noreferrer">Open</a> : endpoint.submission_email ? <a className="button" href={`mailto:${endpoint.submission_email}`}>Email</a> : null}</div>) : <div className="empty">No verified submission route saved.</div>}</section>

          <section className="card"><div className="section-heading"><h2>People</h2><span className="pill">{people.length}</span></div>{people.length ? people.slice(0, 8).map((person) => <div className="row" key={person.id}><div><strong>{display(person.full_name, "Unnamed contact")}</strong><p className="muted">{display(person.role, "Contact")}{person.email ? ` · ${person.email}` : ""}</p></div>{person.linkedin_url ? <a className="button ghost" href={person.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a> : null}</div>) : <div className="empty">No contacts linked.</div>}</section>

          <section className="card"><div className="section-heading"><h2>Properties</h2><span className="pill">{properties.length}</span></div>{properties.length ? properties.slice(0, 8).map((property) => <div className="row" key={property.id}><div><strong>{property.name}</strong><p className="muted">{display(property.property_type, property.platform || "Property")}{property.followers_estimate ? ` · ${property.followers_estimate} followers` : ""}</p></div>{property.url ? <a className="button ghost" href={property.url} target="_blank" rel="noreferrer">Open</a> : null}</div>) : <div className="empty">No playlists, channels, or properties linked.</div>}</section>

          <section className="card"><div className="section-heading"><h2>Relationship evidence</h2><span className="pill">{signals.length}</span></div>{signals.length ? signals.map((signal) => <div className="row" key={signal.id}><div><strong>{display(signal.signal, "Signal")}</strong><p className="muted">{display(signal.evidence_summary)}{signal.interaction_date ? ` · ${formatDate(signal.interaction_date)}` : ""}</p></div></div>) : <div className="empty">No prior relationship evidence found.</div>}</section>

          <section className="card"><div className="section-heading"><h2>Risk evidence</h2><span className={`pill ${risks.length ? "blocked" : ""}`}>{risks.length}</span></div>{risks.length ? risks.map((risk) => <div className="row" key={risk.id}><div><strong>{display(risk.risk_classification, risk.event_type || "Risk signal")}</strong><p className="muted">{display(risk.evidence, risk.measured_outcome || "Evidence recorded")}</p></div>{risk.url ? <a className="button ghost" href={risk.url} target="_blank" rel="noreferrer">Source</a> : null}</div>) : <div className="empty">No risk events recorded.</div>}</section>
        </aside>
      </section>
    </main>
  );
}
