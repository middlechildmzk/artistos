import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);

export const createAgentRunCapability = registerCapability({
  name: "execution.create_agent_run",
  version: 1,
  kind: "command",
  purpose: "Create an approval-gated agent run and materialize its planned steps.",
  input: z.object({ managerRequestId: uuid, idempotencyKey }),
  output: z.object({ runId: uuid, stepCount: z.number().int().nonnegative(), created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.execution.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["execution.run_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["manager_request_not_found", "idempotency_conflict"],
});

export const approveAgentRunCapability = registerCapability({
  name: "execution.approve_agent_run",
  version: 1,
  kind: "command",
  purpose: "Approve an awaiting agent run and its pending steps for internal execution.",
  input: z.object({ runId: uuid, idempotencyKey }),
  output: z.object({ runId: uuid, approved: z.boolean(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.execution.approve" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["execution.run_approved"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["agent_run_not_found", "invalid_run_state"],
});

export const materializeAgentRunCapability = registerCapability({
  name: "execution.materialize_agent_run",
  version: 1,
  kind: "command",
  purpose: "Materialize an approved agent run into reviewable internal artifacts.",
  input: z.object({ runId: uuid, idempotencyKey }),
  output: z.object({ runId: uuid, completedSteps: z.number().int().nonnegative(), status: z.literal("completed") }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.execution.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["execution.run_materialized"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["agent_run_not_found", "invalid_run_state", "agent_step_failed"],
});

export const reviewAgentArtifactCapability = registerCapability({
  name: "execution.review_artifact",
  version: 1,
  kind: "command",
  purpose: "Record the human review state of an agent-generated artifact.",
  input: z.object({ artifactId: uuid, approvalState: z.enum(["approved", "rejected", "review"]), idempotencyKey }),
  output: z.object({ artifactId: uuid, approvalState: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.execution.review" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["execution.artifact_reviewed"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artifact_not_found"],
});
