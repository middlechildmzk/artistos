import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);

export const updateCampaignTargetStatusCapability = registerCapability({
  name: "campaigns.update_target_status",
  version: 1,
  kind: "command",
  purpose: "Update a campaign target and synchronize its internal relationship state.",
  input: z.object({
    campaignTargetId: uuid,
    status: z.enum(["queued", "pitched", "replied", "accepted", "declined", "placed"]),
    idempotencyKey,
  }),
  output: z.object({ campaignTargetId: uuid, status: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.campaigns.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["campaigns.target_status_changed"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["campaign_target_not_found", "invalid_transition"],
});

export const recordCampaignReplyCapability = registerCapability({
  name: "campaigns.record_reply",
  version: 1,
  kind: "command",
  purpose: "Record an inbound campaign reply and synchronize campaign and relationship state.",
  input: z.object({
    campaignTargetId: uuid,
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().max(12000).nullable().optional(),
    replyStatus: z.enum(["replied", "interested", "accepted", "declined"]),
    idempotencyKey,
  }),
  output: z.object({ interactionId: uuid, campaignTargetId: uuid, status: z.string() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.interactions.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["campaigns.reply_recorded"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["campaign_target_not_found", "interaction_insert_failed"],
});

export const recordCampaignOutcomeCapability = registerCapability({
  name: "campaigns.record_outcome",
  version: 1,
  kind: "command",
  purpose: "Record a campaign outcome with a first-class evidence record and synchronize placement state.",
  input: z.object({
    campaignTargetId: uuid,
    outcomeType: z.string().trim().min(1).max(120),
    outcomeDate: z.string().date(),
    evidenceSummary: z.string().trim().min(1).max(4000),
    url: z.string().url().nullable().optional(),
    confidence: z.enum(["verified", "supported", "weak", "unknown"]),
    idempotencyKey,
  }),
  output: z.object({ outcomeId: uuid, evidenceId: uuid, campaignTargetId: uuid, status: z.literal("placed") }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.campaigns.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "required",
  auditEvents: ["campaigns.outcome_recorded", "evidence.created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["campaign_target_not_found", "evidence_missing", "outcome_insert_failed"],
});
