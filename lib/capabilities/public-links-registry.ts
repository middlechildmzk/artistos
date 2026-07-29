import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

export const capturePublicLinkFanCapability = registerCapability({
  name: "public_links.capture_fan",
  version: 1,
  kind: "command",
  purpose: "Capture explicit fan consent from an active public ArtistOS release link.",
  input: z.object({
    linkId: z.string().uuid(),
    email: z.string().email().max(320),
    firstName: z.string().trim().max(80).nullable(),
    utmSource: z.string().trim().max(160).nullable(),
    utmMedium: z.string().trim().max(160).nullable(),
    utmCampaign: z.string().trim().max(160).nullable(),
    emailConsent: z.literal(true),
    privacyAcknowledged: z.literal(true),
    idempotencyKey: z.string().min(24),
  }),
  output: z.object({
    fanId: z.string().uuid(),
    linkId: z.string().uuid(),
    created: z.boolean(),
    consentRecords: z.number().int().min(2),
  }),
  scope: { resource: "workspace", minRole: "viewer" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["public_links.fan_captured"],
  retry: defaultWriteRetry,
  mcp: "prohibited",
  failureModes: ["link_not_found", "capture_disabled", "idempotency_conflict", "fan_capture_failed"],
});
