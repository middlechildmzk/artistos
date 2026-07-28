import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);
const recommendationStatus = z.enum(["open", "accepted", "dismissed", "done"]);
const contentStatus = z.enum(["idea", "draft", "ready", "scheduled", "published", "archived"]);

export const createRecommendationCapability = registerCapability({
  name: "planner.create_recommendation",
  version: 1,
  kind: "command",
  purpose: "Create an evidence-aware internal recommendation for the artist workspace.",
  input: z.object({
    releaseId: uuid.nullable().optional(),
    title: z.string().trim().min(1).max(240),
    rationale: z.string().trim().max(4000).nullable().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    actionPath: z.string().trim().max(500).nullable().optional(),
    dueDate: z.string().date().nullable().optional(),
    evidenceIds: z.array(uuid).default([]),
    idempotencyKey,
  }),
  output: z.object({ recommendationId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.planner.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["planner.recommendation_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found", "evidence_not_found"],
});

export const updateRecommendationStatusCapability = registerCapability({
  name: "planner.update_recommendation_status",
  version: 1,
  kind: "command",
  purpose: "Update the lifecycle state of an internal recommendation.",
  input: z.object({ recommendationId: uuid, status: recommendationStatus, idempotencyKey }),
  output: z.object({ recommendationId: uuid, status: recommendationStatus, changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.planner.write" },
  risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional",
  auditEvents: ["planner.recommendation_status_updated"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["recommendation_not_found"],
});

export const createContentIdeaCapability = registerCapability({
  name: "planner.create_content_idea",
  version: 1,
  kind: "command",
  purpose: "Create a content concept linked to an artist or release.",
  input: z.object({
    artistId: uuid.nullable().optional(), releaseId: uuid.nullable().optional(),
    platform: z.string().trim().min(1).max(80), format: z.string().trim().min(1).max(80),
    hook: z.string().trim().min(1).max(500), concept: z.string().trim().max(4000).nullable().optional(),
    caption: z.string().trim().max(10000).nullable().optional(), status: contentStatus,
    scheduledFor: z.string().datetime().nullable().optional(), idempotencyKey,
  }),
  output: z.object({ contentIdeaId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.content.write" },
  risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional",
  auditEvents: ["planner.content_idea_created"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["artist_not_found", "release_not_found"],
});

export const updateContentIdeaStatusCapability = registerCapability({
  name: "planner.update_content_idea_status",
  version: 1,
  kind: "command",
  purpose: "Update a content idea lifecycle state without bypassing the runtime.",
  input: z.object({ contentIdeaId: uuid, status: contentStatus, idempotencyKey }),
  output: z.object({ contentIdeaId: uuid, status: contentStatus, changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.content.write" },
  risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional",
  auditEvents: ["planner.content_idea_status_updated"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["content_idea_not_found"],
});

export const recordMetricSnapshotCapability = registerCapability({
  name: "analytics.record_metric_snapshot",
  version: 1,
  kind: "command",
  purpose: "Record a dated metric snapshot with optional source evidence.",
  input: z.object({
    artistId: uuid.nullable().optional(), releaseId: uuid.nullable().optional(), platform: z.string().trim().min(1).max(80),
    metric: z.string().trim().min(1).max(120), value: z.number().finite(), capturedOn: z.string().date(), sourceUrl: z.string().url().nullable().optional(),
    evidenceIds: z.array(uuid).default([]), idempotencyKey,
  }),
  output: z.object({ metricSnapshotId: uuid, recorded: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional",
  auditEvents: ["analytics.metric_recorded"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["artist_not_found", "release_not_found", "evidence_not_found"],
});

export const createAutomationPlanCapability = registerCapability({
  name: "planner.create_automation_plan",
  version: 1,
  kind: "command",
  purpose: "Create a non-executing automation plan for later evaluation and approval.",
  input: z.object({
    name: z.string().trim().min(1).max(240),
    triggerType: z.enum(["release_date", "reply_received", "outcome_recorded", "follow_up_due", "metric_threshold", "content_published"]),
    triggerDetail: z.string().trim().max(4000).nullable().optional(),
    actionType: z.enum(["create_task", "create_recommendation", "update_relationship", "create_content_idea", "notify_owner"]),
    actionDetail: z.string().trim().max(4000).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ automationRuleId: uuid, created: z.boolean(), executionMode: z.literal("plan_only") }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.automations.write" },
  risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional",
  auditEvents: ["planner.automation_plan_created"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: [],
});

export const setAutomationPlanEnabledCapability = registerCapability({
  name: "planner.set_automation_plan_enabled",
  version: 1,
  kind: "command",
  purpose: "Enable or disable a stored automation plan without executing it.",
  input: z.object({ automationRuleId: uuid, enabled: z.boolean(), idempotencyKey }),
  output: z.object({ automationRuleId: uuid, enabled: z.boolean(), changed: z.boolean(), executionMode: z.literal("plan_only") }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.automations.write" },
  risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional",
  auditEvents: ["planner.automation_plan_state_updated"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["automation_rule_not_found"],
});
