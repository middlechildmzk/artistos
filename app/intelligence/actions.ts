"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) throw new Error("No active workspace");
  return { supabase, workspaceId: membership.workspace_id };
}

export async function addRecommendation(formData: FormData) {
  const { supabase, workspaceId } = await requireWorkspace();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const { error } = await supabase.from("recommendations").insert({
    workspace_id: workspaceId,
    release_id: String(formData.get("releaseId") ?? "") || null,
    title,
    rationale: String(formData.get("rationale") ?? "").trim() || null,
    priority: String(formData.get("priority") ?? "medium"),
    action_path: String(formData.get("actionPath") ?? "").trim() || null,
    due_date: String(formData.get("dueDate") ?? "") || null,
  });
  if (error) throw error;
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
  const { supabase, workspaceId } = await requireWorkspace();
  const hook = String(formData.get("hook") ?? "").trim();
  if (!hook) return;
  const { error } = await supabase.from("content_ideas").insert({
    workspace_id: workspaceId,
    artist_id: String(formData.get("artistId") ?? "") || null,
    release_id: String(formData.get("releaseId") ?? "") || null,
    platform: String(formData.get("platform") ?? "instagram"),
    format: String(formData.get("format") ?? "reel"),
    hook,
    concept: String(formData.get("concept") ?? "").trim() || null,
    caption: String(formData.get("caption") ?? "").trim() || null,
    status: String(formData.get("status") ?? "idea"),
    scheduled_for: String(formData.get("scheduledFor") ?? "") || null,
  });
  if (error) throw error;
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
  const { supabase, workspaceId } = await requireWorkspace();
  const platform = String(formData.get("platform") ?? "spotify").trim();
  const metric = String(formData.get("metric") ?? "followers").trim();
  const value = Number(formData.get("value") ?? 0);
  const { error } = await supabase.from("metric_snapshots").upsert({
    workspace_id: workspaceId,
    artist_id: String(formData.get("artistId") ?? "") || null,
    release_id: String(formData.get("releaseId") ?? "") || null,
    platform,
    metric,
    value: Number.isFinite(value) ? value : 0,
    captured_on: String(formData.get("capturedOn") ?? "") || new Date().toISOString().slice(0, 10),
    source_url: String(formData.get("sourceUrl") ?? "").trim() || null,
  }, { onConflict: "workspace_id,artist_id,release_id,platform,metric,captured_on" });
  if (error) throw error;
  revalidatePath("/analytics");
  revalidatePath("/command-center");
}

export async function addAutomation(formData: FormData) {
  const { supabase, workspaceId } = await requireWorkspace();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("automation_rules").insert({
    workspace_id: workspaceId,
    name,
    trigger_type: String(formData.get("triggerType") ?? "release_date"),
    action_type: String(formData.get("actionType") ?? "create_task"),
    trigger_config: { detail: String(formData.get("triggerDetail") ?? "").trim() },
    action_config: { detail: String(formData.get("actionDetail") ?? "").trim() },
    enabled: true,
  });
  if (error) throw error;
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
