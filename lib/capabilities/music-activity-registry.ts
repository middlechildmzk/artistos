import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const idempotencyKey = z.string().min(16);

export const verifySoundchartsSandboxCapability = registerCapability({
  name: "integrations.verify_soundcharts_sandbox",
  version: 1,
  kind: "command",
  purpose: "Verify the free read-only Soundcharts sandbox contract without storing credentials or claiming production coverage.",
  input: z.object({ idempotencyKey }),
  output: z.object({
    provider: z.literal("soundcharts"),
    environment: z.literal("sandbox"),
    requestAccepted: z.literal(true),
    resultCount: z.number().int().nonnegative(),
    dataScope: z.literal("limited_vendor_sandbox_dataset"),
    productionAccess: z.literal(false),
    credentialsStored: z.literal(false),
    checkedAt: z.string().datetime(),
    evidenceId: z.string().uuid(),
  }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.integrations.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "required",
  auditEvents: ["integrations.soundcharts_sandbox_verified"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: [
    "soundcharts_sandbox_path_not_allowed",
    "soundcharts_sandbox_request_failed",
    "soundcharts_sandbox_invalid_json",
    "user_context_required",
  ],
});
