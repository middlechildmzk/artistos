import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import {
  recordCampaignOutcomeCapability,
  recordCampaignReplyCapability,
  updateCampaignTargetStatusCapability,
} from "./campaign-registry";

async function loadTarget(workspaceId: string, campaignTargetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaign_targets")
    .select("id,campaign_id,target_kind,target_id,status,campaigns(release_id)")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignTargetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("campaign_target_not_found");
  return { supabase, target: data };
}

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

async function storeReplay(args: {
  workspaceId: string;
  userId?: string | null;
  capabilityName: string;
  capabilityVersion: number;
  key: string;
  input: unknown;
  result: unknown;
}) {
  const supabase = await createSupabaseServerClient();
  const inputHash = createHash("sha256").update(JSON.stringify(args.input)).digest("hex");
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: inputHash,
    result: args.result,
    created_by: args.userId ?? null,
  });
  if (error && error.code !== "23505") throw error;
}

registerCapabilityHandler(updateCampaignTargetStatusCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, updateCampaignTargetStatusCapability.name, key);
  if (replay && typeof replay === "object" && "campaignTargetId" in replay) {
    return { output: replay as { campaignTargetId: string; status: string; changed: boolean }, evidenceIds: [] };
  }

  const { supabase, target } = await loadTarget(ctx.workspaceId, input.campaignTargetId);
  const changed = target.status !== input.status;
  if (changed) {
    const { error } = await supabase
      .from("campaign_targets")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", target.id);
    if (error) throw error;
  }

  if (target.target_kind === "organization") {
    const relationshipStage = input.status === "accepted" ? "negotiating" : input.status;
    const nextAction = input.status === "replied"
      ? "Review reply and decide next step"
      : input.status === "accepted"
        ? "Confirm placement details and evidence"
        : input.status === "declined"
          ? "Archive response and revisit later"
          : input.status === "placed"
            ? "Capture placement outcome and performance"
            : null;
    const { error } = await supabase
      .from("organizations")
      .update({ relationship_stage: relationshipStage, next_action: nextAction, next_action_due: null })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", target.target_id);
    if (error) throw error;
  }

  const result = { campaignTargetId: target.id, status: input.status, changed };
  await storeReplay({ workspaceId: ctx.workspaceId, userId: ctx.userId, capabilityName: updateCampaignTargetStatusCapability.name, capabilityVersion: 1, key, input, result });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(recordCampaignReplyCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, recordCampaignReplyCapability.name, key);
  if (replay && typeof replay === "object" && "interactionId" in replay) {
    return { output: replay as { interactionId: string; campaignTargetId: string; status: string }, evidenceIds: [] };
  }

  const { supabase, target } = await loadTarget(ctx.workspaceId, input.campaignTargetId);
  const interactionStatus = input.replyStatus === "interested" ? "positive" : input.replyStatus;
  const payload: Record<string, unknown> = {
    workspace_id: ctx.workspaceId,
    campaign_id: target.campaign_id,
    direction: "inbound",
    channel: "reply",
    subject: input.subject,
    body: input.body ?? null,
    reply_status: interactionStatus,
    follow_up_done: true,
  };
  if (target.target_kind === "organization") payload.organization_id = target.target_id;
  if (target.target_kind === "person") payload.person_id = target.target_id;
  if (target.target_kind === "property") payload.property_id = target.target_id;

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .insert(payload)
    .select("id")
    .single();
  if (interactionError) throw interactionError;

  const status = input.replyStatus === "accepted" ? "accepted" : input.replyStatus === "declined" ? "declined" : "replied";
  const { error: statusError } = await supabase
    .from("campaign_targets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", target.id);
  if (statusError) throw statusError;

  if (target.target_kind === "organization") {
    const relationshipStage = input.replyStatus === "accepted" || input.replyStatus === "interested"
      ? "negotiating"
      : input.replyStatus === "declined"
        ? "declined"
        : "replied";
    const nextAction = input.replyStatus === "declined" ? "Archive response and revisit later" : "Review reply and confirm next step";
    const { error } = await supabase
      .from("organizations")
      .update({ relationship_stage: relationshipStage, next_action: nextAction, next_action_due: null })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", target.target_id);
    if (error) throw error;
  }

  const result = { interactionId: interaction.id, campaignTargetId: target.id, status };
  await storeReplay({ workspaceId: ctx.workspaceId, userId: ctx.userId, capabilityName: recordCampaignReplyCapability.name, capabilityVersion: 1, key, input, result });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(recordCampaignOutcomeCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, recordCampaignOutcomeCapability.name, key);
  if (replay && typeof replay === "object" && "evidenceId" in replay) {
    return { output: replay as { outcomeId: string; evidenceId: string; campaignTargetId: string; status: "placed" }, evidenceIds: [String(replay.evidenceId)] };
  }

  const { supabase, target } = await loadTarget(ctx.workspaceId, input.campaignTargetId);
  const campaignRelation = Array.isArray(target.campaigns) ? target.campaigns[0] : target.campaigns;

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence_records")
    .insert({
      workspace_id: ctx.workspaceId,
      evidence_type: "campaign_outcome",
      source_type: input.url ? "url" : "human_attestation",
      source_uri: input.url ?? null,
      summary: input.evidenceSummary,
      confidence: input.confidence,
      observed_at: `${input.outcomeDate}T00:00:00.000Z`,
      captured_by: ctx.userId ?? null,
      metadata: { campaignTargetId: target.id, outcomeType: input.outcomeType },
    })
    .select("id")
    .single();
  if (evidenceError) throw evidenceError;

  const payload: Record<string, unknown> = {
    workspace_id: ctx.workspaceId,
    campaign_id: target.campaign_id,
    release_id: campaignRelation?.release_id ?? null,
    outcome_type: input.outcomeType,
    outcome_date: input.outcomeDate,
    evidence_summary: input.evidenceSummary,
    url: input.url ?? null,
    confidence: input.confidence,
  };
  if (target.target_kind === "organization") payload.organization_id = target.target_id;
  if (target.target_kind === "property") payload.property_id = target.target_id;

  const { data: outcome, error: outcomeError } = await supabase.from("outcomes").insert(payload).select("id").single();
  if (outcomeError) throw outcomeError;

  const { error: targetError } = await supabase
    .from("campaign_targets")
    .update({ status: "placed", updated_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", target.id);
  if (targetError) throw targetError;

  if (target.target_kind === "organization") {
    const { error } = await supabase
      .from("organizations")
      .update({ relationship_stage: "placed", next_action: "Monitor placement and capture performance", next_action_due: null })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", target.target_id);
    if (error) throw error;
  }

  const result = { outcomeId: outcome.id, evidenceId: evidence.id, campaignTargetId: target.id, status: "placed" as const };
  await storeReplay({ workspaceId: ctx.workspaceId, userId: ctx.userId, capabilityName: recordCampaignOutcomeCapability.name, capabilityVersion: 1, key, input, result });
  return { output: result, evidenceIds: [evidence.id] };
});
