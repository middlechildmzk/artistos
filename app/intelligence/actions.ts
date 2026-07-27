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

export async function addRecommendation(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await invoke("planner.create_recommendation", {
    releaseId: String(formData.get("releaseId") ?? "") || null,
    title,
    rationale: String(formData.get("rationale") ?? "").trim() || null,
    priority: String(formData.get("priority") ?? "medium"),
    actionPath: String(formData.get("actionPath") ?? "").trim() || null,
    dueDate: String(formData.get("dueDate") ?? "") || null,
    evidenceIds: [],
    idempotencyKey: `recommendation:${randomUUID()}`,
  });
  revalidatePath("/command-center");
  revalidatePath("/dashboard");
}

export async function updateRecommendation(formData: FormData) {
  const recommendationId = String(formData.get("id") ?? "");
  if (!recommendationId) return;
  await invoke("planner.update_recommendation_status", {
    recommendationId,
    status: String(formData.get("status") ?? "done"),
    idempotencyKey: `recommendation-status:${recommendationId}:${randomUUID()}`,
  });
  revalidatePath("/command-center");
  revalidatePath("/dashboard");
}

export async function addContentIdea(formData: FormData) {
  const hook = String(formData.get("hook") ?? "").trim();
  if (!hook) return;
  const scheduledRaw = String(formData.get("scheduledFor") ?? "");
  await invoke("planner.create_content_idea", {
    artistId: String(formData.get("artistId") ?? "") || null,
    releaseId: String(formData.get("releaseId") ?? "") || null,
    platform: String(formData.get("platform") ?? "instagram"),
    format: String(formData.get("format") ?? "reel"),
    hook,
    concept: String(formData.get("concept") ?? "").trim() || null,
    caption: String(formData.get("caption") ?? "").trim() || null,
    status: String(formData.get("status") ?? "idea"),
    scheduledFor: scheduledRaw ? new Date(scheduledRaw).toISOString() : null,
    idempotencyKey: `content-idea:${randomUUID()}`,
  });
  revalidatePath("/studio");
}

export async function updateContentStatus(formData: FormData) {
  const contentIdeaId = String(formData.get("id") ?? "");
  if (!contentIdeaId) return;
  await invoke("planner.update_content_idea_status", {
    contentIdeaId,
    status: String(formData.get("status") ?? "ready"),
    idempotencyKey: `content-status:${contentIdeaId}:${randomUUID()}`,
  });
  revalidatePath("/studio");
}

export async function addMetric(formData: FormData) {
  const value = Number(formData.get("value") ?? 0);
  await invoke("analytics.record_metric_snapshot", {
    artistId: String(formData.get("artistId") ?? "") || null,
    releaseId: String(formData.get("releaseId") ?? "") || null,
    platform: String(formData.get("platform") ?? "spotify").trim(),
    metric: String(formData.get("metric") ?? "followers").trim(),
    value: Number.isFinite(value) ? value : 0,
    capturedOn: String(formData.get("capturedOn") ?? "") || new Date().toISOString().slice(0, 10),
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    evidenceIds: [],
    idempotencyKey: `metric:${randomUUID()}`,
  });
  revalidatePath("/analytics");
  revalidatePath("/command-center");
}

export async function addAutomation(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await invoke("planner.create_automation_plan", {
    name,
    triggerType: String(formData.get("triggerType") ?? "release_date"),
    triggerDetail: String(formData.get("triggerDetail") ?? "").trim() || null,
    actionType: String(formData.get("actionType") ?? "create_task"),
    actionDetail: String(formData.get("actionDetail") ?? "").trim() || null,
    idempotencyKey: `automation-plan:${randomUUID()}`,
  });
  revalidatePath("/automations");
}

export async function toggleAutomation(formData: FormData) {
  const automationRuleId = String(formData.get("id") ?? "");
  if (!automationRuleId) return;
  const currentlyEnabled = String(formData.get("enabled") ?? "false") === "true";
  await invoke("planner.set_automation_plan_enabled", {
    automationRuleId,
    enabled: !currentlyEnabled,
    idempotencyKey: `automation-state:${automationRuleId}:${randomUUID()}`,
  });
  revalidatePath("/automations");
}
