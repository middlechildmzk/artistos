import { z } from "zod";

export const riskClasses = [
  "R0_read",
  "R1_internal_reversible",
  "R2_internal_destructive",
  "R3_external_effect",
  "R4_governance",
] as const;

export type RiskClass = (typeof riskClasses)[number];
export type CapabilityKind = "query" | "command" | "effect";
export type ApprovalBehavior = "never" | "by_policy" | "always";
export type IdempotencyBehavior = "naturally_idempotent" | "key_required" | "claim_guarded";
export type EvidenceRequirement = "none" | "optional" | "required";
export type McpExposure = "public_safe" | "authenticated" | "gated_write" | "prohibited";
export type WorkspaceRole = "viewer" | "contributor" | "editor" | "admin" | "owner";

export type CapabilityScope = {
  resource: "workspace" | "artist" | "release" | "campaign" | "organization" | "global";
  minRole: WorkspaceRole;
  grantPermission?: string;
};

export type RetryPolicy = {
  maxAttempts: number;
  backoff: "none" | "fixed" | "exponential";
  baseDelayMs: number;
  retryOn: Array<"transient" | "rate_limit" | "timeout" | "upstream_5xx">;
  neverRetryOn: Array<"validation" | "authorization" | "conflict" | "evidence_missing">;
};

export type ActorContext = {
  principalId: string;
  userId: string | null;
  workspaceId: string;
  artistId: string | null;
  role: WorkspaceRole;
  runId?: string;
  stepId?: string;
  mcpTokenId?: string;
};

export type CapabilityError = {
  code: string;
  message: string;
  detail?: unknown;
};

export type CapabilityResult<O> =
  | { status: "ok"; output: O; evidenceIds: string[]; auditId: string }
  | { status: "requires_approval"; approvalId: string; preview: unknown }
  | { status: "denied"; reason: string; policy: string }
  | { status: "failed"; error: CapabilityError; retryable: boolean };

export type CapabilityDefinition<I = unknown, O = unknown> = {
  name: string;
  version: number;
  kind: CapabilityKind;
  purpose: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  scope: CapabilityScope;
  risk: RiskClass;
  approval: ApprovalBehavior;
  idempotency: IdempotencyBehavior;
  evidence: EvidenceRequirement;
  auditEvents: readonly string[];
  retry: RetryPolicy;
  mcp: McpExposure;
  failureModes: readonly string[];
};

export const defaultReadRetry: RetryPolicy = {
  maxAttempts: 2,
  backoff: "fixed",
  baseDelayMs: 200,
  retryOn: ["transient", "timeout"],
  neverRetryOn: ["validation", "authorization", "conflict", "evidence_missing"],
};

export const defaultWriteRetry: RetryPolicy = {
  maxAttempts: 3,
  backoff: "exponential",
  baseDelayMs: 250,
  retryOn: ["transient", "rate_limit", "timeout", "upstream_5xx"],
  neverRetryOn: ["validation", "authorization", "conflict", "evidence_missing"],
};
