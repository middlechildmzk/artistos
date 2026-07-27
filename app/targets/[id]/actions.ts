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

async function requireOrganization(organizationId: string) {
  const context = await requireWorkspace();
  const { data: organization, error } = await context.supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  if (error || !organization) throw new Error("Target not found in this workspace");
  return context;
}

export async function addOrganizationToCampaign(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!organizationId || !campaignId) return;

  const { supabase, workspaceId } = await requireOrganization(organizationId);

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (campaignError || !campaign) throw new Error("Campaign not found in this workspace");

  const { data: existing } = await supabase
    .from("campaign_targets")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .eq("target_kind", "organization")
    .eq("target_id", organizationId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("campaign_targets").insert({
      workspace_id: workspaceId,
      campaign_id: campaignId,
      target_kind: "organization",
      target_id: organizationId,
      status: "queued",
    });
    if (error) throw error;
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ relationship_stage: "qualified", next_action: "Draft and send campaign pitch" })
    .eq("id", organizationId)
    .eq("workspace_id", workspaceId);

  if (updateError) throw updateError;
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/targets");
  revalidatePath("/campaigns");
}

export async function logOutreach(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const endpointId = String(formData.get("endpointId") ?? "") || null;
  const channel = String(formData.get("channel") ?? "email").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const followUpDue = String(formData.get("followUpDue") ?? "") || null;
  const assetLink = String(formData.get("assetLink") ?? "").trim() || null;

  if (!organizationId || !subject) return;
  const { supabase, workspaceId } = await requireOrganization(organizationId);

  const { error } = await supabase.from("interactions").insert({
    workspace_id: workspaceId,
    organization_id: organizationId,
    campaign_id: campaignId,
    endpoint_id: endpointId,
    direction: "outbound",
    channel,
    subject,
    body: body || null,
    asset_link: assetLink,
    reply_status: "none",
    follow_up_due: followUpDue,
    follow_up_done: false,
  });

  if (error) throw error;

  if (campaignId) {
    const { error: targetError } = await supabase
      .from("campaign_targets")
      .update({ status: "pitched", updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("campaign_id", campaignId)
      .eq("target_kind", "organization")
      .eq("target_id", organizationId);
    if (targetError) throw targetError;
  }

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({
      relationship_stage: "pitched",
      next_action: followUpDue ? "Follow up on campaign pitch" : "Monitor for reply",
      next_action_due: followUpDue,
    })
    .eq("id", organizationId)
    .eq("workspace_id", workspaceId);

  if (organizationError) throw organizationError;
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
}

export async function updateRelationship(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const relationshipStage = String(formData.get("relationshipStage") ?? "identified");
  const nextAction = String(formData.get("nextAction") ?? "").trim() || null;
  const nextActionDue = String(formData.get("nextActionDue") ?? "") || null;
  if (!organizationId) return;

  const allowedStages = new Set(["identified", "qualified", "pitched", "replied", "negotiating", "placed", "declined", "dormant"]);
  if (!allowedStages.has(relationshipStage)) throw new Error("Unsupported relationship stage");

  const { supabase, workspaceId } = await requireOrganization(organizationId);
  const { error } = await supabase
    .from("organizations")
    .update({ relationship_stage: relationshipStage, next_action: nextAction, next_action_due: nextActionDue })
    .eq("id", organizationId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/targets");
}
