import { randomUUID } from "node:crypto";
import type { ActorContext, CapabilityResult } from "./types";
import { getCapability } from "./registry";
import { evaluateCapabilityPolicy, type AutonomyPolicy } from "@/lib/policies/evaluate";

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: string; policy: string };

export type AuditDecision = "allowed" | "denied" | "requires_approval" | "succeeded" | "failed";

export type InvocationDependencies = {
  authorize: (ctx: ActorContext, capabilityName: string, input: unknown) => Promise<AuthorizationDecision>;
  loadPolicies: (ctx: ActorContext, capabilityName: string) => Promise<readonly AutonomyPolicy[]>;
  createApproval: (args: {
    ctx: ActorContext;
    capabilityName: string;
    version: number;
    input: unknown;
    previewHash: string;
  }) => Promise<{ approvalId: string; preview: unknown }>;
  execute: <O>(args: {
    ctx: ActorContext;
    capabilityName: string;
    version: number;
    input: unknown;
    idempotencyKey?: string;
  }) => Promise<{ output: O; evidenceIds: string[]; auditId?: string }>;
  hashPreview: (input: unknown) => Promise<string>;
  recordAudit: (args: {
    ctx: ActorContext;
    capabilityName: string;
    version: number;
    riskClass: string;
    decision: AuditDecision;
    policyId?: string;
    idempotencyKey?: string;
    inputHash?: string;
    outputSummary?: unknown;
    evidenceIds?: string[];
    errorCode?: string;
    errorMessage?: string;
  }) => Promise<string>;
};

function failure<O>(code: string, message: string, retryable = false, detail?: unknown): CapabilityResult<O> {
  return { status: "failed", error: { code, message, detail }, retryable };
}

export async function invokeCapability<O = unknown>(args: {
  name: string;
  version?: number;
  ctx: ActorContext;
  input: unknown;
  idempotencyKey?: string;
  dependencies: InvocationDependencies;
}): Promise<CapabilityResult<O>> {
  const version = args.version ?? 1;
  let capability;

  try {
    capability = getCapability(args.name, version);
  } catch (error) {
    return failure("capability_not_found", error instanceof Error ? error.message : "Capability not found");
  }

  const parsed = capability.input.safeParse(args.input);
  if (!parsed.success) {
    return failure("validation", "Capability input failed validation", false, parsed.error.flatten());
  }

  if (capability.idempotency === "key_required" && !args.idempotencyKey) {
    return failure("idempotency_key_required", "This capability requires an idempotency key");
  }

  if (
    args.idempotencyKey &&
    typeof parsed.data === "object" &&
    parsed.data !== null &&
    "idempotencyKey" in parsed.data &&
    parsed.data.idempotencyKey !== args.idempotencyKey
  ) {
    return failure("idempotency_key_mismatch", "Input and invocation idempotency keys do not match");
  }

  const inputHash = await args.dependencies.hashPreview(parsed.data);
  const auditBase = {
    ctx: args.ctx,
    capabilityName: capability.name,
    version: capability.version,
    riskClass: capability.risk,
    idempotencyKey: args.idempotencyKey,
    inputHash,
  };

  const authorization = await args.dependencies.authorize(args.ctx, capability.name, parsed.data);
  if (!authorization.allowed) {
    await args.dependencies.recordAudit({ ...auditBase, decision: "denied", policyId: authorization.policy, errorCode: "authorization_denied", errorMessage: authorization.reason });
    return { status: "denied", reason: authorization.reason, policy: authorization.policy };
  }

  const policies = await args.dependencies.loadPolicies(args.ctx, capability.name);
  const policy = evaluateCapabilityPolicy(capability, args.ctx, policies);

  if (policy.effect === "deny") {
    await args.dependencies.recordAudit({ ...auditBase, decision: "denied", policyId: policy.policyId, errorCode: "policy_denied", errorMessage: policy.reason });
    return { status: "denied", reason: policy.reason, policy: policy.policyId };
  }

  if (policy.effect === "require_approval") {
    const approval = await args.dependencies.createApproval({
      ctx: args.ctx,
      capabilityName: capability.name,
      version: capability.version,
      input: parsed.data,
      previewHash: inputHash,
    });
    await args.dependencies.recordAudit({ ...auditBase, decision: "requires_approval", policyId: policy.policyId, outputSummary: { approvalId: approval.approvalId } });
    return { status: "requires_approval", approvalId: approval.approvalId, preview: approval.preview };
  }

  await args.dependencies.recordAudit({ ...auditBase, decision: "allowed", policyId: policy.policyId });

  try {
    const execution = await args.dependencies.execute<O>({
      ctx: args.ctx,
      capabilityName: capability.name,
      version: capability.version,
      input: parsed.data,
      idempotencyKey: args.idempotencyKey,
    });

    if (capability.evidence === "required" && execution.evidenceIds.length === 0) {
      await args.dependencies.recordAudit({ ...auditBase, decision: "failed", policyId: policy.policyId, errorCode: "evidence_missing", errorMessage: "Capability execution produced no required evidence" });
      return failure("evidence_missing", "Capability execution produced no required evidence");
    }

    const validatedOutput = capability.output.safeParse(execution.output);
    if (!validatedOutput.success) {
      await args.dependencies.recordAudit({ ...auditBase, decision: "failed", policyId: policy.policyId, errorCode: "invalid_handler_output", errorMessage: "Capability handler returned output that violates its contract" });
      return failure("invalid_handler_output", "Capability handler returned output that violates its contract", false, validatedOutput.error.flatten());
    }

    const auditId = execution.auditId ?? await args.dependencies.recordAudit({
      ...auditBase,
      decision: "succeeded",
      policyId: policy.policyId,
      outputSummary: validatedOutput.data,
      evidenceIds: execution.evidenceIds,
    });

    return {
      status: "ok",
      output: validatedOutput.data as O,
      evidenceIds: execution.evidenceIds,
      auditId: auditId || randomUUID(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capability execution failed";
    await args.dependencies.recordAudit({ ...auditBase, decision: "failed", policyId: policy.policyId, errorCode: "execution_failed", errorMessage: message });
    return failure("execution_failed", message, false);
  }
}
