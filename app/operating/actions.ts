"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .limit(1)
    .single();
  if (!membership) throw new Error("Workspace membership required");
  return { supabase, workspaceId: membership.workspace_id };
}

export async function addBrainFact(formData: FormData) {
  const { supabase, workspaceId } = await context();
  const fact = String(formData.get("fact") ?? "").trim();
  if (!fact) return;
  await supabase.from("artist_brain_facts").insert({
    workspace_id: workspaceId,
    artist_id: String(formData.get("artistId") || "") || null,
    release_id: String(formData.get("releaseId") || "") || null,
    category: String(formData.get("category") || "identity"),
    confidence: String(formData.get("confidence") || "verified"),
    source: String(formData.get("source") || "") || null,
    freshness_date: new Date().toISOString().slice(0, 10),
    fact,
  });
  revalidatePath("/operating");
}

function buildPlan(request: string) {
  const q = request.toLowerCase();
  const steps: Array<{ department: string; action: string }> = [];
  if (/release|launch|song|single/.test(q)) steps.push({ department: "Release", action: "Audit readiness, deadlines, metadata, assets, and unresolved blockers." });
  if (/promot|playlist|blog|radio|creator|influencer/.test(q)) steps.push({ department: "Promotion", action: "Rank verified targets, segment outreach lanes, and prepare the highest-fit queue." });
  if (/content|video|reel|tiktok|post|social/.test(q)) steps.push({ department: "Content", action: "Create platform-specific hooks, concepts, repurposing paths, and publishing tasks." });
  if (/fan|email|audience|newsletter/.test(q)) steps.push({ department: "Audience", action: "Segment contactable supporters and define the safest high-intent activation." });
  if (/metric|stream|analytic|performance|result/.test(q)) steps.push({ department: "Analytics", action: "Review available evidence, identify gaps, and generate decision-oriented insights." });
  if (/sync|license|film|tv|game/.test(q)) steps.push({ department: "Sync", action: "Confirm rights readiness and prepare matching, one-sheet, and clearance tasks." });
  if (!steps.length) steps.push({ department: "Manager", action: "Clarify the desired outcome, inspect current workspace state, and coordinate the relevant departments." });
  steps.push({ department: "Manager", action: "Convert approved actions into tracked tasks, recommendations, and follow-ups." });
  return steps;
}

export async function createManagerRequest(formData: FormData) {
  const { supabase, workspaceId } = await context();
  const requestText = String(formData.get("requestText") ?? "").trim();
  if (!requestText) return;
  const plan = buildPlan(requestText);
  await supabase.from("manager_requests").insert({
    workspace_id: workspaceId,
    release_id: String(formData.get("releaseId") || "") || null,
    request_text: requestText,
    intent: plan[0]?.department.toLowerCase() || "general",
    status: "planned",
    plan,
  });
  revalidatePath("/operating");
}

export async function updateManagerRequest(formData: FormData) {
  const { supabase } = await context();
  await supabase.from("manager_requests").update({
    status: String(formData.get("status") || "planned"),
    updated_at: new Date().toISOString(),
  }).eq("id", String(formData.get("requestId")));
  revalidatePath("/operating");
}

export async function generateReleaseTimeline(formData: FormData) {
  const { supabase, workspaceId } = await context();
  const releaseId = String(formData.get("releaseId") || "");
  const releaseDate = String(formData.get("releaseDate") || "");
  if (!releaseId || !releaseDate) return;
  const templates = [
    [-120, "Foundation", "Confirm release strategy and rights"],
    [-90, "Foundation", "Lock master, artwork direction, and metadata"],
    [-60, "Distribution", "Deliver release and platform assets"],
    [-45, "Promotion", "Build target lists and campaign lanes"],
    [-30, "Audience", "Launch pre-save and supporter reactivation"],
    [-21, "Content", "Begin teaser publishing cadence"],
    [-14, "Promotion", "Start priority curator and creator outreach"],
    [-7, "Readiness", "Complete release-week readiness audit"],
    [-3, "Content", "Publish final pre-release story and reminders"],
    [0, "Release Day", "Execute release-day command checklist"],
    [1, "Follow-through", "Review first-day signals and replies"],
    [7, "Optimization", "Double down on winning content and outreach lanes"],
    [30, "Long Tail", "Complete release retrospective and evergreen plan"],
  ];
  const base = new Date(`${releaseDate}T12:00:00Z`);
  const rows = templates.map(([offset, phase, title]) => {
    const due = new Date(base);
    due.setUTCDate(due.getUTCDate() + Number(offset));
    return { workspace_id: workspaceId, release_id: releaseId, phase, title, offset_days: offset, due_date: due.toISOString().slice(0, 10) };
  });
  await supabase.from("release_milestones").upsert(rows, { onConflict: "release_id,title" });
  revalidatePath("/operating");
}

export async function scorePromotionOpportunities(formData: FormData) {
  const { supabase, workspaceId } = await context();
  const releaseId = String(formData.get("releaseId") || "") || null;
  const { data: orgs } = await supabase.from("organizations")
    .select("id, org_type, trust_tier, risk_tier, evidence_strength, verification_status, relationship_stage, activity_status")
    .eq("workspace_id", workspaceId).limit(250);
  const rows = (orgs ?? []).map((org) => {
    const fit = ["playlist", "blog", "radio", "creator", "media", "label"].some((x) => String(org.org_type || "").toLowerCase().includes(x)) ? 80 : 55;
    const trust = org.verification_status === "verified" ? 90 : org.evidence_strength && org.evidence_strength >= 3 ? 75 : 45;
    const relationship = org.relationship_stage === "placed" ? 95 : org.relationship_stage === "replied" ? 80 : org.relationship_stage === "pitched" ? 60 : 35;
    const timing = org.activity_status === "active" ? 85 : org.activity_status === "inactive" ? 20 : 55;
    const riskPenalty = ["high", "avoid"].includes(String(org.risk_tier || "").toLowerCase()) ? 25 : 0;
    const total = Math.max(0, Math.min(100, Math.round(fit * .35 + trust * .3 + relationship * .2 + timing * .15 - riskPenalty)));
    return { workspace_id: workspaceId, release_id: releaseId, target_kind: "organization", target_id: org.id, fit_score: fit, trust_score: trust, relationship_score: relationship, timing_score: timing, total_score: total, rationale: "Weighted fit, trust, relationship history, activity, and risk." };
  });
  if (rows.length) await supabase.from("opportunity_scores").upsert(rows, { onConflict: "workspace_id,release_id,target_kind,target_id" });
  revalidatePath("/operating");
}

export async function createAnalyticsInsight(formData: FormData) {
  const { supabase, workspaceId } = await context();
  const title = String(formData.get("title") ?? "").trim();
  const narrative = String(formData.get("narrative") ?? "").trim();
  if (!title || !narrative) return;
  await supabase.from("analytics_insights").insert({
    workspace_id: workspaceId,
    release_id: String(formData.get("releaseId") || "") || null,
    insight_type: String(formData.get("insightType") || "performance"),
    title,
    narrative,
    confidence: Number(formData.get("confidence") || 0.7),
  });
  revalidatePath("/operating");
}
