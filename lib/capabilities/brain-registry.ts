import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);
const confidence = z.enum(["verified","supported","weak","unknown","stale","conflicting"]);

export const createBrainMemoryCapability = registerCapability({
  name: "brain.create_memory",
  version: 1,
  kind: "command",
  purpose: "Create a versioned semantic, episodic, or learned Artist Brain memory.",
  input: z.object({
    artistId: uuid.nullable().optional(),
    memoryClass: z.enum(["semantic","episodic","learned"]),
    namespace: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(240),
    summary: z.string().trim().max(4000).nullable().optional(),
    content: z.record(z.unknown()).default({}),
    sourceKind: z.enum(["human","import","capability","integration","inference","evaluation"]),
    confidence,
    observedAt: z.string().datetime().nullable().optional(),
    evidenceIds: z.array(uuid).max(50).default([]),
    idempotencyKey,
  }),
  output: z.object({ memoryId: uuid, claimId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.brain.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["brain.memory_created","brain.claim_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artist_not_found","evidence_not_found","idempotency_conflict"],
});

export const reviewBrainClaimCapability = registerCapability({
  name: "brain.review_claim",
  version: 1,
  kind: "command",
  purpose: "Accept, reject, or request evidence for an Artist Brain claim while preserving reviewer lineage.",
  input: z.object({
    claimId: uuid,
    reviewStatus: z.enum(["accepted","rejected","needs_evidence"]),
    reviewNote: z.string().trim().max(2000).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ claimId: uuid, reviewStatus: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.brain.review" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["brain.claim_reviewed"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["claim_not_found"],
});