"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership) throw new Error("No active workspace membership found");
  return { supabase, workspaceId: membership.workspace_id };
}

export async function updateCampaignTargetStatus(formData: FormData) {
  const campaignTargetId = String(formData.get("campaignTargetId") ?? "");
  const status = String(formData.get("status") ?? "queued");
  const allowed = new Set(["queued", "pitched", "replied", "accepted", "declined", "placed"]);
  if (!campaignTargetId || !allowed.has(status)) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const { data: target, error: targetError } = await supabase
    .from("campaign_targets")
    .select("id, campaign_id, target_kind, target_id")
    .eq("id", campaignTargetId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (targetError || !target) throw new Error("Campaign target not found");

  const { error } = await supabase
    .from("campaign_targets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", campaignTargetId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;

  if (target.target_kind === "organization") {
    const relationshipStage = status === "accepted" ? "negotiating" : status === "placed" ? "placed" : status;
    const nextAction = status === "replied" ? "Review reply and decide next step" : status === "accepted" ? "Confirm placement details and evidence" : status === "declined" ? "Archive response and revisit later" : status === "placed" ? "Capture placement outcome and performance" : null;
    const { error: organizationError } = await supabase
      .from("organizations")
      .update({ relationship_stage: relationshipStage, next_action: nextAction, next_action_due: null })
      .eq("id", target.target_id)
      .eq("workspace_id", workspaceId);
    if (organizationError) throw organizationError;
  }

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  if (target.target_kind === "organization") revalidatePath(`/targets/${target.target_id}`);
}

export async function recordCampaignReply(formData: FormData) {
  const campaignTargetId = String(formData.get("campaignTargetId") ?? "");
  const subject = String(formData.get("subject") ?? "Reply received").trim();
  const body = String(formData.get("body") ?? "").trim();
  const replyStatus = String(formData.get("replyStatus") ?? "replied");
  const allowedReplyStatuses = new Set(["replied", "interested", "accepted", "declined"]);
  if (!campaignTargetId || !allowedReplyStatuses.has(replyStatus)) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const { data: target, error: targetError } = await supabase
    .from("campaign_targets")
    .select("id, campaign_id, target_kind, target_id")
    .eq("id", campaignTargetId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (targetError || !target) throw new Error("Campaign target not found");

  const interactionStatus = replyStatus === "interested" ? "positive" : replyStatus;
  const interactionPayload: Record<string, unknown> = {
    workspace_id: workspaceId,
    campaign_id: target.campaign_id,
    direction: "inbound",
    channel: "reply",
    subject,
    body: body || null,
    reply_status: interactionStatus,
    follow_up_done: true,
  };
  if (target.target_kind === "organization") interactionPayload.organization_id = target.target_id;
  if (target.target_kind === "person") interactionPayload.person_id = target.target_id;
  if (target.target_kind === "property") interactionPayload.property_id = target.target_id;

  const { error: interactionError } = await supabase.from("interactions").insert(interactionPayload);
  if (interactionError) throw interactionError;

  const campaignStatus = replyStatus === "accepted" ? "accepted" : replyStatus === "declined" ? "declined" : "replied";
  const { error: statusError } = await supabase
    .from("campaign_targets")
    .update({ status: campaignStatus, updated_at: new Date().toISOString() })
    .eq("id", campaignTargetId)
    .eq("workspace_id", workspaceId);
  if (statusError) throw statusError;

  if (target.target_kind === "organization") {
    const relationshipStage = replyStatus === "accepted" || replyStatus === "interested" ? "negotiating" : replyStatus === "declined" ? "declined" : "replied";
    const nextAction = replyStatus === "declined" ? "Archive response and revisit later" : "Review reply and confirm next step";
    const { error: organizationError } = await supabase
      .from("organizations")
      .update({ relationship_stage: relationshipStage, next_action: nextAction, next_action_due: null })
      .eq("id", target.target_id)
      .eq("workspace_id", workspaceId);
    if (organizationError) throw organizationError;
  }

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  if (target.target_kind === "organization") revalidatePath(`/targets/${target.target_id}`);
}

export async function recordCampaignOutcome(formData: FormData) {
  const campaignTargetId = String(formData.get("campaignTargetId") ?? "");
  const outcomeType = String(formData.get("outcomeType") ?? "placement").trim();
  const outcomeDate = String(formData.get("outcomeDate") ?? "") || new Date().toISOString().slice(0, 10);
  const evidenceSummary = String(formData.get("evidenceSummary") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const confidence = String(formData.get("confidence") ?? "supported");
  if (!campaignTargetId || !outcomeType) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const { data: target, error: targetError } = await supabase
    .from("campaign_targets")
    .select("id, campaign_id, target_kind, target_id, campaigns(release_id)")
    .eq("id", campaignTargetId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (targetError || !target) throw new Error("Campaign target not found");

  const campaignRelation = Array.isArray(target.campaigns) ? target.campaigns[0] : target.campaigns;
  const payload: Record<string, unknown> = {
    workspace_id: workspaceId,
    campaign_id: target.campaign_id,
    release_id: campaignRelation?.release_id ?? null,
    outcome_type: outcomeType,
    outcome_date: outcomeDate,
    evidence_summary: evidenceSummary,
    url,
    confidence,
  };
  if (target.target_kind === "organization") payload.organization_id = target.target_id;
  if (target.target_kind === "property") payload.property_id = target.target_id;

  const { error: outcomeError } = await supabase.from("outcomes").insert(payload);
  if (outcomeError) throw outcomeError;

  const { error: targetUpdateError } = await supabase
    .from("campaign_targets")
    .update({ status: "placed", updated_at: new Date().toISOString() })
    .eq("id", campaignTargetId)
    .eq("workspace_id", workspaceId);
  if (targetUpdateError) throw targetUpdateError;

  if (target.target_kind === "organization") {
    const { error: organizationError } = await supabase
      .from("organizations")
      .update({ relationship_stage: "placed", next_action: "Monitor placement and capture performance", next_action_due: null })
      .eq("id", target.target_id)
      .eq("workspace_id", workspaceId);
    if (organizationError) throw organizationError;
  }

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  if (target.target_kind === "organization") revalidatePath(`/targets/${target.target_id}`);
}
