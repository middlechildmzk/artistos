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

export async function toggleTask(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const currentStatus = String(formData.get("currentStatus") ?? "open");
  if (!taskId) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const nextStatus = currentStatus === "done" ? "open" : "done";
  const { error } = await supabase
    .from("tasks")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  revalidatePath("/dashboard");
}

export async function completeFollowUp(formData: FormData) {
  const interactionId = String(formData.get("interactionId") ?? "");
  if (!interactionId) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const { error } = await supabase
    .from("interactions")
    .update({ follow_up_done: true })
    .eq("id", interactionId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
