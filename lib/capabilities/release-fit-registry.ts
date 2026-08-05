import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();
const idempotencyKey = z.string().min(16);

/**
 * Every capability here is an internal, reversible, workspace-scoped record of a
 * human decision. None of them contact anyone, submit anything, spend anything,
 * or create a CRM record. Promotion remains opportunity.promote_to_crm, which is
 * approval: "always".
 */

export const setReleaseSourcingProfileCapability = registerCapability({
  name: "release.set_sourcing_profile",
  version: 1,
  kind: "command",
  purpose: "Record release-level sourcing metadata on the existing release row. Omitted fields remain unknown.",
  input: z.object({
    releaseId: uuid,
    subgenreTags: z.array(z.string().trim().min(1).max(80)).max(24).nullable().optional(),
    moodTags: z.array(z.string().trim().min(1).max(80)).max(24).nullable().optional(),
    lyricalThemes: z.array(z.string().trim().min(1).max(120)).max(24).nullable().optional(),
    vocalType: z.enum(["vocal", "instrumental", "mixed"]).nullable().optional(),
    territoryFocus: z.array(z.string().trim().min(1).max(80)).max(40).nullable().optional(),
    primaryLanguage: z.string().trim().max(80).nullable().optional(),
    aiInvolvement: z.enum(["none", "assisted", "generated", "undisclosed"]).nullable().optional(),
    aiDisclosurePreference: z.enum(["always_disclose", "disclose_on_request", "not_applicable"]).nullable().optional(),
    artistSizeBand: z.enum(["emerging", "developing", "established"]).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ releaseId: uuid, updatedFields: z.array(z.string()), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.releases.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["release.sourcing_profile_updated"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found"],
});

export const upsertSimilarArtistCapability = registerCapability({
  name: "release.upsert_similar_artist",
  version: 1,
  kind: "command",
  purpose: "Record or confirm a comparable artist for a release, preserving source, identity, and confirmation state.",
  input: z.object({
    releaseId: uuid,
    artistName: z.string().trim().min(1).max(200),
    sourceSlug: z.string().trim().max(80).nullable().optional(),
    canonicalUrl: z.string().url().max(2000).nullable().optional(),
    externalIdentifiers: z.record(z.string().max(200)).default({}),
    confirmationState: z.enum(["user_confirmed", "inferred", "rejected"]),
    confidence: z.number().min(0).max(1).nullable().optional(),
    evidenceId: nullableUuid,
    observedAt: z.string().datetime().nullable().optional(),
    freshnessStatus: z.enum(["current", "aging", "stale", "unknown"]).nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({
    releaseId: uuid,
    similarArtistId: uuid,
    confirmationState: z.string(),
    usableAsFitEvidence: z.boolean(),
  }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.releases.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["release.similar_artist_recorded"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found", "stable_artist_identity_required"],
});

export const recordTargetDecisionCapability = registerCapability({
  name: "release.record_target_decision",
  version: 1,
  kind: "command",
  purpose: "Record a non-consequential human sourcing decision about a discovery for a release.",
  input: z.object({
    releaseId: uuid,
    opportunityId: uuid,
    decision: z.enum(["saved", "shortlisted", "hidden", "not_relevant", "verify_later", "do_not_recommend", "cleared"]),
    note: z.string().trim().max(2000).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ releaseId: uuid, opportunityId: uuid, decision: z.string(), shortlisted: z.boolean() }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.opportunities.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["release.target_decision_recorded"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found", "opportunity_not_found"],
});

export const updateShortlistItemCapability = registerCapability({
  name: "release.update_shortlist_item",
  version: 1,
  kind: "command",
  purpose: "Update rank, note, or proposed campaign on a shortlist item. Proposing a campaign records intent only.",
  input: z.object({
    releaseId: uuid,
    opportunityId: uuid,
    rank: z.number().int().min(0).max(999).nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    proposedCampaignId: nullableUuid,
    idempotencyKey,
  }),
  output: z.object({
    releaseId: uuid,
    opportunityId: uuid,
    readinessState: z.string(),
    blockingReasons: z.array(z.string()),
  }),
  scope: { resource: "workspace", minRole: "editor", grantPermission: "artist.opportunities.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["release.shortlist_item_updated"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["shortlist_item_not_found", "campaign_not_found"],
});
