import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeSourcePlan } from "@/lib/network-intelligence/source-runtime/core";
import type { CandidateObservation, SourceSearchPlan } from "@/lib/network-intelligence/source-runtime/types";
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

function supportsPlan(plan: SourceSearchPlan | null | undefined): plan is SourceSearchPlan {
  return Boolean(plan && ["network-source-runtime-v1", "network-source-runtime-v2"].includes(plan.planVersion));
}

function observationSummary(title: string, observation: CandidateObservation) {
  return `${title} was returned by the approved ${observation.sourceSlug} identity source. This observation supports identity discovery only. Legitimacy, current activity, submission eligibility, consent, and outreach permission remain unassessed unless separately evidenced.`;
}

registerCapabilityHandler(executeOpportunitySearchCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, executeOpportunitySearchCapability.name, key);
  if (replay && typeof replay === "object" && "runId" in replay) return { output: replay as never, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const { data: search, error } = await supabase
    .from("opportunity_searches")
    .select("id,source_plan")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.searchId)
    .maybeSingle();
  if (error) throw error;
  if (!search) throw new Error("opportunity_search_not_found");

  const plan = search.source_plan as SourceSearchPlan;
  if (!supportsPlan(plan)) throw new Error("source_plan_invalid");

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase
    .from("opportunity_search_runs")
    .insert({
      workspace_id: ctx.workspaceId,
      search_id: search.id,
      status: "running",
      plan_snapshot: plan,
      idempotency_key: key,
      estimated_request_count: plan.estimatedRequestCount ?? 0,
      source_cost_summary: plan.estimatedCostSummary ?? {},
      started_at: startedAt,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  const { error: searchStartError } = await supabase
    .from("opportunity_searches")
    .update({ status: "running", last_run_at: startedAt, last_run_status: "running", updated_at: startedAt })
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", search.id);
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
    let corroboratedCount = 0;

    for (const candidate of executed.candidates) {
      const matches = findMatches(candidate, organizations ?? [], properties ?? []);
      const bestMatch = matches[0] ?? null;
      if (bestMatch) matchedCount += 1;
      if (candidate.corroboratingSources.length > 1) corroboratedCount += 1;

      const candidateEvidenceIds: string[] = [];
      const evidenceByObservation = new Map<string, string>();
      for (const observation of candidate.sourceObservations) {
        const { data: evidence, error: evidenceError } = await supabase
          .from("evidence_records")
          .insert({
            workspace_id: ctx.workspaceId,
            artist_id: ctx.artistId,
            evidence_type: "opportunity_source_observation",
            source_type: "api_response",
            source_uri: observation.canonicalUrl,
            summary: observationSummary(candidate.title, observation),
            confidence: evidenceConfidence(candidate.confidence),
            observed_at: observation.observedAt,
            captured_by: ctx.userId,
            content_hash: hash(observation.rawPayload),
            metadata: {
              source_slug: observation.sourceSlug,
              external_id: observation.externalId,
              source_policy_disposition: observation.sourcePolicyDisposition,
              search_run_id: run.id,
              discovery_cluster_key: candidate.discoveryClusterKey,
              corroborating_sources: candidate.corroboratingSources,
            },
          })
          .select("id")
          .single();
        if (evidenceError) throw evidenceError;
        evidenceIds.push(evidence.id);
        candidateEvidenceIds.push(evidence.id);
        evidenceByObservation.set(`${observation.sourceSlug}:${observation.externalId}`, evidence.id);
      }

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
        score_explanation: {
          features: candidate.scoreFeatures,
          scoring_version: plan.planVersion,
          discovery_cluster_key: candidate.discoveryClusterKey,
          corroborating_sources: candidate.corroboratingSources,
        },
        risk_flags: candidate.riskFlags,
        evidence_ids: candidateEvidenceIds,
        last_verified_at: null,
        source_slug: candidate.sourceSlug,
        source_policy_disposition: candidate.sourcePolicyDisposition,
        external_id: candidate.externalId,
        canonical_url: candidate.canonicalUrl,
        candidate_kind: candidate.candidateKind,
        discovery_cluster_key: candidate.discoveryClusterKey,
        corroborating_sources: candidate.corroboratingSources,
        corroboration_count: Math.max(1, candidate.corroboratingSources.length),
        identity_urls: candidate.identityUrls,
        external_identifiers: candidate.externalIdentifiers,
        review_status: "pending",
        match_confidence: bestMatch?.score ?? null,
        match_reasons: bestMatch?.reasons ?? [],
        eligibility: candidate.eligibility,
        updated_at: new Date().toISOString(),
      };

      let existingQuery = supabase
        .from("opportunities")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("search_id", search.id);
      existingQuery = candidate.discoveryClusterKey
        ? existingQuery.eq("discovery_cluster_key", candidate.discoveryClusterKey)
        : existingQuery.eq("source_slug", candidate.sourceSlug).eq("external_id", candidate.externalId);
      const { data: existing, error: existingError } = await existingQuery.maybeSingle();
      if (existingError) throw existingError;

      const write = existing
        ? supabase.from("opportunities").update(values).eq("workspace_id", ctx.workspaceId).eq("id", existing.id).select("id").single()
        : supabase.from("opportunities").insert(values).select("id").single();
      const { data: opportunity, error: opportunityError } = await write;
      if (opportunityError) throw opportunityError;

      for (const observation of candidate.sourceObservations) {
        const observationEvidenceId = evidenceByObservation.get(`${observation.sourceSlug}:${observation.externalId}`);
        if (!observationEvidenceId) throw new Error("source_observation_evidence_missing");
        const { error: observationError } = await supabase.from("opportunity_source_observations").insert({
          workspace_id: ctx.workspaceId,
          opportunity_id: opportunity.id,
          search_run_id: run.id,
          source_type: `official_api:${observation.sourceSlug}`,
          source_url: observation.canonicalUrl,
          external_id: observation.externalId,
          raw_payload: observation.rawPayload,
          normalized_payload: observation.normalizedPayload,
          normalization_version: plan.planVersion,
          observed_at: observation.observedAt,
          retrieved_at: new Date().toISOString(),
          stored_until: retainedUntil(observation.sourceSlug, observation.observedAt),
          freshness_status: candidate.freshnessStatus,
          confidence: candidate.confidence,
          evidence_id: observationEvidenceId,
          source_policy_disposition: observation.sourcePolicyDisposition,
          identity_urls: observation.identityUrls,
          external_identifiers: observation.externalIdentifiers,
        });
        if (observationError) throw observationError;
      }

      for (const feature of candidate.scoreFeatures) {
        const { error: featureError } = await supabase.from("opportunity_score_features").upsert({
          workspace_id: ctx.workspaceId,
          opportunity_id: opportunity.id,
          feature_key: feature.key,
          feature_value: feature.value,
          feature_label: feature.label,
          weight: feature.weight,
          contribution: feature.contribution,
          explanation: feature.explanation,
          confidence: candidate.confidence,
          evidence_ids: candidateEvidenceIds,
        }, { onConflict: "workspace_id,opportunity_id,feature_key" });
        if (featureError) throw featureError;
      }

      const { error: deleteMatchesError } = await supabase
        .from("opportunity_match_candidates")
        .delete()
        .eq("workspace_id", ctx.workspaceId)
        .eq("opportunity_id", opportunity.id);
      if (deleteMatchesError) throw deleteMatchesError;

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
    const status = completedSources > 0 && failedSources === 0 ? "completed" : completedSources > 0 ? "partial" : "failed";
    const completedAt = new Date().toISOString();
    const summary = {
      discovered_count: executed.candidates.length,
      matched_count: matchedCount,
      corroborated_count: corroboratedCount,
      completed_sources: completedSources,
      skipped_sources: skippedSources,
      failed_sources: failedSources,
      estimated_request_count: plan.estimatedRequestCount ?? 0,
      actual_request_count: executed.requestCount,
      source_cost_summary: executed.sourceCostSummary,
    };

    const { error: runCompleteError } = await supabase
      .from("opportunity_search_runs")
      .update({
        status,
        source_reports: executed.reports,
        result_count: executed.candidates.length,
        matched_count: matchedCount,
        actual_request_count: executed.requestCount,
        source_cost_summary: executed.sourceCostSummary,
        completed_at: completedAt,
        error_summary: failedSources ? `${failedSources} source adapter executions failed.` : null,
      })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", run.id);
    if (runCompleteError) throw runCompleteError;

    const { error: searchCompleteError } = await supabase
      .from("opportunity_searches")
      .update({ status: "completed", last_run_at: completedAt, last_run_status: status, last_run_summary: summary, updated_at: completedAt })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", search.id);
    if (searchCompleteError) throw searchCompleteError;

    const result = {
      searchId: search.id,
      runId: run.id,
      discoveredCount: executed.candidates.length,
      matchedCount,
      corroboratedCount,
      completedSources,
      skippedSources,
      failedSources,
      actualRequestCount: executed.requestCount,
      status,
    } as const;
    await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: executeOpportunitySearchCapability.name, key, result, userId: ctx.userId });
    return { output: result, evidenceIds };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "source_runtime_failed";
    await supabase
      .from("opportunity_search_runs")
      .update({ status: "failed", completed_at: failedAt, error_summary: message.slice(0, 1000) })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", run.id);
    await supabase
      .from("opportunity_searches")
      .update({ status: "failed", last_run_at: failedAt, last_run_status: "failed", last_run_summary: { error: message.slice(0, 1000) }, updated_at: failedAt })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", search.id);
    throw error;
  }
});
