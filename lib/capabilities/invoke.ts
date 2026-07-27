import { randomUUID } from "node:crypto";
import type { ActorContext, CapabilityResult } from "./types";
import { getCapability } from "./registry";
import { evaluateCapabilityPolicy, type AutonomyPolicy } from "@/lib/policies/evaluate";

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: string; policy: string };

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

  const authorization = await args.dependencies.authorize(args.ctx, capability.name, parsed.data);
  if (!authorization.allowed) {
    return { status: "denied", reason: authorization.reason, policy: authorization.policy };
  }

  const policies = await args.dependencies.loadPolicies(args.ctx, capability.name);
  const policy = evaluateCapabilityPolicy(capability, args.ctx, policies);

  if (policy.effect === "deny") {
    return { status: "denied", reason: policy.reason, policy: policy.policyId };
  }

  if (policy.effect === "require_approval") {
    const previewHash = await args.dependencies.hashPreview({
      capability: capability.name,
      version: capability.version,
      input: parsed.data,
      workspaceId: args.ctx.workspaceId,
      artistId: args.ctx.artistId,
    });
    const approval = await args.dependencies.createApproval({
      ctx: args.ctx,
      capabilityName: capability.name,
      version: capability.version,
      input: parsed.data,
      previewHash,
    });
    return { status: "requires_approval", approvalId: approval.approvalId, preview: approval.preview };
  }

  try {
    const execution = await args.dependencies.execute<O>({
      ctx: args.ctx,
      capabilityName: capability.name,
      version: capability.version,
      input: parsed.data,
      idempotencyKey: args.idempotencyKey,
    });

    if (capability.evidence === "required" && execution.evidenceIds.length === 0) {
      return failure("evidence_missing", "Capability execution produced no required evidence");
    }

    return {
      status: "ok",
      output: execution.output,
      evidenceIds: execution.evidenceIds,
      auditId: execution.auditId ?? randomUUID(),
    };
  } catch (error) {
    return failure(
      "execution_failed",
      error instanceof Error ? error.message : "Capability execution failed",
      false,
    );
  }
}
