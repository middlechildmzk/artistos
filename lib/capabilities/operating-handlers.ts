import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import {
  addLegacyBrainFactCapability,
  createAnalyticsInsightCapability,
  createManagerRequestCapability,
  generateReleaseTimelineCapability,
  scorePromotionOpportunitiesCapability,
  updateManagerRequestCapability,
} from "./operating-registry";

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", capabilityName)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: {
  workspaceId: string;
  capabilityName: string;
  capabilityVersion: number;
  key: string;
  result: unknown;
  userId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId ?? null,
  });
  if (error) throw error;
}

async function requireRelease(workspaceId: string, releaseId?: string | null) {
  if (!releaseId) return;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("releases")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("release_not_found");
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

registerCapabilityHandler(addLegacyBrainFactCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, addLegacyBrainFactCapability.name, key);
  if (replay && typeof replay === "object" && "factId" in replay) return { output: replay as { factId: string; created: boolean }, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  if (input.artistId) {
    const { data, error } = await supabase.from("artists").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.artistId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("artist_not_found");
  }
  await requireRelease(ctx.workspaceId, input.releaseId);

  const { data, error } = await supabase.from("artist_brain_facts").insert({
    workspace_id: ctx.workspaceId,
    artist_id: input.artistId ?? null,
    release_id: input.releaseId ?? null,
    category: input.category,
    confidence: input.confidence,
    source: input.source ?? null,
    freshness_date: new Date().toISOString().slice(0, 10),
    fact: input.fact,
  }).select("id").single();
  if (error) throw error;
  const result = { factId: data.id, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: addLegacyBrainFactCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(createManagerRequestCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createManagerRequestCapability.name, key);
  if (replay && typeof replay === "object" && "requestId" in replay) return { output: replay as { requestId: string; stepCount: number; created: boolean }, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const plan = buildPlan(input.requestText);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("manager_requests").insert({
    workspace_id: ctx.workspaceId,
    release_id: input.releaseId ?? null,
    request_text: input.requestText,
    intent: plan[0]?.department.toLowerCase() || "general",
    status: "planned",
    plan,
    created_by: ctx.userId,
  }).select("id").single();
  if (error) throw error;
  const result = { requestId: data.id, stepCount: plan.length, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createManagerRequestCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(updateManagerRequestCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, updateManagerRequestCapability.name, key);
  if (replay && typeof replay === "object" && "requestId" in replay) return { output: replay as { requestId: string; status: string; changed: boolean }, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: current, error } = await supabase.from("manager_requests").select("id,status").eq("workspace_id", ctx.workspaceId).eq("id", input.requestId).maybeSingle();
  if (error) throw error;
  if (!current) throw new Error("manager_request_not_found");
  const changed = current.status !== input.status;
  if (changed) {
    const { error: updateError } = await supabase.from("manager_requests").update({ status: input.status, updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", input.requestId);
    if (updateError) throw updateError;
  }
  const result = { requestId: input.requestId, status: input.status, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: updateManagerRequestCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(generateReleaseTimelineCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, generateReleaseTimelineCapability.name, key);
  if (replay && typeof replay === "object" && "releaseId" in replay) return { output: replay as { releaseId: string; milestoneCount: number; generated: boolean }, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const templates: Array<[number, string, string]> = [
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
  const base = new Date(`${input.releaseDate}T12:00:00Z`);
  const rows = templates.map(([offset, phase, title]) => {
    const due = new Date(base);
    due.setUTCDate(due.getUTCDate() + offset);
    return { workspace_id: ctx.workspaceId, release_id: input.releaseId, phase, title, offset_days: offset, due_date: due.toISOString().slice(0, 10) };
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("release_milestones").upsert(rows, { onConflict: "release_id,title" });
  if (error) throw error;
  const result = { releaseId: input.releaseId, milestoneCount: rows.length, generated: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: generateReleaseTimelineCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(scorePromotionOpportunitiesCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, scorePromotionOpportunitiesCapability.name, key);
  if (replay && typeof replay === "object" && "scoredCount" in replay) return { output: replay as { scoredCount: number; recorded: boolean }, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const supabase = await createSupabaseServerClient();
  const { data: orgs, error } = await supabase.from("organizations")
    .select("id,org_type,trust_tier,risk_tier,evidence_strength,verification_status,relationship_stage,activity_status")
    .eq("workspace_id", ctx.workspaceId)
    .limit(250);
  if (error) throw error;
  const rows = (orgs ?? []).map((org) => {
    const fit = ["playlist", "blog", "radio", "creator", "media", "label"].some((value) => String(org.org_type || "").toLowerCase().includes(value)) ? 80 : 55;
    const trust = org.verification_status === "verified" ? 90 : org.evidence_strength && org.evidence_strength >= 3 ? 75 : 45;
    const relationship = org.relationship_stage === "placed" ? 95 : org.relationship_stage === "replied" ? 80 : org.relationship_stage === "pitched" ? 60 : 35;
    const timing = org.activity_status === "active" ? 85 : org.activity_status === "inactive" ? 20 : 55;
    const riskPenalty = ["high", "avoid"].includes(String(org.risk_tier || "").toLowerCase()) ? 25 : 0;
    const total = Math.max(0, Math.min(100, Math.round(fit * 0.35 + trust * 0.3 + relationship * 0.2 + timing * 0.15 - riskPenalty)));
    return {
      workspace_id: ctx.workspaceId,
      release_id: input.releaseId ?? null,
      target_kind: "organization",
      target_id: org.id,
      fit_score: fit,
      trust_score: trust,
      relationship_score: relationship,
      timing_score: timing,
      total_score: total,
      rationale: "Weighted fit, trust, relationship history, activity, and risk.",
    };
  });
  if (rows.length) {
    const { error: upsertError } = await supabase.from("opportunity_scores").upsert(rows, { onConflict: "workspace_id,release_id,target_kind,target_id" });
    if (upsertError) throw upsertError;
  }
  const result = { scoredCount: rows.length, recorded: rows.length > 0 };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: scorePromotionOpportunitiesCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(createAnalyticsInsightCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createAnalyticsInsightCapability.name, key);
  if (replay && typeof replay === "object" && "insightId" in replay) return { output: replay as { insightId: string; created: boolean }, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("analytics_insights").insert({
    workspace_id: ctx.workspaceId,
    release_id: input.releaseId ?? null,
    insight_type: input.insightType,
    title: input.title,
    narrative: input.narrative,
    confidence: input.confidence,
    status: "active",
  }).select("id").single();
  if (error) throw error;
  const result = { insightId: data.id, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createAnalyticsInsightCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
