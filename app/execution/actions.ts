"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id, role").eq("user_id", auth.user.id).limit(1).single();
  if (!membership) throw new Error("No workspace");
  return { supabase, user: auth.user, workspaceId: membership.workspace_id };
}

export async function createAgentRun(formData: FormData) {
  const { supabase, workspaceId } = await getContext();
  const managerRequestId = String(formData.get("managerRequestId") || "");
  if (!managerRequestId) throw new Error("Manager request is required");

  const { data: request } = await supabase.from("manager_requests").select("id,request_text,plan").eq("id", managerRequestId).eq("workspace_id", workspaceId).single();
  if (!request) throw new Error("Manager request not found");

  const { data: run, error: runError } = await supabase.from("agent_runs").insert({
    workspace_id: workspaceId,
    manager_request_id: request.id,
    title: request.request_text.slice(0, 100),
    objective: request.request_text,
    status: "awaiting_approval",
    approval_required: true,
  }).select("id").single();
  if (runError || !run) throw runError ?? new Error("Run was not created");

  const plan = Array.isArray(request.plan) ? request.plan as Array<{ department?: string; action?: string }> : [];
  const steps = plan.length ? plan : [{ department: "manager", action: "Review the objective and create the first executable work package." }];
  const { error: stepError } = await supabase.from("agent_run_steps").insert(steps.map((step, index) => ({
    workspace_id: workspaceId,
    agent_run_id: run.id,
    department: step.department || "manager",
    action_type: step.department === "content" ? "content_draft" : step.department === "analytics" ? "insight" : step.department === "promotion" ? "research" : "task",
    instruction: step.action || "Review and execute this step.",
    status: "pending",
    sort_order: (index + 1) * 10,
  })));
  if (stepError) throw stepError;
  revalidatePath("/execution");
}

export async function approveAgentRun(formData: FormData) {
  const { supabase, user, workspaceId } = await getContext();
  const runId = String(formData.get("runId") || "");
  const now = new Date().toISOString();
  const { error } = await supabase.from("agent_runs").update({ status: "approved", approved_by: user.id, approved_at: now, updated_at: now }).eq("id", runId).eq("workspace_id", workspaceId).eq("status", "awaiting_approval");
  if (error) throw error;
  await supabase.from("agent_run_steps").update({ status: "approved", updated_at: now }).eq("agent_run_id", runId).eq("workspace_id", workspaceId).eq("status", "pending");
  revalidatePath("/execution");
}

export async function materializeAgentRun(formData: FormData) {
  const { supabase, workspaceId } = await getContext();
  const runId = String(formData.get("runId") || "");
  const { data: run } = await supabase.from("agent_runs").select("id,title,status,manager_request_id").eq("id", runId).eq("workspace_id", workspaceId).single();
  if (!run || run.status !== "approved") throw new Error("Run must be approved before execution");
  const { data: request } = run.manager_request_id ? await supabase.from("manager_requests").select("release_id").eq("id", run.manager_request_id).single() : { data: null };
  const { data: steps } = await supabase.from("agent_run_steps").select("*").eq("agent_run_id", runId).eq("workspace_id", workspaceId).order("sort_order");
  const now = new Date().toISOString();
  await supabase.from("agent_runs").update({ status: "running", started_at: now, updated_at: now }).eq("id", runId);

  for (const step of steps ?? []) {
    let artifactType = "task";
    let artifactTitle = step.instruction.slice(0, 120);
    let artifactData: Record<string, unknown> = {};

    if (step.action_type === "content_draft") {
      const { data: content } = await supabase.from("content_ideas").insert({ workspace_id: workspaceId, release_id: request?.release_id || null, platform: "instagram", format: "reel", hook: step.instruction.slice(0, 180), concept: step.instruction, status: "idea" }).select("id").single();
      artifactType = "content_idea";
      artifactTitle = "Content idea created";
      artifactData = { content_idea_id: content?.id };
    } else if (step.action_type === "insight") {
      const { data: insight } = await supabase.from("analytics_insights").insert({ workspace_id: workspaceId, release_id: request?.release_id || null, insight_type: "opportunity", title: step.instruction.slice(0, 120), narrative: step.instruction, confidence: "supported", status: "active" }).select("id").single();
      artifactType = "analytics_insight";
      artifactTitle = "Analytics insight created";
      artifactData = { analytics_insight_id: insight?.id };
    } else if (step.action_type === "research") {
      const { data: recommendation } = await supabase.from("recommendations").insert({ workspace_id: workspaceId, release_id: request?.release_id || null, title: step.instruction.slice(0, 120), rationale: "Created from an approved Promotion Agent work package. Review evidence before outreach.", priority: "high", status: "open", action_path: "/targets" }).select("id").single();
      artifactType = "recommendation";
      artifactTitle = "Research recommendation created";
      artifactData = { recommendation_id: recommendation?.id };
    } else {
      const { data: task } = await supabase.from("tasks").insert({ workspace_id: workspaceId, release_id: request?.release_id || null, title: step.instruction.slice(0, 120), detail: `Created from approved agent run: ${run.title}`, classification: "agent", status: "open", sort_order: step.sort_order }).select("id").single();
      artifactData = { task_id: task?.id };
    }

    await supabase.from("agent_artifacts").insert({ workspace_id: workspaceId, agent_run_id: runId, step_id: step.id, artifact_type: artifactType, title: artifactTitle, body: step.instruction, data: artifactData, approval_state: "review" });
    await supabase.from("agent_run_steps").update({ status: "completed", result_summary: artifactTitle, output_type: artifactType, output_ref: artifactData, updated_at: new Date().toISOString() }).eq("id", step.id);
  }

  await supabase.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString(), result_summary: `${steps?.length ?? 0} approved work items materialized for review.`, updated_at: new Date().toISOString() }).eq("id", runId);
  revalidatePath("/execution"); revalidatePath("/dashboard"); revalidatePath("/studio"); revalidatePath("/analytics");
}

export async function reviewArtifact(formData: FormData) {
  const { supabase, workspaceId } = await getContext();
  const artifactId = String(formData.get("artifactId") || "");
  const approvalState = String(formData.get("approvalState") || "review");
  if (!["approved", "rejected", "review"].includes(approvalState)) throw new Error("Invalid review state");
  const { error } = await supabase.from("agent_artifacts").update({ approval_state: approvalState, updated_at: new Date().toISOString() }).eq("id", artifactId).eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidatePath("/execution");
}
