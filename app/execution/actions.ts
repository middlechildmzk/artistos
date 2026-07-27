"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/application/workspace-context";

const idSchema = z.string().uuid();
const reviewStateSchema = z.enum(["approved", "rejected", "review"]);

type AgentStep = {
  id: string;
  instruction: string;
  action_type: string;
  sort_order: number;
};

function requireId(value: FormDataEntryValue | null, label: string) {
  const result = idSchema.safeParse(String(value || ""));
  if (!result.success) throw new Error(`${label} is invalid`);
  return result.data;
}

export async function createAgentRun(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceContext();
  const managerRequestId = requireId(formData.get("managerRequestId"), "Manager request");

  const { data: request, error: requestError } = await supabase
    .from("manager_requests")
    .select("id,request_text,plan")
    .eq("id", managerRequestId)
    .eq("workspace_id", workspaceId)
    .single();

  if (requestError || !request) throw requestError ?? new Error("Manager request not found");

  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      workspace_id: workspaceId,
      manager_request_id: request.id,
      title: request.request_text.slice(0, 100),
      objective: request.request_text,
      status: "awaiting_approval",
      approval_required: true,
    })
    .select("id")
    .single();

  if (runError || !run) throw runError ?? new Error("Run was not created");

  const plan = Array.isArray(request.plan)
    ? (request.plan as Array<{ department?: string; action?: string }>)
    : [];
  const steps = plan.length
    ? plan
    : [{ department: "manager", action: "Review the objective and create the first executable work package." }];

  const { error: stepError } = await supabase.from("agent_run_steps").insert(
    steps.map((step, index) => ({
      workspace_id: workspaceId,
      agent_run_id: run.id,
      department: step.department || "manager",
      action_type:
        step.department === "content"
          ? "content_draft"
          : step.department === "analytics"
            ? "insight"
            : step.department === "promotion"
              ? "research"
              : "task",
      instruction: step.action || "Review and execute this step.",
      status: "pending",
      sort_order: (index + 1) * 10,
    })),
  );

  if (stepError) throw stepError;
  revalidatePath("/execution");
}

export async function approveAgentRun(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceContext();
  const runId = requireId(formData.get("runId"), "Run");
  const now = new Date().toISOString();

  const { data: approvedRun, error } = await supabase
    .from("agent_runs")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!approvedRun) throw new Error("Run is no longer awaiting approval");

  const { error: stepError } = await supabase
    .from("agent_run_steps")
    .update({ status: "approved", updated_at: now })
    .eq("agent_run_id", runId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending");

  if (stepError) throw stepError;
  revalidatePath("/execution");
}

