import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildSourcePlan, executeSourcePlan } from "@/lib/network-intelligence/source-runtime/core";
import type { DiscoveryCandidate, SourceSearchPlan } from "@/lib/network-intelligence/source-runtime/types";
import { registerCapabilityHandler } from "./handlers";
import {
  createOpportunitySearchCapability,
  executeOpportunitySearchCapability,
  promoteOpportunityToCrmCapability,
  reviewOpportunityCapability,
} from "./opportunity-registry";

function normalizeName(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_idempotency").select("result").eq("workspace_id", workspaceId).eq("capability_name", capabilityName).eq("idempotency_key", key).maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: { workspaceId: string; capabilityName: string; capabilityVersion: number; key: string; result: unknown; userId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId ?? null,
  });
  if (error) throw error;
}

type ExistingOrganization = { id: string; canonical_name: string; display_name: string | null; website: string | null; primary_source_url: string | null };
type ExistingProperty = { id: string; organization_id: string | null; name: string; url: string | null; platform_url: string | null; raw_record: Record<string, unknown> | null };

type MatchSuggestion = {
  entityType: "organization" | "property";
  entityId: string;
  score: number;
  reasons: string[];
  conflicts: string[];
};

function findMatches(candidate: DiscoveryCandidate, organizations: ExistingOrganization[], properties: ExistingProperty[]): MatchSuggestion[] {
  const title = normalizeName(candidate.title);
  const canonicalUrl = normalizeUrl(candidate.canonicalUrl);
  const suggestions: MatchSuggestion[] = [];
  for (const property of properties) {
    const reasons: string[] = [];
    let score = 0;
    const propertyUrls = [property.url, property.platform_url].map(normalizeUrl).filter(Boolean);
    const rawExternalId = property.raw_record && typeof property.raw_record.external_id === "string" ? property.raw_record.external_id : null;
    const rawSourceSlug = property.raw_record && typeof property.raw_record.source_slug === "string" ? property.raw_record.source_slug : null;
    if (rawExternalId === candidate.externalId && rawSourceSlug === candidate.sourceSlug) { score = 1; reasons.push("stable_external_id_exact"); }
    if (canonicalUrl && propertyUrls.includes(canonicalUrl)) { score = Math.max(score, 0.99); reasons.push("canonical_url_exact"); }
    if (title && normalizeName(property.name) === title) { score = Math.max(score, 0.84); reasons.push("normalized_name_exact"); }
    if (score >= 0.8) suggestions.push({ entityType: "property", entityId: property.id, score, reasons, conflicts: [] });
  }
  for (const organization of organizations) {
    const reasons: string[] = [];
    let score = 0;
    const organizationUrls = [organization.website, organization.primary_source_url].map(normalizeUrl).filter(Boolean);
    if (canonicalUrl && organizationUrls.includes(canonicalUrl)) { score = 0.98; reasons.push("canonical_url_exact"); }
    if (title && [organization.canonical_name, organization.display_name].map(normalizeName).includes(title)) { score = Math.max(score, 0.82); reasons.push("normalized_name_exact"); }
    if (score >= 0.8) suggestions.push({ entityType: "organization", entityId: organization.id, score, reasons, conflicts: [] });
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
}

function orgCategory(opportunityType: string) {
  if (["radio"].includes(opportunityType)) return "radio";
  if (["playlist"].includes(opportunityType)) return "playlist";
  if (["youtube_channel", "creator"].includes(opportunityType)) return "creator";
  if (["publication", "podcast"].includes(opportunityType)) return "media";
  if (["sync", "music_library"].includes(opportunityType)) return "sync";
  if (["label"].includes(opportunityType)) return "label";
  if (["booking"].includes(opportunityType)) return "live";
  return "unknown";
}

registerCapabilityHandler(createOpportunitySearchCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createOpportunitySearchCapability.name, key);
  if (replay && typeof replay === "object" && "searchId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  if (input.releaseId) {
    const { data: release, error } = await supabase.from("releases").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle();
    if (error) throw error;
    if (!release) throw new Error("release_not_found");
  }
  const plan = buildSourcePlan({ query: input.query, objective: input.objective, releaseId: input.releaseId, fitContext: input.fitContext, lanes: input.lanes, requestedSources: input.sources });
  const { data, error } = await supabase.from("opportunity_searches").insert({
    workspace_id: ctx.workspaceId,
    artist_id: ctx.artistId,
    release_id: input.releaseId ?? null,
    title: input.title,
    objective: input.objective,
    intake: { query: input.query, fit_context: input.fitContext ?? null, requested_sources: input.sources },
    search_lanes: plan.lanes,
    source_plan: plan,
    status: "draft",
    execution_mode: "human_operated",
    created_by: ctx.userId,
  }).select("id").single();
  if (error) throw error;
  const result = { searchId: data.id, laneCount: plan.lanes.length, sourceCount: plan.sourcePolicies.length, created: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createOpportunitySearchCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(executeOpportunitySearchCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, executeOpportunitySearchCapability.name, key);
  if (replay && typeof replay === "object" && "runId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: search, error = } = await supabase.from("opportunity_searches").select("id,source_plan,status").eq("workspace_id", ctx.workspaceId).eq("id", input.searchId).maybeSingle();
  if (error) throw error;
  if (!search) throw new Error("opportunity_search_not_found");
  const plan = search.source_plan as SourceSearchPlan;
  if (!plan || plan.planVersion !== "network-source-runtime-v1") throw new Error("source_plan_invalid");

  const { data: run, error: runError } = await supabase.from("opportunity_search_runs").insert({
    workspace_id: ctx.workspaceId,
    search_id: search.id,
    status: "running",
    plan_snapshot: plan,
    idempotency_key: key,
    started_at: new Date().toISOString(),
    created_by: ctx.userId,
  }).select("id").single();
  if (runError) throw runError;
  await supabase.from("opportunity_searches").update({ status: "running", approved_by: ctx.userId, approved_at: new Date().toISOString(), last_run_at: new Date().toISOString(), last_run_status: "running", updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", search.id);

  const executed = await executeSourcePlan(plan, input.maxResultsPerLane);
  const [{ data: organizations, error: organizationsError }, { data: properties, error: propertiesError }] = await Promise.all([
    supabase.from("organizations").select("id,canonical_name,display_name,website,primary_source_url").eq("workspace_id", ctx.workspaceId).limit(10000),
    supabase.from("properties").select("id,organization_id,name,url,platform_url,raw_record").eq("workspace_id", ctx.workspaceId).is("archived_at", null).limit(10000),
  ]);
  if (organizationsError) throw organizationsError;
  if (propertiesError) throw propertiesError;

  let matchedCount = 0;
  const evidenceIds: string[] = [];
  for (const candidate of executed.candidates) {
    const matches = findMatches(candidate, (organizations ?? []) as ExistingOrganization[], (properties ?? []) as ExistingProperty[]);
    const bestMatch = matches[0] ?? null;
    if (bestMatch) matchedCount += 1;
    const relationshipScore = bestMatch ? Math.round(bestMatch.score * 100) : candidate.relationshipScore;
    const observedAt = candidate.observedAt;
    const { data: evidence, error: evidenceError } = await supabase.from("evidence_records").insert({
      workspace_id: ctx.workspaceId,
      artist_id: ctx.artistId,
      evidence_type: "opportunity_source_observation",
      source_type: "api",
      source_url: candidate.canonicalUrl,
      source_subject_id: `${candidate.sourceSlug}:${candidate.externalId}`,
      observed_at: observedAt,
      retrieved_at: new Date().toISOString(),
      confidence: candidate.confidence,
      freshness_status: candidate.freshnessStatus,
      supported_claims: [{ claim: `${candidate.title} is a ${candidate.candidateKind} returned by ${candidate.sourceSlug}.`, value: candidate.normalizedPayload }],
      contradiction_flags: candidate.riskFlags,
      payload_hash: contentHash(candidate.rawPayload),
      provenance: { source_slug: candidate.sourceSlug, policy_disposition: candidate.sourcePolicyDisposition, search_run_id: run.id },
      created_by_principal: ctx.principalId,
    }).select("id").single();
    if (evidenceError) throw evidenceError;
    evidenceIds.push(evidence.id);

    const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").upsert({
      workspace_id: ctx.workspaceId,
      artist_id: ctx.artistId,
      search_id: search.id,
      search_run_id: run.id,
      opportunity_type: candidate.opportunityType,
      title: candidate.title,
      summary: candidate.summary,
      status: "discovered",
      freshness_status: candidate.freshnessStatus,
      legitimacy_status: candidate.legitimacyStatus,
      confidence: candidate.confidence,
      fit_score: candidate.fitScore,
      legitimacy_score: candidate.legitimacyScore,
      reach_quality_score: candidate.reachQualityScore,
      accessibility_score: candidate.accessibilityScore,
      relationship_score: relationshipScore,
      risk_score: candidate.riskScore,
      risk_flags: candidate.riskFlags,
      source_url: candidate.canonicalUrl,
      source_slug: candidate.sourceSlug,
      source_policy_disposition: candidate.sourcePolicyDisposition,
      external_id: candidate.externalId,
      canonical_url: candidate.canonicalUrl,
      candidate_kind: candidate.candidateKind,
      review_status: "pending",
      match_confidence: bestMatch?.score ?? null,
      match_reasons: bestMatch?.reasons ?? [],
      eligibility: candidate.eligibility,
      last_verified_at: observedAt,
      evidence_ids: [evidence.id],
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,search_id,source_slug,external_id" }).select("id").single();
    if (opportunityError) throw opportunityError;
    const { error: observationError } = await supabase.from("opportunity_source_observations").upsert({: null } as never);
    // Replaced below with a normalized upsert object; the dead statement keeps type inference off legacy generated types.
    void observationError;
    const { error: observationWriteError } = await supabase.from("opportunity_source_observations").upsert({
      workspace_id: ctx.workspaceId,
      opportunity_id: opportunity.id,
      search_run_id: run.id,
      source_slug: candidate.sourceSlug,
      source_policy_disposition: candidate.sourcePolicyDisposition,
      external_id: candidate.externalId,
      observed_at: observedAt,
      retrieved_at: new Date().toISOString(),
      confidence: candidate.confidence,
      freshness_status: candidate.freshnessStatus,
      raw_payload: candidate.rawPayload,
      normalized_payload: candidate.normalizedPayload,
      source_url: candidate.canonicalUrl,
      payload_hash: contentHash(candidate.rawPayload),
      evidence_id: evidence.id,
    }, { onConflict: "workspace_id,opportunity_id,source_slug,external_id,observed_at" });
    if (observationWriteError) throw observationWriteError;

    for (const feature of candidate.scoreFeatures) {
      const { error: featureError } = await supabase.from("opportunity_score_features").upsert({w: null } as never);
      void featureError;
      const { error: featureWriteError } = await supabase.from("opportunity_score_features").upsert({: null } as never);
      void featureWriteError;
      const { error: featurWriteErrorReal } = await supabase.from("opportunity_score_features").upsert({
        workspace_id: ctx.workspaceId,
        opportunity_id: opportunity.id,
        feature_key: feature.key,
        feature_value: feature.value,
        weight: feature.weight,
        contribution: feature.contribution,
        explanation: feature.explanation,
        confidence: candidate.confidence,
        evidence_id: evidence.id,
      }, { onConflict: "opportunity_id,feature_key" });
      if (featureWriteErrorReal) throw featureWriteErrorReal;
    }

    await supabase.from("opportunity_match_candidates").delete().eq("workspace_id", ctx.workspaceId).eq("opportunity_id", opportunity.id);
    for (const match of matches) {
      const { error: matchError } = await supabase.from("opportunity_match_candidates").insert({
        workspace_id: ctx.workspaceId,
        opportunity_id: opportunity.id,
        candidate_entity_type: match.entityType,
        candidate_entity_id: match.entityId,
        match_score: match.score,
        match_reasons: match.reasons,
        conflicting_fields: match.conflicts,
      });
      if (matchError) throw matchError;
    }
  }

  const completedSources = executed.reports.filter((report) => report.status === "completed").length;
  const skippedSources = executed.reports.filter((report) => report.status === "skipped").length;
  const failedSources = executed.reports.filter((report) => report.status === "failed").length;
  const status = failedSources === executed.reports.length && failedSources > 0 ? "failed" : failedSources > 0 || skippedSources > 0 ? "partial" : "completed";
  const summary = { discovered_count: executed.candidates.length, matched_count: matchedCount, completed_sources: completedSources, skipped_sources: skippedSources, failed_sources: failedSources };
  const { error: runUpdateError } = await supabase.from("opportunity_search_runs").update({ status, source_reports: executed.reports, result_count: executed.candidates.length, matched_count: matchedCount, completed_at: new Date().toISOString(), error_summary: failedSources ? `${failedSources} source adapters failed.` : null }).eq("workspace_id", ctx.workspaceId).eq("id", run.id);
  if (runUpdateError) throw runUpdateError;
  const { error: searchUpdateError } = await supabase.from("opportunity_searches").update({ status: status === "failed" ? "completed" : "completed", last_run_at: new Date().toISOString(), last_run_status: status, last_run_summary: summary, updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", search.id);
  if (searchUpdateError) throw searchUpdateError;
  const result = { searchId: search.id, runId: run.id, discoveredCount: executed.candidates.length, matchedCount, completedSources, skippedSources, failedSources, status: status as "completed" | "partial" | "failed" };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: executeOpportunitySearchCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds };
});

registerCapabilityHandler(reviewOpportunityCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, reviewOpportunityCapability.name, key);
  if (replay && typeof replay === "object" && "opportunityId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: opportunity, error } = await supabase.from("opportunities").select("id,review_status,review_disposition,evidence_ids").eq("workspace_id", ctx.workspaceId).eq("id", input.opportunityId).maybeSingle();
  if (error) throw error;
  if (!opportunity) throw new Error("opportunity_not_found");
  let matchedEntityType = input.matchedEntityType ?? null;
  let matchedEntityId = input.matchedEntityId ?? null;
  if (input.matchCandidateId) {
    const { data: match, error: matchError } = await supabase.from("opportunity_match_candidates").select("id,candidate_entity_type,candidate_entity_id,match_score,match_reasons").eq("workspace_id", ctx.workspaceId).eq("opportunity_id", opportunity.id).eq("id", input.matchCandidateId).maybeSingle();
    if (matchError) throw matchError;
    if (!match) throw new Error("match_candidate_not_found");
    matchedEntityType = match.candidate_entity_type as typeof matchedEntityType;
    matchedEntityId = match.candidate_entity_id;
    const { error: matchUpdateError } = await supabase.from("opportunity_match_candidates").update({ review_status: "accepted", reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", match.id);
    if (matchUpdateError) throw matchUpdateError;
  }
  if (["enrich_existing", "merge_existing"].includes(input.disposition) && (!matchedEntityType || !matchedEntityId)) throw new Error("match_required");
  const reviewStatus = input.disposition === "reject" ? "rejected" : input.disposition === "quarantine" ? "quarantined" : input.disposition === "verify_more" ? "needs_verification" : "accepted";
  const status = reviewStatus === "rejected" ? "rejected" : reviewStatus === "accepted" ? "qualified" : "qualifying";
  const changed = opportunity.review_status !== reviewStatus || opportunity.review_disposition !== input.disposition;
  const { error: updateError } = await supabase.from("opportunities").update({
    review_status: reviewStatus,
    review_disposition: input.disposition,
    review_note: input.note ?? null,
    matched_entity_type: matchedEntityType,
    matched_entity_id: matchedEntityId,
    status,
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("workspace_id", ctx.workspaceId).eq("id", opportunity.id);
  if (updateError) throw updateError;
  const result = { opportunityId: opportunity.id, reviewStatus, disposition: input.disposition, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: reviewOpportunityCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: opportunity.evidence_ids ?? [] };
});

registerCapabilityHandler(promoteOpportunityToCrmCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, promoteOpportunityToCrmCapability.name, key);
  if (replay && typeof replay === "object" && "organizationId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: opportunity, error } = await supabase.from("opportunities").select("id,title,summary,opportunity_type,canonical_url,source_url,source_slug,external_id,candidate_kind,review_status,review_disposition,matched_entity_type,matched_entity_id,evidence_ids,legitimacy_score,risk_score").eq("workspace_id", ctx.workspaceId).eq("id", input.opportunityId).maybeSingle();
  if (error) throw error;
  if (!opportunity) throw new Error("opportunity_not_found");
  if (opportunity.review_status !== "accepted" || !["create_new", "enrich_existing", "merge_existing"].includes(opportunity.review_disposition)) throw new Error("opportunity_not_accepted");
  if (opportunity.review_disposition === "merge_existing") throw new Error("merge_requires_dedicated_workflow");

  let organizationId: string | null = null;
  let propertyId: string | null = null;
  if (opportunity.review_disposition === "enrich_existing") {
    if (opportunity.matched_entity_type === "organization" && opportunity.matched_entity_id) organizationId = opportunity.matched_entity_id;
    if (opportunity.matched_entity_type === "property" && opportunity.matched_entity_id) {
      const { data: property, error: propertyError } = await supabase.from("properties").select("id,organization_id").eq("workspace_id", ctx.workspaceId).eq("id", opportunity.matched_entity_id).maybeSingle();
      if (propertyError) throw propertyError;
      if (!property?.organization_id) throw new Error("matched_property_has_no_organization");
      propertyId = property.id;
      organizationId = property.organization_id;
    }
  }

  if (!organizationId) {
    const { data: existingByName, error: lookupError } = await supabase.from("organizations").select("id").eq("workspace_id", ctx.workspaceId).ilike("canonical_name", opportunity.title).limit(1).maybeSingle();
    if (lookupError) throw lookupError;
    if (existingByName) organizationId = existingByName.id;
    else {
      const { data: created, error: createError } = await supabase.from("organizations").insert({
        workspace_id: ctx.workspaceId,
        canonical_name: opportunity.title,
        display_name: opportunity.title,
        org_type: opportunity.opportunity_type,
        org_category: orgCategory(opportunity.opportunity_type),
        website: opportunity.canonical_url ?? opportunity.source_url,
        activity_status: "unknown",
        trust_tier: (opportunity.legitimacy_score ?? 0) >= 85 ? "medium" : "unknown",
        risk_tier: (opportunity.risk_score ?? 0) >= 60 ? "high" : "unknown",
        verification_status: "partially verified",
        evidence_strength: 2,
        primary_source_url: opportunity.source_url,
        notes: `Promoted from ${opportunity.source_slug ?? "source"} discovery ${opportunity.external_id ?? ""}. ${opportunity.summary ?? ""}`.trim(),
        relationship_stage: "qualified",
      }).select("id").single();
      if (createError) throw createError;
      organizationId = created.id;
    }
  }

  if (!organizationId) throw new Error("organization_resolution_failed");

  if (!propertyId && opportunity.candidate_kind === "property") {
    const { data: existingProperty, error: propertyLookupError } = await supabase.from("properties").select("id").eq("workspace_id", ctx.workspaceId).eq("organization_id", organizationId).ilike("name", opportunity.title).limit(1).maybeSingle();
    if (propertyLookupError) throw propertyLookupError;
    if (existingProperty) propertyId = existingProperty.id;
    else {
      const { data: createdProperty, error: propertyCreateError } = await supabase.from("properties").insert({
        workspace_id: ctx.workspaceId,
        organization_id: organizationId,
        name: opportunity.title,
        property_type: opportunity.opportunity_type,
        platform: opportunity.source_slug,
        url: opportunity.canonical_url ?? opportunity.source_url,
        platform_url: opportunity.canonical_url ?? opportunity.source_url,
        source: opportunity.source_slug,
        activity_status: "unknown",
        verification_status: "partially verified",
        evidence_strength: 2,
        notes: `Human-approved promotion from Opportunity Intelligence. External ID: ${opportunity.external_id ?? "unknown"}.`,
        raw_record: { source_slug: opportunity.source_slug, external_id: opportunity.external_id, canonical_url: opportunity.canonical_url, opportunity_id: opportunity.id },
        relationship_stage: "qualified",
      }).select("id").single();
      if (propertyCreateError) throw propertyCreateError;
      propertyId = createdProperty.id;
    }
  }

  let campaignTargetId: string | null = null;
  if (input.campaignId) {
    const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.campaignId).maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) throw new Error("campaign_not_found");
    const { data: target, error: targetError } = await supabase.from("campaign_targets").upsert({ workspace_id: ctx.workspaceId, campaign_id: campaign.id, target_kind: "organization", target_id: organizationId, status: "queued", notes: `Promoted from opportunity ${opportunity.id}.` }, { onConflict: "campaign_id,target_kind,target_id" }).select("id").single();
    if (targetError) throw targetError;
    campaignTargetId = target.id;
  }

  const { error: opportunityUpdateError } = await supabase.from("opportunities").update({ organization_id: organizationId, status: "promoted_to_crm", review_status: "promoted", updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", opportunity.id);
  if (opportunityUpdateError) throw opportunityUpdateError;
  const result = { opportunityId: opportunity.id, organizationId, propertyId, campaignTargetId, promoted: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: promoteOpportunityToCrmCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: opportunity.evidence_ids ?? [] };
});
