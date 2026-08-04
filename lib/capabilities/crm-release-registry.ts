import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);
const nullableDate = z.string().date().nullable().optional();

export const updateOrganizationRelationshipCapability = registerCapability({
  name: "crm.update_organization_relationship", version: 1, kind: "command",
  purpose: "Update an organization's reversible CRM relationship stage and next action.",
  input: z.object({ organizationId: uuid, relationshipStage: z.enum(["identified", "qualified", "pitched", "replied", "negotiating", "placed", "declined", "dormant"]), nextAction: z.string().trim().max(1000).nullable().optional(), nextActionDue: nullableDate, idempotencyKey }),
  output: z.object({ organizationId: uuid, relationshipStage: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.crm.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional", auditEvents: ["crm.relationship_updated"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["organization_not_found"],
});

export const addOrganizationToCampaignCapability = registerCapability({
  name: "crm.add_organization_to_campaign", version: 1, kind: "command",
  purpose: "Add an organization to a campaign and advance its CRM next action.",
  input: z.object({ organizationId: uuid, campaignId: uuid, idempotencyKey }),
  output: z.object({ organizationId: uuid, campaignId: uuid, campaignTargetId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.crm.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional", auditEvents: ["crm.organization_added_to_campaign"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["organization_not_found", "campaign_not_found"],
});

export const logOutboundOutreachCapability = registerCapability({
  name: "crm.log_outbound_outreach", version: 2, kind: "command",
  purpose: "Record completed human-approved outreach through an open, unsuppressed campaign route and preserve evidence.",
  input: z.object({ organizationId: uuid, campaignId: uuid, endpointId: uuid, channel: z.string().trim().min(1).max(80), subject: z.string().trim().min(1).max(500), body: z.string().trim().min(1).max(20000), followUpDue: nullableDate, assetLink: z.string().url().nullable().optional(), idempotencyKey }),
  output: z.object({ interactionId: uuid, organizationId: uuid, campaignTargetUpdated: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.interactions.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "required", auditEvents: ["crm.outreach_logged"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["organization_not_found", "campaign_not_found", "submission_endpoint_not_found", "submission_endpoint_not_open", "submission_endpoint_suppressed"],
});

export const createReleaseCapability = registerCapability({
  name: "releases.create", version: 1, kind: "command", purpose: "Create a release workspace with its standard readiness task spine.",
  input: z.object({ artistId: uuid, title: z.string().trim().min(1).max(240), featuredArtist: z.string().trim().max(240).nullable().optional(), releaseDate: nullableDate, distributor: z.string().trim().max(240).nullable().optional(), label: z.string().trim().max(240).nullable().optional(), idempotencyKey }),
  output: z.object({ releaseId: uuid, created: z.boolean(), starterTaskCount: z.number().int() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.releases.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional", auditEvents: ["releases.created"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["artist_not_found", "idempotency_conflict"],
});

export const updateReleaseCapability = registerCapability({
  name: "releases.update", version: 1, kind: "command", purpose: "Update release metadata and lifecycle state within the authorized workspace.",
  input: z.object({ releaseId: uuid, title: z.string().trim().min(1).max(240), featuredArtist: z.string().trim().max(240).nullable().optional(), releaseDate: nullableDate, distributor: z.string().trim().max(240).nullable().optional(), label: z.string().trim().max(240).nullable().optional(), isrc: z.string().trim().max(40).nullable().optional(), upc: z.string().trim().max(40).nullable().optional(), spotifyUrl: z.string().url().nullable().optional(), status: z.enum(["draft", "upcoming", "released", "paused", "archived"]), notes: z.string().trim().max(10000).nullable().optional(), idempotencyKey }),
  output: z.object({ releaseId: uuid, status: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.releases.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional", auditEvents: ["releases.updated"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["release_not_found"],
});

export const addReleaseAssetCapability = registerCapability({
  name: "releases.add_asset", version: 1, kind: "command", purpose: "Attach a release asset with workspace and artist lineage.",
  input: z.object({ releaseId: uuid, name: z.string().trim().min(1).max(300), assetType: z.string().trim().min(1).max(100), url: z.string().url().nullable().optional(), locationNote: z.string().trim().max(2000).nullable().optional(), status: z.string().trim().min(1).max(80), idempotencyKey }),
  output: z.object({ assetId: uuid, releaseId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.assets.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional", auditEvents: ["releases.asset_added"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["release_not_found"],
});

export const createReleaseCampaignCapability = registerCapability({
  name: "releases.create_campaign", version: 1, kind: "command", purpose: "Create an active campaign linked to a release.",
  input: z.object({ releaseId: uuid, name: z.string().trim().min(1).max(300), startDate: nullableDate, endDate: nullableDate, goals: z.string().trim().max(10000).nullable().optional(), idempotencyKey }),
  output: z.object({ campaignId: uuid, releaseId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.campaigns.write" }, risk: "R1_internal_reversible", approval: "by_policy", idempotency: "key_required", evidence: "optional", auditEvents: ["releases.campaign_created"], retry: defaultWriteRetry, mcp: "gated_write", failureModes: ["release_not_found"],
});
