import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";
import { searchLanes, sourceSlugs } from "@/lib/network-intelligence/source-runtime/types";

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();
const idempotencyKey = z.string().min(16);
const lane = z.enum(searchLanes);
const source = z.enum(sourceSlugs);

export const createOpportunitySearchCapability = registerCapability({
  name: "opportunity.create_search",
  version: 1,
  kind: "command",
  purpose: "Create a reviewable provider-neutral opportunity search plan from explicit human intake.",
  input: z.object({
    releaseId: nullableUuid,
    title: z.string().trim().min(1).max(240),
    query: z.string().trim().min(1).max(240),
    objective: z.string().trim().min(1).max(1000),
    fitContext: z.string().trim().max(1000).nullable().optional(),
    lanes: z.array(lane).min(1).max(searchLanes.length),
    sources: z.array(source).min(1).max(sourceSlugs.length),
    idempotencyKey,
  }),
  output: z.object({ searchId: uuid, laneCount: z.number().int().positive(), sourceCount: z.number().int().nonnegative(), created: z.literal(true) }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.opportunities.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["opportunity.search_created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found", "search_query_required", "source_not_registered"],
});

export const executeOpportunitySearchCapability = registerCapability({
  name: "opportunity.execute_search",
  version: 1,
  kind: "command",
  purpose: "Execute a human-approved source plan, preserve raw observations, and create review-only discoveries.",
  input: z.object({
    searchId: uuid,
    maxResultsPerLane: z.number().int().min(1).max(25).default(12),
    idempotencyKey,
  }),
  output: z.object({
    searchId: uuid,
    runId: uuid,
    discoveredCount: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    completedSources: z.number().int().nonnegative(),
    skippedSources: z.number().int().nonnegative(),
    failedSources: z.number().int().nonnegative(),
    status: z.enum(["completed", "partial", "failed"]),
  }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.opportunities.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["opportunity.search_executed"],
  retry: { ...defaultWriteRetry, maxAttempts: 2 },
  mcp: "gated_write",
  failureModes: ["opportunity_search_not_found", "source_search_failed", "source_policy_blocked"],
});

export const reviewOpportunityCapability = registerCapability({
  name: "opportunity.review",
  version: 1,
  kind: "command",
  purpose: "Record a human review decision for a discovery without silently creating or merging CRM records.",
  input: z.object({
    opportunityId: uuid,
    disposition: z.enum(["create_new", "enrich_existing", "merge_existing", "verify_more", "quarantine", "reject"]),
    matchedEntityType: z.enum(["organization", "person", "property"]).nullable().optional(),
    matchedEntityId: nullableUuid,
    matchCandidateId: nullableUuid,
    note: z.string().trim().max(2000).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ opportunityId: uuid, reviewStatus: z.string(), disposition: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.opportunities.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["opportunity.review_recorded"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["opportunity_not_found", "match_required", "match_candidate_not_found"],
});

export const promoteOpportunityToCrmCapability = registerCapability({
  name: "opportunity.promote_to_crm",
  version: 1,
  kind: "command",
  purpose: "Create or enrich an ArtistOS CRM organization from an accepted discovery and optionally assign it to a campaign.",
  input: z.object({
    opportunityId: uuid,
    campaignId: nullableUuid,
    idempotencyKey,
  }),
  output: z.object({ opportunityId: uuid, organizationId: uuid, propertyId: uuid.nullable(), campaignTargetId: uuid.nullable(), promoted: z.literal(true) }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.opportunities.promote" },
  risk: "R1_internal_reversible",
  approval: "always",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["opportunity.promoted_to_crm"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["opportunity_not_found", "opportunity_not_accepted", "merge_requires_dedicated_workflow", "campaign_not_found"],
});
