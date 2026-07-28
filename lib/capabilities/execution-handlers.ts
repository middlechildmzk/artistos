import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import {
  approveAgentRunCapability,
  createAgentRunCapability,
  materializeAgentRunCapability,
  reviewAgentArtifactCapability,
} from "./execution-registry";

type AgentStep = {
  id: string;
  instruction: string;
  action_type: string;
  sort_order: number;
};

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", capabilityName)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: {
  workspaceId: string;
  capabilityName: string;
  capabilityVersion: number;
  key: string;
  result: unknown;
  userId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId ?? null,
  });
  if (error) throw error;
}

registerCapabilityHandler(createAgentRunCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createAgentRunCapability.name, key);
  if (replay && typeof replay === "object" && "runId" in replay) {
    return { output: replay as { runId: string; stepCount: number; created: boolean }, evidenceIds: [] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: request, error: requestError } = await supabase
    .from("manager_requests")
    .select("id,request_text,plan")
    .eq("id", input.managerRequestId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) throw new Error("manager_request_not_found");

  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      workspace_id: ctx.workspaceId,
      manager_request_id: request.id,
      title: request.request_text.slice(0, 100),
      objective: request.request_text,
      status: "awaiting_approval",
      approval_required: true,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  const plan = Array.isArray(request.plan)
    ? (request.plan as Array<{ department?: string; action?: string }>)
    : [];
  const steps = plan.length
    ? plan
    : [{ department: "manager", action: "Review the objective and create the first executable work package." }];

  const { error: stepError } = await supabase.from("agent_run_steps").insert(
    steps.map((step, index) => ({
      workspace_id: ctx.workspaceId,
      agent_run_id: run.id,
      department: step.department || "manager",
      action_type:
        step.department?.toLowerCase() === "content"
          ? "content_draft"
          : step.department?.toLowerCase() === "analytics"
            ? "insight"
            : step.department?.toLowerCase() === "promotion"
              ? "research"
              : "task",
      instruction: step.action || "Review and execute this step.",
      status: "pending",
      sort_order: (index + 1) * 10,
    })),
  );
  if (stepError) throw stepError;

  const result = { runId: run.id, stepCount: steps.length, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createAgentRunCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(approveAgentRunCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, approveAgentRunCapability.name, key);
  if (replay && typeof replay === "object" && "runId" in replay) {
    return { output: replay as { runId: string; approved: boolean; changed: boolean }, evidenceIds: [] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("agent_runs")
    .select("id,status")
    .eq("id", input.runId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("agent_run_not_found");

  if (current.status === "approved") {
    const result = { runId: input.runId, approved: true, changed: false };
    await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: approveAgentRunCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
    return { output: result, evidenceIds: [] };
  }
  if (current.status !== "awaiting_approval") throw new Error("invalid_run_state");

  const now = new Date().toISOString();
  const { data: approvedRun, error } = await supabase
    .from("agent_runs")
    .update({ status: "approved", approved_by: ctx.userId, approved_at: now, updated_at: now })
    .eq("id", input.runId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!approvedRun) throw new Error("invalid_run_state");

  const { error: stepError } = await supabase
    .from("agent_run_steps")
    .update({ status: "approved", updated_at: now })
    .eq("agent_run_id", input.runId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "pending");
  if (stepError) throw stepError;

  const result = { runId: input.runId, approved: true, changed: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: approveAgentRunCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(materializeAgentRunCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, materializeAgentRunCapability.name, key);
  if (replay && typeof replay === "object" && "runId" in replay) {
    return { output: replay as { runId: string; completedSteps: number; status: "completed" }, evidenceIds: [] };
  }

  const supabase = await createSupabaseServerClient();
  const startedAt = new Date().toISOString();
  const { data: run, error: claimError } = await supabase
    .from("agent_runs")
    .update({ status: "running", started_at: startedAt, updated_at: startedAt })
    .eq("id", input.runId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "approved")
    .select("id,title,manager_request_id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!run) throw new Error("invalid_run_state");

  try {
    const { data: request, error: requestError } = run.manager_request_id
      ? await supabase
          .from("manager_requests")
          .select("release_id")
          .eq("id", run.manager_request_id)
          .eq("workspace_id", ctx.workspaceId)
          .maybeSingle()
      : { data: null, error: null };
    if (requestError) throw requestError;

    const { data: steps, error: stepsError } = await supabase
      .from("agent_run_steps")
      .select("id,instruction,action_type,sort_order")
      .eq("agent_run_id", input.runId)
      .eq("workspace_id", ctx.workspaceId)
      .order("sort_order");
    if (stepsError) throw stepsError;

    let completedCount = 0;
    for (const candidate of (steps ?? []) as AgentStep[]) {
      const stepStartedAt = new Date().toISOString();
      const { data: step, error: stepClaimError } = await supabase
        .from("agent_run_steps")
        .update({ status: "running", updated_at: stepStartedAt })
        .eq("id", candidate.id)
        .eq("workspace_id", ctx.workspaceId)
        .eq("agent_run_id", input.runId)
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
          const { data: content, error } = await supabase.from("content_ideas").insert({
            workspace_id: ctx.workspaceId,
            release_id: request?.release_id ?? null,
            platform: "instagram",
            format: "reel",
            hook: step.instruction.slice(0, 180),
            concept: step.instruction,
            status: "idea",
          }).select("id").single();
          if (error) throw error;
          artifactType = "content_idea";
          artifactTitle = "Content idea created";
          artifactData = { content_idea_id: content.id };
        } else if (step.action_type === "insight") {
          const { data: insight, error } = await supabase.from("analytics_insights").insert({
            workspace_id: ctx.workspaceId,
            release_id: request?.release_id ?? null,
            insight_type: "opportunity",
            title: step.instruction.slice(0, 120),
            narrative: step.instruction,
            confidence: 0.7,
            status: "active",
          }).select("id").single();
          if (error) throw error;
          artifactType = "analytics_insight";
          artifactTitle = "Analytics insight created";
          artifactData = { analytics_insight_id: insight.id };
        } else if (step.action_type === "research") {
          const { data: recommendation, error } = await supabase.from("recommendations").insert({
            workspace_id: ctx.workspaceId,
            release_id: request?.release_id ?? null,
            title: step.instruction.slice(0, 120),
            rationale: "Created from an approved promotion work package. Review evidence before outreach.",
            priority: "high",
            status: "open",
            action_path: "/targets",
          }).select("id").single();
          if (error) throw error;
          artifactType = "recommendation";
          artifactTitle = "Research recommendation created";
          artifactData = { recommendation_id: recommendation.id };
        } else {
          const { data: task, error } = await supabase.from("tasks").insert({
            workspace_id: ctx.workspaceId,
            release_id: request?.release_id ?? null,
            title: step.instruction.slice(0, 120),
            detail: `Created from approved agent run: ${run.title}`,
            classification: "agent",
            status: "open",
            sort_order: step.sort_order,
          }).select("id").single();
          if (error) throw error;
          artifactData = { task_id: task.id };
        }

        const { error: artifactError } = await supabase.from("agent_artifacts").insert({
          workspace_id: ctx.workspaceId,
          agent_run_id: input.runId,
          step_id: step.id,
          artifact_type: artifactType,
          title: artifactTitle,
          body: step.instruction,
          data: artifactData,
          approval_state: "review",
          created_by: ctx.userId,
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
          .eq("workspace_id", ctx.workspaceId)
          .eq("status", "running");
        if (completeError) throw completeError;
        completedCount += 1;
      } catch (stepError) {
        await supabase
          .from("agent_run_steps")
          .update({
            status: "failed",
            result_summary: stepError instanceof Error ? stepError.message : "Step failed",
            error_message: stepError instanceof Error ? stepError.message : "Step failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", step.id)
          .eq("workspace_id", ctx.workspaceId);
        throw stepError;
      }
    }

    const completedAt = new Date().toISOString();
    const { error: completeRunError } = await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: completedAt,
        result_summary: `${completedCount} approved step${completedCount === 1 ? "" : "s"} materialized for review.`,
        updated_at: completedAt,
      })
      .eq("id", input.runId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "running");
    if (completeRunError) throw completeRunError;

    const result = { runId: input.runId, completedSteps: completedCount, status: "completed" as const };
    await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: materializeAgentRunCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
    return { output: result, evidenceIds: [] };
  } catch (error) {
    const failedAt = new Date().toISOString();
    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        result_summary: error instanceof Error ? error.message : "Execution failed",
        error_message: error instanceof Error ? error.message : "Execution failed",
        updated_at: failedAt,
      })
      .eq("id", input.runId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "running");
    throw error;
  }
});

registerCapabilityHandler(reviewAgentArtifactCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, reviewAgentArtifactCapability.name, key);
  if (replay && typeof replay === "object" && "artifactId" in replay) {
    return { output: replay as { artifactId: string; approvalState: string; changed: boolean }, evidenceIds: [] };
  }
  const supabase = await createSupabaseServerClient();
  const { data: current, error } = await supabase.from("agent_artifacts").select("id,approval_state").eq("workspace_id", ctx.workspaceId).eq("id", input.artifactId).maybeSingle();
  if (error) throw error;
  if (!current) throw new Error("artifact_not_found");
  const changed = current.approval_state !== input.approvalState;
  if (changed) {
    const { error: updateError } = await supabase.from("agent_artifacts").update({ approval_state: input.approvalState, updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", input.artifactId);
    if (updateError) throw updateError;
  }
  const result = { artifactId: input.artifactId, approvalState: input.approvalState, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: reviewAgentArtifactCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
