"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invokeOperating(name: string, input: Record<string, unknown>) {
  let ctx;
  try {
    ctx = await createActorContext();
  } catch (error) {
    if (error instanceof Error && error.message === "not_authenticated") redirect("/login");
    throw error;
  }
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({
    name,
    ctx,
    input,
    idempotencyKey,
    dependencies: createServerInvocationDependencies(),
  });
  if (result.status === "ok") return result.output;
  if (result.status === "requires_approval") throw new Error(`Approval required: ${result.approvalId}`);
  if (result.status === "denied") throw new Error(`Action denied by ${result.policy}: ${result.reason}`);
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

export async function addBrainFact(formData: FormData) {
  const fact = String(formData.get("fact") ?? "").trim();
  if (!fact) return;
  await invokeOperating("operating.add_brain_fact", {
    artistId: String(formData.get("artistId") || "") || null,
    releaseId: String(formData.get("releaseId") || "") || null,
    category: String(formData.get("category") || "identity"),
    confidence: String(formData.get("confidence") || "verified"),
    source: String(formData.get("source") || "").trim() || null,
    fact,
    idempotencyKey: `operating-brain-fact:${randomUUID()}`,
  });
  revalidatePath("/operating");
}

export async function createManagerRequest(formData: FormData) {
  const requestText = String(formData.get("requestText") ?? "").trim();
  if (!requestText) return;
  await invokeOperating("operating.create_manager_request", {
    requestText,
    releaseId: String(formData.get("releaseId") || "") || null,
    idempotencyKey: `operating-manager-request:${randomUUID()}`,
  });
  revalidatePath("/operating");
}

export async function updateManagerRequest(formData: FormData) {
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return;
  await invokeOperating("operating.update_manager_request", {
    requestId,
    status: String(formData.get("status") || "planned"),
    idempotencyKey: `operating-manager-status:${requestId}:${randomUUID()}`,
  });
  revalidatePath("/operating");
}

export async function generateReleaseTimeline(formData: FormData) {
  const releaseId = String(formData.get("releaseId") || "");
  const releaseDate = String(formData.get("releaseDate") || "");
  if (!releaseId || !releaseDate) return;
  await invokeOperating("operating.generate_release_timeline", {
    releaseId,
    releaseDate,
    idempotencyKey: `operating-release-timeline:${releaseId}:${releaseDate}:${randomUUID()}`,
  });
  revalidatePath("/operating");
}

export async function scorePromotionOpportunities(formData: FormData) {
  const releaseId = String(formData.get("releaseId") || "") || null;
  await invokeOperating("operating.score_promotion_opportunities", {
    releaseId,
    idempotencyKey: `operating-opportunity-score:${releaseId || "workspace"}:${randomUUID()}`,
  });
  revalidatePath("/operating");
}

export async function createAnalyticsInsight(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const narrative = String(formData.get("narrative") ?? "").trim();
  if (!title || !narrative) return;
  await invokeOperating("operating.create_analytics_insight", {
    releaseId: String(formData.get("releaseId") || "") || null,
    insightType: String(formData.get("insightType") || "performance"),
    title,
    narrative,
    confidence: Number(formData.get("confidence") || 0.7),
    idempotencyKey: `operating-analytics-insight:${randomUUID()}`,
  });
  revalidatePath("/operating");
}
