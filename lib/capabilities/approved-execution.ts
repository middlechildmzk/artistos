import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCapability } from "./registry";
import { getCapabilityHandler } from "./handlers";
import { createActorContext, createServerInvocationDependencies } from "./server-runtime";

import "./initial-registry";
import "./core-handlers";

function hashPayload(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function decideApproval(approvalId: string, decision: "approved" | "rejected", note?: string) {
  const ctx = await createActorContext();
  if (ctx.role !== "admin" && ctx.role !== "owner") throw new Error("admin_role_required");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("decide_capability_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function executeApprovedCapability(approvalId: string) {
  const ctx = await createActorContext();
  if (ctx.role !== "admin" && ctx.role !== "owner") throw new Error("admin_role_required");

  const supabase = await createSupabaseServerClient();
  const dependencies = createServerInvocationDependencies();
  const { data: approval, error: claimError } = await supabase.rpc("claim_capability_approval", {
    p_approval_id: approvalId,
  });
  if (claimError) throw claimError;

  const row = Array.isArray(approval) ? approval[0] : approval;
  if (!row) throw new Error("approval_not_claimed");
  if (row.workspace_id !== ctx.workspaceId) throw new Error("workspace_mismatch");

  const capability = getCapability(row.capability_name, row.capability_version);
  const parsed = capability.input.safeParse(row.request_payload);
  if (!parsed.success) {
    await supabase.rpc("finish_capability_approval", { p_approval_id: approvalId, p_status: "failed", p_error: "frozen_payload_invalid" });
    throw new Error("frozen_payload_invalid");
  }

  const actualHash = hashPayload(parsed.data);
  if (actualHash !== row.preview_hash) {
    await supabase.rpc("finish_capability_approval", { p_approval_id: approvalId, p_status: "failed", p_error: "preview_hash_mismatch" });
    throw new Error("preview_hash_mismatch");
  }

  const executionContext = { ...ctx, artistId: row.artist_id ?? ctx.artistId };
  const handler = getCapabilityHandler(capability.name, capability.version);

  try {
    const execution = await handler({
      ctx: executionContext,
      input: parsed.data,
      idempotencyKey: typeof parsed.data === "object" && parsed.data !== null && "idempotencyKey" in parsed.data
        ? String(parsed.data.idempotencyKey)
        : undefined,
    });

    if (capability.evidence === "required" && execution.evidenceIds.length === 0) {
      throw new Error("evidence_missing");
    }

    const output = capability.output.safeParse(execution.output);
    if (!output.success) throw new Error("invalid_handler_output");

    const auditId = await dependencies.recordAudit({
      ctx: executionContext,
      capabilityName: capability.name,
      version: capability.version,
      riskClass: capability.risk,
      decision: "succeeded",
      policyId: "approval.frozen_request_executed",
      inputHash: actualHash,
      outputSummary: output.data,
      evidenceIds: execution.evidenceIds,
    });

    const { error: finishError } = await supabase.rpc("finish_capability_approval", {
      p_approval_id: approvalId,
      p_status: "consumed",
      p_error: null,
    });
    if (finishError) throw finishError;

    return { status: "ok" as const, output: output.data, evidenceIds: execution.evidenceIds, auditId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "approved_execution_failed";
    await dependencies.recordAudit({
      ctx: executionContext,
      capabilityName: capability.name,
      version: capability.version,
      riskClass: capability.risk,
      decision: "failed",
      policyId: "approval.frozen_request_executed",
      inputHash: actualHash,
      errorCode: "approved_execution_failed",
      errorMessage: message,
    });
    await supabase.rpc("finish_capability_approval", {
      p_approval_id: approvalId,
      p_status: "failed",
      p_error: message,
    });
    throw error;
  }
}
