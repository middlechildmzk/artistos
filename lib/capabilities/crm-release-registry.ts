import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);

export const updateOrganizationRelationshipCapability = registerCapability({
  name: "crm.update_organization_relationship",
  version: 1,
  kind: "command",
  purpose: "Update an organization's reversible CRM relationship stage and next action.",
  input: z.object({
    organizationId: uuid,
    relationshipStage: z.enum(["identified", "qualified", "pitched", "replied", "negotiating", "placed", "declined", "dormant"]),
    nextAction: z.string().trim().max(1000).nullable().optional(),
    nextActionDue: z.string().date().nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ organizationId: uuid, relationshipStage: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.crm.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["crm.relationship_updated"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["organization_not_found"],
});

export const createReleaseCapability = registerCapability({
  name: "releases.create",
  version: 1,
  kind: "command",
  purpose: "Create a release workspace with its standard readiness task spine.",
  input: z.object({
    artistId: uuid,
    title: z.string().trim().min(1).max(240),
    featuredArtist: z.string().trim().max(240).nullable().optional(),
    releaseDate: z.string().date().nullable().optional(),
    distributor: z.string().trim().max(240).nullable().optional(),
    label: z.string().trim().max(240).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ releaseId: uuid, created: z.boolean(), starterTaskCount: z.number().int() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.releases.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["releases.created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artist_not_found", "idempotency_conflict"],
});

export const updateReleaseCapability = registerCapability({
  name: "releases.update",
  version: 1,
  kind: "command",
  purpose: "Update release metadata and lifecycle state within the authorized workspace.",
  input: z.object({
    releaseId: uuid,
    title: z.string().trim().min(1).max(240),
    featuredArtist: z.string().trim().max(240).nullable().optional(),
    releaseDate: z.string().date().nullable().optional(),
    distributor: z.string().trim().max(240).nullable().optional(),
    label: z.string().trim().max(240).nullable().optional(),
    isrc: z.string().trim().max(40).nullable().optional(),
    upc: z.string().trim().max(40).nullable().optional(),
    spotifyUrl: z.string().url().nullable().optional(),
    status: z.enum(["draft", "upcoming", "released", "paused", "archived"]),
    notes: z.string().trim().max(10000).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ releaseId: uuid, status: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.releases.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["releases.updated"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found"],
});