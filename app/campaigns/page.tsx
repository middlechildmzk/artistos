import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function CampaignsPage() {
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

  const [{ data: campaigns }, { data: targets }, { data: interactions }, { data: outcomes }] = await Promise.all([
    supabase.from("campaigns").select("id, name, status, start_date, end_date, goals, release_id, releases(title, release_date)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("campaign_targets").select("id, campaign_id, target_kind, target_id, status, added_at").eq("workspace_id", workspaceId),
    supabase.from("interactions").select("id, campaign_id, organization_id, subject, channel, reply_status, occurred_at, follow_up_due, follow_up_done").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("outcomes").select("id, campaign_id, organization_id, outcome_type, outcome_date, confidence, url").eq("workspace_id", workspaceId).order("outcome_date", { ascending: false }).limit(100),
  ]);

  const campaignRows = campaigns ?? [];
  const targetRows = targets ?? [];
  const interactionRows = interactions ?? [];
  const outcomeRows = outcomes ?? [];
  const organizationIds = Array.from(new Set(targetRows.filter((target) => target.target_kind === "organization").map((target) => target.target_id)));
  const { data: organizations } = organizationIds.length
    ? await supabase.from("organizations").select("id, canonical_name, display_name, relationship_stage, risk_tier, trust_tier").eq("workspace_id", workspaceId).in("id", organizationIds)
    : { data: [] };
  const organizationById = new Map((organizations ?? []).map((organization) => [organization.id, organization]));

  const totals = {
    queued: targetRows.filter((target) => target.status === "queued").length,
    pitched: targetRows.filter((target) => target.status === "pitched").length,
    replied: targetRows.filter((target) => target.status === "replied").length,
    won: targetRows.filter((target) => target.status === "accepted" || target.status === "placed").length,
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div><div className="eyebrow">Release growth engine</div><h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Campaigns</h1><p className="muted">One pipeline from target qualification through outreach, reply, placement, and evidence-backed outcomes.</p></div>
        <nav className="nav-links"><Link className="button ghost" href="/dashboard">Today</Link><Link className="button ghost" href="/targets">Targets</Link><Link className="button ghost" href="/audience">Audience</Link></nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Queued</div><div className="stat-value">{totals.queued}</div></div>
        <div className="card"><div className="eyebrow">Pitched</div><div className="stat-value">{totals.pitched}</div></div>
        <div className="card"><div className="eyebrow">Replies</div><div className="stat-value">{totals.replied}</div></div>
        <div className="card"><div className="eyebrow">Accepted / placed</div><div className="stat-value">{totals.won}</div></div>
      </section>

      <section className="stack">
        {campaignRows.length ? campaignRows.map((campaign) => {
          const campaignTargets = targetRows.filter((target) => target.campaign_id === campaign.id);
          const campaignInteractions = interactionRows.filter((interaction) => interaction.campaign_id === campaign.id);
          const campaignOutcomes = outcomeRows.filter((outcome) => outcome.campaign_id === campaign.id);
          const releaseRelation = Array.isArray(campaign.releases) ? campaign.releases[0] : campaign.releases;
          return (
            <article className="card" key={campaign.id}>
              <div className="section-heading campaign-heading">
                <div><div className="eyebrow">{releaseRelation?.title || "Release campaign"}</div><h2>{campaign.name}</h2><p className="muted">{campaign.start_date ? formatDate(campaign.start_date) : "Start date open"}{campaign.end_date ? ` → ${formatDate(campaign.end_date)}` : ""}</p></div>
                <div className="tag-row"><span className="pill">{campaign.status}</span><span className="pill">{campaignTargets.length} targets</span><span className="pill">{campaignInteractions.length} touches</span><span className="pill">{campaignOutcomes.length} outcomes</span></div>
              </div>
              {campaign.goals ? <p>{campaign.goals}</p> : null}

              <div className="pipeline-grid">
                {["queued", "pitched", "replied", "accepted", "declined", "placed"].map((stage) => {
                  const stageTargets = campaignTargets.filter((target) => target.status === stage);
                  return <div className="pipeline-column" key={stage}><div className="section-heading tight"><strong>{stage}</strong><span className="pill">{stageTargets.length}</span></div>{stageTargets.length ? stageTargets.map((target) => { const organization = organizationById.get(target.target_id); return <Link className="pipeline-card" href={target.target_kind === "organization" ? `/targets/${target.target_id}` : "/targets"} key={target.id}><strong>{organization?.display_name || organization?.canonical_name || `${target.target_kind} target`}</strong><span className="muted">Added {formatDate(target.added_at)}</span>{organization ? <span className="muted">Trust {organization.trust_tier || "unknown"} · Risk {organization.risk_tier || "unknown"}</span> : null}</Link>; }) : <div className="empty small">No targets</div>}</div>;
                })}
              </div>

              {campaignInteractions.length || campaignOutcomes.length ? <div className="grid two-col campaign-foot">
                <div><h3>Recent activity</h3>{campaignInteractions.slice(0, 5).map((interaction) => <div className="row" key={interaction.id}><div><strong>{interaction.subject || "Outreach"}</strong><p className="muted">{interaction.channel || "channel"} · {formatDate(interaction.occurred_at)}</p></div><span className="pill">{interaction.reply_status || "none"}</span></div>)}</div>
                <div><h3>Recorded outcomes</h3>{campaignOutcomes.length ? campaignOutcomes.slice(0, 5).map((outcome) => <div className="row" key={outcome.id}><div><strong>{outcome.outcome_type}</strong><p className="muted">{formatDate(outcome.outcome_date)} · {outcome.confidence || "unknown confidence"}</p></div>{outcome.url ? <a className="button ghost" href={outcome.url} target="_blank" rel="noreferrer">Evidence</a> : null}</div>) : <div className="empty">No outcomes recorded yet.</div>}</div>
              </div> : null}
            </article>
          );
        }) : <section className="card"><h2>No campaign exists yet</h2><p className="muted">Create a release campaign to start moving qualified targets through outreach and outcome tracking.</p></section>}
      </section>
    </main>
  );
}
