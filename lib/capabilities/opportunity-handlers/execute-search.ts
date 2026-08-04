import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeSourcePlan } from "@/lib/network-intelligence/source-runtime/core";
import type { SourceSearchPlan } from "@/lib/network-intelligence/source-runtime/types";
import { registerCapabilityHandler } from "../handlers";
import { executeOpportunitySearchCapability } from "../opportunity-registry";
import { evidenceConfidence, findMatches, hash, readReplay, writeReplay } from "./shared";

const YOUTUBE_RETENTION_DAYS = 30;

function retainedUntil(sourceSlug: string, observedAt: string) {
  if (sourceSlug !== "youtube") return null;
  const date = new Date(observedAt);
  date.setUTCDate(date.getUTCDate() + YOUTUBE_RETENTION_DAYS);
  return date.toISOString();
}

registerCapabilityHandler(executeOpportunitySearchCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, executeOpportunitySearchCapability.name, key);
  if (replay && typeof replay === "object" && "runId" in replay) return { output: replay as never, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: search, error } = await supabase.from("opportunity_searches").select("id,source_plan").eq("workspace_id", ctx.workspaceId).eq("id", input.searchId).maybeSingle();
  if (error) throw error;
  if (!search) throw new Error("opportunity_search_not_found");
  const plan = search.source_plan as SourceSearchPlan;
  if (!plan || plan.planVersion !== "network-source-runtime-v1") throw new Error("source_plan_invalid");

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase.from("opportunity_search_runs").insert({ workspace_id: ctx.workspaceId, search_id: search.id, status: "running", plan_snapshot: plan, idempotency_key: key, started_at: startedAt, created_by: ctx.userId }).select("id").single();
  if (runError) throw runError;
  const { error: searchStartError } = await supabase.from("opportunity_searches").update({ status: "running", last_run_at: startedAt, last_run_status: "running", updated_at: startedAt }).eq("workspace_id", ctx.workspaceId).eq("id", search.id);
  if (searchStartError) throw searchStartError;

  const evidenceIds: string[] = [];
  try {
    const executed = await executeSourcePlan(plan, input.maxResultsPerLane);
    const [{ data: organizations, error: orgError }, { data: properties, error: propertyError }] = await Promise.all([
      supabase.from("organizations").select("id,canonical_name,display_name,website,primary_source_url").eq("workspace_id", ctx.workspaceId).limit(10000),
      supabase.from("properties").select("id,organization_id,name,url,platform_url,raw_record").eq("workspace_id", ctx.workspaceId).is("archived_at", null).limit(10000),
    ]);
    if (orgError) throw orgError;
    if (propertyError) throw propertyError;

    let matchedCount = 0;
    for (const candidate of executed.candidates) {
      const matches = findMatches(candidate, organizations ?? [], properties ?? []);
      const bestMatch = matches[0] ?? null;
      if (bestMatch) matchedCount += 1;
      const observedAt = candidate.observedAt;
      const { data: evidence, error: evidenceError } = await supabase.from("evidence_records").insert({
        workspace_id: ctx.workspaceId,
        artist_id: ctx.artistId,
        evidence_type: "opportunity_source_observation",
        source_type: "api_response",
        source_uri: candidate.canonicalUrl,
        summary: `${candidate.title} returned by the approved ${candidate.sourceSlug} identity adapter. Candidate legitimacy, activity, submission eligibility, and outreach permission remain unassessed unless separately evidenced.`,
        confidence: evidenceConfidence(candidate.confidence),
        observed_at: observedAt,
        captured_by: ctx.userId,
        content_hash: hash(candidate.rawPayload),
        metadata: { source_slug: candidate.sourceSlug, external_id: candidate.externalId, source_policy_disposition: candidate.sourcePolicyDisposition, search_run_id: run.id },
      }).select("id").single();
      if (evidenceError) throw evidenceError;
      evidenceIds.push(evidence.id);

      const values = {
        workspace_id: ctx.workspaceId,
        search_id: search.id,
        search_run_id: run.id,
        opportunity_type: candidate.opportunityType,
        title: candidate.title,
        summary: candidate.summary,
        source_url: candidate.canonicalUrl,
        status: "discovered",
        freshness_status: candidate.freshnessStatus,
        legitimacy_status: candidate.legitimacyStatus,
        confidence: candidate.confidence,
        fit_score: candidate.fitScore,
        legitimacy_score: candidate.legitimacyScore,
        reach_quality_score: candidate.reachQualityScore,
        accessibility_score: candidate.accessibilityScore,
        relationship_score: candidate.relationshipScore,
        risk_score: candidate.riskScore,
        score_explanation: { features: candidate.scoreFeatures, scoring_version: "network-source-runtime-v1" },
        risk_flags: candidate.riskFlags,
        evidence_ids: [evidence.id],
        last_verified_at: null,
        source_slug: candidate.sourceSlug,
        source_policy_disposition: candidate.sourcePolicyDisposition,
        external_id: candidate.externalId,
        canonical_url: candidate.canonicalUrl,
        candidate_kind: candidate.candidateKind,
        review_status: "pending",
        match_confidence: bestMatch?.score ?? null,
        match_reasons: bestMatch?.reasons ?? [],
        eligibility: candidate.eligibility,
        updated_at: new Date().toISOString(),
      };
      const { data: existing, error: existingError } = await supabase.from("opportunities").select("id").eq("workspace_id", ctx.workspaceId).eq("search_id", search.id).eq("source_slug", candidate.sourceSlug).eq("external_id", candidate.externalId).maybeSingle();
      if (existingError) throw existingError;
      const write = existing
        ? supabase.from("opportunities").update(values).eq("workspace_id", ctx.workspaceId).eq("id", existing.id).select("id").single()
        : supabase.from("opportunities").insert(values).select("id").single();
      const { data: opportunity, error: opportunityError } = await write;
      if (opportunityError) throw opportunityError;

      const { error: observationError } = await supabase.from("opportunity_source_observations").insert({
        workspace_id: ctx.workspaceId,
        opportunity_id: opportunity.id,
        search_run_id: run.id,
        source_type: `official_api:${candidate.sourceSlug}`,
        source_url: candidate.canonicalUrl,
        external_id: candidate.externalId,
        raw_payload: candidate.rawPayload,
        normalized_payload: candidate.normalizedPayload,
        normalization_version: "network-source-runtime-v1",
        observed_at: observedAt,
        retrieved_at: new Date().toISOString(),
        stored_until: retainedUntil(candidate.sourceSlug, observedAt),
        freshness_status: candidate.freshnessStatus,
        confidence: candidate.confidence,
        evidence_id: evidence.id,
        source_policy_disposition: candidate.sourcePolicyDisposition,
      });
      if (observationError) throw observationError;

      for (const feature of candidate.scoreFeatures) {
        const { error: featureError } = await supabase.from("opportunity_score_features").upsert({ workspace_id: ctx.workspaceId, opportunity_id: opportunity.id, feature_key: feature.key, feature_value: feature.value, feature_label: feature.label, weight: feature.weight, contribution: feature.contribution, explanation: feature.explanation, confidence: candidate.confidence, evidence_ids: [evidence.id] }, { onConflict: "workspace_id,opportunity_id,feature_key" });
        if (featureError) throw featureError;
      }

      const { error: deleteMatchesError } = await supabase.from("opportunity_match_candidates").delete().eq("workspace_id", ctx.workspaceId).eq("opportunity_id", opportunity.id);
      if (deleteMatchesError) throw deleteMatchesError;
      for (const match of matches) {
        const { error: matchError } = await supabase.from("opportunity_match_candidates").insert({ workspace_id: ctx.workspaceId, opportunity_id: opportunity.id, candidate_entity_type: match.entityType, candidate_entity_id: match.entityId, match_score: match.score, match_reasons: match.reasons, conflicting_fields: match.conflicts });
        if (matchError) throw matchError;
      }
    }

    const completedSources = executed.reports.filter((report) => report.status === "completed").length;
    const skippedSources = executed.reports.filter((report) => report.status === "skipped").length;
    const failedSources = executed.reports.filter((report) => report.status === "failed").length;
    const status = completedSources > 0 && failedSources === 0 ? "completed" : completedSources > 0 ? "partial" : "failed";
    const completedAt = new Date().toISOString();
    const summary = { discovered_count: executed.candidates.length, matched_count: matchedCount, completed_sources: completedSources, skipped_sources: skippedSources, failed_sources: failedSources };
    const { error: runCompleteError } = await supabase.from("opportunity_search_runs").update({ status, source_reports: executed.reports, result_count: executed.candidates.length, matched_count: matchedCount, completed_at: completedAt, error_summary: failedSources ? `${failedSources} source adapters failed.` : null }).eq("workspace_id", ctx.workspaceId).eq("id", run.id);
    if (runCompleteError) throw runCompleteError;
    const { error: searchCompleteError } = await supabase.from("opportunity_searches").update({ status: "completed", last_run_at: completedAt, last_run_status: status, last_run_summary: summary, updated_at: completedAt }).eq("workspace_id", ctx.workspaceId).eq("id", search.id);
    if (searchCompleteError) throw searchCompleteError;
    const result = { searchId: search.id, runId: run.id, discoveredCount: executed.candidates.length, matchedCount, completedSources, skippedSources, failedSources, status } as const;
    await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: executeOpportunitySearchCapability.name, key, result, userId: ctx.userId });
    return { output: result, evidenceIds };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "source_runtime_failed";
    await supabase.from("opportunity_search_runs").update({ status: "failed", completed_at: failedAt, error_summary: message.slice(0, 1000) }).eq("workspace_id", ctx.workspaceId).eq("id", run.id);
    await supabase.from("opportunity_searches").update({ status: "failed", last_run_at: failedAt, last_run_status: "failed", last_run_summary: { error: message.slice(0, 1000) }, updated_at: failedAt }).eq("workspace_id", ctx.workspaceId).eq("id", search.id);
    throw error;
  }
});
