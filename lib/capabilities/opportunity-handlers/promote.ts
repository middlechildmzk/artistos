import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "../handlers";
import { promoteOpportunityToCrmCapability } from "../opportunity-registry";
import { orgCategory, readReplay, writeReplay } from "./shared";

type MatchedEntityType = "organization" | "person" | "property";

async function resolveReviewedEntity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  workspaceId: string,
  entityType: MatchedEntityType,
  entityId: string,
) {
  if (entityType === "organization") {
    const { data, error } = await supabase.from("organizations").select("id").eq("workspace_id", workspaceId).eq("id", entityId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("matched_entity_not_found");
    return { organizationId: data.id, propertyId: null as string | null };
  }
  if (entityType === "property") {
    const { data, error } = await supabase.from("properties").select("id,organization_id").eq("workspace_id", workspaceId).eq("id", entityId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("matched_entity_not_found");
    if (!data.organization_id) throw new Error("matched_property_has_no_organization");
    return { organizationId: data.organization_id, propertyId: data.id };
  }
  const { data, error } = await supabase.from("people").select("id,organization_id").eq("workspace_id", workspaceId).eq("id", entityId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("matched_entity_not_found");
  if (!data.organization_id) throw new Error("matched_person_has_no_organization");
  return { organizationId: data.organization_id, propertyId: null as string | null };
}

registerCapabilityHandler(promoteOpportunityToCrmCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, promoteOpportunityToCrmCapability.name, key);
  if (replay && typeof replay === "object" && "organizationId" in replay) return { output: replay as never, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: opportunity, error } = await supabase.from("opportunities").select("*").eq("workspace_id", ctx.workspaceId).eq("id", input.opportunityId).maybeSingle();
  if (error) throw error;
  if (!opportunity) throw new Error("opportunity_not_found");
  if (opportunity.review_status !== "accepted" || !["create_new", "enrich_existing", "merge_existing"].includes(opportunity.review_disposition)) throw new Error("opportunity_not_accepted");
  if (opportunity.review_disposition === "merge_existing") throw new Error("merge_requires_dedicated_workflow");

  let organizationId: string | null = null;
  let propertyId: string | null = null;

  if (opportunity.review_disposition === "enrich_existing") {
    if (!opportunity.matched_entity_type || !opportunity.matched_entity_id) throw new Error("match_required");
    const resolved = await resolveReviewedEntity(supabase, ctx.workspaceId, opportunity.matched_entity_type as MatchedEntityType, opportunity.matched_entity_id);
    organizationId = resolved.organizationId;
    propertyId = resolved.propertyId;
  } else {
    const { data: created, error: createError } = await supabase.from("organizations").insert({
      workspace_id: ctx.workspaceId,
      canonical_name: opportunity.title,
      display_name: opportunity.title,
      org_type: opportunity.opportunity_type,
      org_category: orgCategory(opportunity.opportunity_type),
      website: opportunity.canonical_url ?? opportunity.source_url,
      activity_status: "unknown",
      trust_tier: null,
      risk_tier: "unknown",
      verification_status: "unverified",
      evidence_strength: 1,
      primary_source_url: opportunity.source_url,
      notes: `Human-approved creation from ${opportunity.source_slug ?? "source"} identity discovery ${opportunity.external_id ?? ""}. Submission eligibility and outreach permission remain unverified. ${opportunity.summary ?? ""}`.trim(),
      relationship_stage: "identified",
    }).select("id").single();
    if (createError) throw createError;
    organizationId = created.id;
  }

  if (!propertyId && opportunity.candidate_kind === "property") {
    const { data: created, error: createError } = await supabase.from("properties").insert({
      workspace_id: ctx.workspaceId,
      organization_id: organizationId,
      name: opportunity.title,
      property_type: opportunity.opportunity_type,
      platform: opportunity.source_slug,
      url: opportunity.canonical_url ?? opportunity.source_url,
      platform_url: opportunity.canonical_url ?? opportunity.source_url,
      activity_status: "unknown",
      verification_status: "unverified",
      evidence_strength: 1,
      notes: "Human-approved identity promotion from Opportunity Intelligence. Submission eligibility and outreach permission remain unverified.",
      raw_record: {
        source_slug: opportunity.source_slug,
        external_id: opportunity.external_id,
        canonical_url: opportunity.canonical_url,
        opportunity_id: opportunity.id,
        observed_at: opportunity.last_verified_at,
      },
      relationship_stage: "identified",
    }).select("id").single();
    if (createError) throw createError;
    propertyId = created.id;
  }

  let campaignTargetId: string | null = null;
  if (input.campaignId) {
    const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.campaignId).maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) throw new Error("campaign_not_found");
    const { data: target, error: targetError } = await supabase.from("campaign_targets").upsert({
      workspace_id: ctx.workspaceId,
      campaign_id: campaign.id,
      target_kind: "organization",
      target_id: organizationId,
      status: "queued",
      notes: `Promoted from opportunity ${opportunity.id}.`,
    }, { onConflict: "campaign_id,target_kind,target_id" }).select("id").single();
    if (targetError) throw targetError;
    campaignTargetId = target.id;
  }

  const { error: updateError } = await supabase.from("opportunities").update({ organization_id: organizationId, status: "promoted_to_crm", review_status: "promoted", updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", opportunity.id);
  if (updateError) throw updateError;
  const result = { opportunityId: opportunity.id, organizationId, propertyId, campaignTargetId, promoted: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: promoteOpportunityToCrmCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: opportunity.evidence_ids ?? [] };
});
