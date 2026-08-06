"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

function idempotencyKey(prefix: string, values: Array<string | null>) {
  const digest = createHash("sha256").update(values.map((value) => value ?? "").join("\u001f"), "utf8").digest("hex");
  return `${prefix}:${digest}`;
}

async function invokeCapabilityCommand(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const key = String(input.idempotencyKey);
  const result = await invokeCapability({ name, ctx, input, idempotencyKey: key, dependencies: createServerInvocationDependencies() });
  if (result.status !== "ok") throw new Error(result.status === "failed" ? result.error.message : `Capability ${result.status}`);
}

export async function addOrganizationToCampaign(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!organizationId || !campaignId) return;
  await invokeCapabilityCommand("crm.add_organization_to_campaign", {
    organizationId,
    campaignId,
    idempotencyKey: idempotencyKey("crm-campaign", [organizationId, campaignId]),
  });
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/network");
  revalidatePath("/campaigns");
}

export async function logOutreach(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const endpointId = String(formData.get("endpointId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const channel = String(formData.get("channel") ?? "email").trim();
  const submissionNonce = String(formData.get("submissionNonce") ?? "").trim();
  if (!organizationId || !campaignId || !endpointId || !subject || !body || !submissionNonce) return;

  await invokeCapabilityCommand("crm.log_outbound_outreach", {
    organizationId,
    campaignId,
    endpointId,
    channel,
    subject,
    body,
    followUpDue: String(formData.get("followUpDue") ?? "") || null,
    assetLink: String(formData.get("assetLink") ?? "").trim() || null,
    idempotencyKey: idempotencyKey("crm-outreach", [organizationId, campaignId, endpointId, submissionNonce]),
  });
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/network");
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
}

export async function updateRelationship(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const relationshipStage = String(formData.get("relationshipStage") ?? "identified");
  const nextAction = String(formData.get("nextAction") ?? "").trim() || null;
  const nextActionDue = String(formData.get("nextActionDue") ?? "") || null;
  if (!organizationId) return;

  await invokeCapabilityCommand("crm.update_organization_relationship", {
    organizationId,
    relationshipStage,
    nextAction,
    nextActionDue,
    idempotencyKey: idempotencyKey("crm-relationship", [organizationId, relationshipStage, nextAction, nextActionDue]),
  });
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/network");
}