export async function materializeAgentRun(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceContext();
  const runId = requireId(formData.get("runId"), "Run");
  const startedAt = new Date().toISOString();

  // The status transition is the execution lock. Only one request can claim an
  // approved run, preventing double-clicks and concurrent requests from
  // materializing the same work twice.
  const { data: run, error: claimError } = await supabase
    .from("agent_runs")
    .update({ status: "running", started_at: startedAt, updated_at: startedAt })
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .select("id,title,manager_request_id")
    .maybeSingle();

  if (claimError) throw claimError;
  if (!run) throw new Error("Run is not approved, or is already being executed");

  try {
    const { data: request, error: requestError } = run.manager_request_id
      ? await supabase
          .from("manager_requests")
          .select("release_id")
          .eq("id", run.manager_request_id)
          .eq("workspace_id", workspaceId)
          .single()
      : { data: null, error: null };

    if (requestError) throw requestError;

    const { data: steps, error: stepsError } = await supabase
      .from("agent_run_steps")
      .select("id,instruction,action_type,sort_order")
      .eq("agent_run_id", runId)
      .eq("workspace_id", workspaceId)
      .order("sort_order");

    if (stepsError) throw stepsError;

    let completedCount = 0;

    for (const candidate of (steps ?? []) as AgentStep[]) {
      const stepStartedAt = new Date().toISOString();
      const { data: step, error: stepClaimError } = await supabase
        .from("agent_run_steps")
        .update({ status: "running", updated_at: stepStartedAt })
        .eq("id", candidate.id)
        .eq("workspace_id", workspaceId)
        .eq("agent_run_id", runId)
        .eq("status", "approved")
        .select("id,instruction,action_type,sort_order")
        .maybeSingle();

      if (stepClaimError) throw stepClaimError;
      if (!step) continue;

      try {
        let artifactType = "task";
        let artifactTitle = step.instruction.slice(0, 120);
        let artifactData: Record<string, unknown> = {};

        if (step.action_type === "content_draft") {
          const { data: content, error } = await supabase
            .from("content_ideas")
            .insert({
              workspace_id: workspaceId,
              release_id: request?.release_id || null,
              platform: "instagram",
              format: "reel",
              hook: step.instruction.slice(0, 180),
              concept: step.instruction,
              status: "idea",
            })
            .select("id")
            .single();
          if (error) throw error;
          artifactType = "content_idea";
          artifactTitle = "Content idea created";
          artifactData = { content_idea_id: content.id };
        } else if (step.action_type === "insight") {
          const { data: insight, error } = await supabase
            .from("analytics_insights")
            .insert({
              workspace_id: workspaceId,
              release_id: request?.release_id || null,
              insight_type: "opportunity",
              title: step.instruction.slice(0, 120),
              narrative: step.instruction,
              confidence: "supported",
              status: "active",
            })
            .select("id")
            .single();
          if (error) throw error;
          artifactType = "analytics_insight";
          artifactTitle = "Analytics insight created";
          artifactData = { analytics_insight_id: insight.id };
        } else if (step.action_type === "research") {
          const { data: recommendation, error } = await supabase
            .from("recommendations")
            .insert({
              workspace_id: workspaceId,
              release_id: request?.release_id || null,
              title: step.instruction.slice(0, 120),
              rationale: "Created from an approved promotion work package. Review evidence before outreach.",
              priority: "high",
              status: "open",
              action_path: "/targets",
            })
            .select("id")
            .single();
          if (error) throw error;
          artifactType = "recommendation";
          artifactTitle = "Research recommendation created";
          artifactData = { recommendation_id: recommendation.id };
        } else {
          const { data: task, error } = await supabase
            .from("tasks")
            .insert({
              workspace_id: workspaceId,
              release_id: request?.release_id || null,
              title: step.instruction.slice(0, 120),
              detail: `Created from approved agent run: ${run.title}`,
              classification: "agent",
              status: "open",
              sort_order: step.sort_order,
            })
            .select("id")
            .single();
          if (error) throw error;
          artifactData = { task_id: task.id };
        }

        const { error: artifactError } = await supabase.from("agent_artifacts").insert({
          workspace_id: workspaceId,
          agent_run_id: runId,
          step_id: step.id,
          artifact_type: artifactType,
          title: artifactTitle,
          body: step.instruction,
          data: artifactData,
          approval_state: "review",
        });
        if (artifactError) throw artifactError;

        const { error: completeError } = await supabase
          .from("agent_run_steps")
          .update({
            status: "completed",
            result_summary: artifactTitle,
            output_type: artifactType,
            output_ref: artifactData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", step.id)
          .eq("workspace_id", workspaceId)
          .eq("status", "running");
        if (completeError) throw completeError;

        completedCount += 1;
      } catch (stepError) {
        await supabase
          .from("agent_run_steps")
          .update({
            status: "failed",
            result_summary: stepError instanceof Error ? stepError.message : "Step failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", step.id)
          .eq("workspace_id", workspaceId);
        throw stepError;
      }
    }

    const completedAt = new Date().toISOString();
    const { error: completionError } = await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: completedAt,
        result_summary: `${completedCount} approved work items materialized for review.`,
        updated_at: completedAt,
      })
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .eq("status", "running");

    if (completionError) throw completionError;
  } catch (error) {
    const failedAt = new Date().toISOString();
    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        result_summary: error instanceof Error ? error.message : "Execution failed",
        updated_at: failedAt,
      })
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .eq("status", "running");
    throw error;
  } finally {
    revalidatePath("/execution");
    revalidatePath("/dashboard");
    revalidatePath("/studio");
    revalidatePath("/analytics");
  }
}

export async function reviewArtifact(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceContext();
  const artifactId = requireId(formData.get("artifactId"), "Artifact");
  const parsedState = reviewStateSchema.safeParse(String(formData.get("approvalState") || "review"));
  if (!parsedState.success) throw new Error("Invalid review state");

  const { data: artifact, error } = await supabase
    .from("agent_artifacts")
    .update({ approval_state: parsedState.data, updated_at: new Date().toISOString() })
    .eq("id", artifactId)
    .eq("workspace_id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!artifact) throw new Error("Artifact not found or no longer reviewable");
  revalidatePath("/execution");
}
