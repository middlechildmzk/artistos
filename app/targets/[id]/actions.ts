"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invoke(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({ name, ctx, input, idempotencyKey, dependencies: createServerInvocationDependencies() });
  if (result.status !== "ok") throw new Error(result.status === "failed" ? result.error.message : `Capability ${result.status}`);
}

export async function addOrganizationToCampaign(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!organizationId || !campaignId) return;
  await invoke("crm.add_organization_to_campaign", { organizationId, campaignId, idempotencyKey: `crm-campaign:${organizationId}:${campaignId}:${randomUUID()}` });
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/targets");
  revalidatePath("/campaigns");
}

export async function logOutreach(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  if (!organizationId || !subject) return;
  await invoke("crm.log_outbound_outreach", { organizationId, campaignId: String(formData.get("campaignId") ?? "") || null, endpointId: String(formData.get("endpointId") ?? "") || null, channel: String(formData.get("channel") ?? "email").trim(), subject, body: String(formData.get("body") ?? "").trim() || null, followUpDue: String(formData.get("followUpDue") ?? "") || null, assetLink: String(formData.get("assetLink") ?? "").trim() || null, idempotencyKey: `crm-outreach:${organizationId}:${randomUUID()}` });
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
}

export async function updateRelationship(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return;
  // invokeCapability remains the only business-write path; this helper centralizes its identical guard sequence.
  await invoke("crm.update_organization_relationship", { organizationId, relationshipStage: String(formData.get("relationshipStage") ?? "identified"), nextAction: String(formData.get("nextAction") ?? "").trim() || null, nextActionDue: String(formData.get("nextActionDue") ?? "") || null, idempotencyKey: `crm-relationship:${organizationId}:${randomUUID()}` });
  revalidatePath(`/targets/${organizationId}`);
  revalidatePath("/targets");
}