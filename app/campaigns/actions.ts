"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invokeCampaignCapability(name: string, input: Record<string, unknown>, idempotencyKey: string) {
  const ctx = await createActorContext();
  const result = await invokeCapability({
    name,
    ctx,
    input: { ...input, idempotencyKey },
    idempotencyKey,
    dependencies: createServerInvocationDependencies(),
  });

  if (result.status !== "ok") {
    if (result.status === "requires_approval") throw new Error(`approval_required:${result.approvalId}`);
    if (result.status === "denied") throw new Error(`capability_denied:${result.policy}:${result.reason}`);
    throw new Error(`${result.error.code}:${result.error.message}`);
  }

  return result;
}

function revalidateCampaignSurfaces(targetKind?: string, targetId?: string) {
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  if (targetKind === "organization" && targetId) revalidatePath(`/targets/${targetId}`);
}

export async function updateCampaignTargetStatus(formData: FormData) {
  const campaignTargetId = String(formData.get("campaignTargetId") ?? "");
  const status = String(formData.get("status") ?? "queued");
  const allowed = new Set(["queued", "pitched", "replied", "accepted", "declined", "placed"]);
  if (!campaignTargetId || !allowed.has(status)) return;

  await invokeCampaignCapability(
    "campaigns.update_target_status",
    { campaignTargetId, status },
    `campaign-status:${campaignTargetId}:${status}:${randomUUID()}`,
  );
  revalidateCampaignSurfaces();
}

export async function recordCampaignReply(formData: FormData) {
  const campaignTargetId = String(formData.get("campaignTargetId") ?? "");
  const subject = String(formData.get("subject") ?? "Reply received").trim();
  const body = String(formData.get("body") ?? "").trim();
  const replyStatus = String(formData.get("replyStatus") ?? "replied");
  const allowedReplyStatuses = new Set(["replied", "interested", "accepted", "declined"]);
  if (!campaignTargetId || !allowedReplyStatuses.has(replyStatus)) return;

  await invokeCampaignCapability(
    "campaigns.record_reply",
    { campaignTargetId, subject: subject || "Reply received", body: body || null, replyStatus },
    `campaign-reply:${campaignTargetId}:${randomUUID()}`,
  );
  revalidateCampaignSurfaces();
}

export async function recordCampaignOutcome(formData: FormData) {
  const campaignTargetId = String(formData.get("campaignTargetId") ?? "");
  const outcomeType = String(formData.get("outcomeType") ?? "placement").trim();
  const outcomeDate = String(formData.get("outcomeDate") ?? "") || new Date().toISOString().slice(0, 10);
  const evidenceSummary = String(formData.get("evidenceSummary") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  const confidence = String(formData.get("confidence") ?? "supported");
  const allowedConfidence = new Set(["verified", "supported", "weak", "unknown"]);
  if (!campaignTargetId || !outcomeType) return;
  if (!evidenceSummary) throw new Error("evidence_summary_required");
  if (!allowedConfidence.has(confidence)) throw new Error("invalid_evidence_confidence");

  await invokeCampaignCapability(
    "campaigns.record_outcome",
    { campaignTargetId, outcomeType, outcomeDate, evidenceSummary, url, confidence },
    `campaign-outcome:${campaignTargetId}:${outcomeType}:${outcomeDate}:${randomUUID()}`,
  );
  revalidateCampaignSurfaces();
}
