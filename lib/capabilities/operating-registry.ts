import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();
const idempotencyKey = z.string().min(16);

export const addLegacyBrainFactCapability = registerCapability({
  name: "operating.add_brain_fact",
  version: 1,
  kind: "command",
  purpose: "Add a human-supplied fact to the legacy Artist Brain during the v1-to-v2 transition.",
  input: z.object({
    artistId: nullableUuid,
    releaseId: nullableUuid,
    category: z.string().trim().min(1).max(120),
    confidence: z.enum(["verified", "supported", "weak", "unknown", "conflicting"]),
    source: z.string().trim().max(500).nullable().optional(),
    fact: z.string().trim().min(1).max(4000),
    idempotencyKey,
  }),
  output: z.object({ factId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.brain.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["operating.brain_fact_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artist_not_found", "release_not_found"],
});

export const createManagerRequestCapability = registerCapability({
  name: "operating.create_manager_request",
  version: 1,
  kind: "command",
  purpose: "Convert a human operating request into a deterministic cross-functional plan.",
  input: z.object({ requestText: z.string().trim().min(1).max(8000), releaseId: nullableUuid, idempotencyKey }),
  output: z.object({ requestId: uuid, stepCount: z.number().int().positive(), created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.manager.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["operating.manager_request_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found"],
});

export const updateManagerRequestCapability = registerCapability({
  name: "operating.update_manager_request",
  version: 1,
  kind: "command",
  purpose: "Move a manager request through its controlled internal lifecycle.",
  input: z.object({ requestId: uuid, status: z.enum(["planned", "in_progress", "blocked", "done", "cancelled"]), idempotencyKey }),
  output: z.object({ requestId: uuid, status: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.manager.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["operating.manager_request_updated"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["manager_request_not_found"],
});

export const generateReleaseTimelineCapability = registerCapability({
  name: "operating.generate_release_timeline",
  version: 1,
  kind: "command",
  purpose: "Generate the standard ArtistOS release timeline for a dated release.",
  input: z.object({ releaseId: uuid, releaseDate: z.string().date(), idempotencyKey }),
  output: z.object({ releaseId: uuid, milestoneCount: z.number().int().positive(), generated: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.releases.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["operating.release_timeline_generated"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found"],
});

export const scorePromotionOpportunitiesCapability = registerCapability({
  name: "operating.score_promotion_opportunities",
  version: 1,
  kind: "command",
  purpose: "Calculate explainable promotion opportunity scores from current workspace evidence.",
  input: z.object({ releaseId: nullableUuid, idempotencyKey }),
  output: z.object({ scoredCount: z.number().int().nonnegative(), recorded: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.opportunities.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["operating.opportunities_scored"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found"],
});

export const createAnalyticsInsightCapability = registerCapability({
  name: "operating.create_analytics_insight",
  version: 1,
  kind: "command",
  purpose: "Create a human-authored analytics insight linked to a release when applicable.",
  input: z.object({
    releaseId: nullableUuid,
    insightType: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(240),
    narrative: z.string().trim().min(1).max(8000),
    confidence: z.number().min(0).max(1),
    idempotencyKey,
  }),
  output: z.object({ insightId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["operating.analytics_insight_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found"],
});
