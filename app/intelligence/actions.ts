"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invoke(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({ name, ctx, input, idempotencyKey, dependencies: createServerInvocationDependencies() });
  if (result.status !== "ok") throw new Error(result.status === "failed" ? result.error.message : `Capability ${result.status}`);
}

async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) throw new Error("No active workspace");
  return { supabase, workspaceId: membership.workspace_id };
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
  const { supabase, workspaceId } = await requireWorkspace();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "done");
  if (!id) return;
  const { error } = await supabase.from("recommendations").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw error;
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
  const { supabase, workspaceId } = await requireWorkspace();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "ready");
  if (!id) return;
  const { error } = await supabase.from("content_ideas").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw error;
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
  const { supabase, workspaceId } = await requireWorkspace();
  const id = String(formData.get("id") ?? "");
  const enabled = String(formData.get("enabled") ?? "false") === "true";
  if (!id) return;
  const { error } = await supabase.from("automation_rules").update({ enabled: !enabled, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidatePath("/automations");
}
