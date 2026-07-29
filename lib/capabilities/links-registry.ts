import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);
const slug = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens only");

export const saveSmartLinkCapability = registerCapability({
  name: "links.save",
  version: 1,
  kind: "command",
  purpose: "Create or update the canonical ArtistOS smart link attached to a release.",
  input: z.object({
    releaseId: uuid,
    slug,
    mode: z.enum(["presave", "live", "private"]),
    headline: z.string().trim().max(300).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    captureEmail: z.boolean(),
    isActive: z.boolean(),
    idempotencyKey,
  }),
  output: z.object({ smartLinkId: uuid, releaseId: uuid, slug, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.links.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["links.saved"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found", "slug_taken", "idempotency_conflict"],
});

export const saveSmartLinkDestinationCapability = registerCapability({
  name: "links.save_destination",
  version: 1,
  kind: "command",
  purpose: "Add or update a streaming destination on an authorized ArtistOS smart link.",
  input: z.object({
    smartLinkId: uuid,
    service: z.string().trim().min(1).max(80),
    url: z.string().url(),
    position: z.number().int().min(0).max(100),
    isActive: z.boolean(),
    idempotencyKey,
  }),
  output: z.object({ destinationId: uuid, smartLinkId: uuid, service: z.string(), created: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.links.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["links.destination_saved"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["smart_link_not_found", "idempotency_conflict"],
});
