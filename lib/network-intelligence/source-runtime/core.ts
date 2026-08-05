import type { DiscoveryCandidate, SearchLane, SourceSearchPlan, SourceSearchResult, SourceSlug } from "./types";
import { SOURCE_POLICIES, policyAllowsExecution, policySupportsLane } from "./policy";
import { getSourceAdapter } from "./registry";
import { mergeCandidateClusters } from "./identity";
import { tokenize } from "./scoring";

const laneQuerySuffix: Record<SearchLane, string> = {
  playlist: "music playlist curator",
  publication: "music publication blog magazine",
  youtube_channel: "music discovery YouTube channel",
  creator: "music creator influencer",
  radio: "radio station music show",
  podcast: "music podcast",
  sync: "music licensing sync agency",
  music_library: "production music library",
  label: "record label publishing A&R",
  booking: "music venue festival booking promoter",
  other: "music industry opportunity",
};

export { tokenize, scoreDiscovery } from "./scoring";

function queryVariants(baseQuery: string, lane: SearchLane, fitContext?: string | null) {
  const primary = `${baseQuery} ${laneQuerySuffix[lane]}`.trim();
  const contextTokens = tokenize(fitContext).slice(0, 8).join(" ");
  const contextual = contextTokens ? `${baseQuery} ${contextTokens} ${laneQuerySuffix[lane]}`.trim() : primary;
  return [...new Set([primary, contextual])].slice(0, 2);
}

export function buildSourcePlan(input: {
  query: string;
  objective: string;
  releaseId?: string | null;
  fitContext?: string | null;
  lanes: SearchLane[];
  requestedSources: string[];
}): SourceSearchPlan {
  const baseQuery = input.query.trim().slice(0, 240);
  const objective = input.objective.trim().slice(0, 1000);
  if (!baseQuery) throw new Error("search_query_required");
  const requested = input.requestedSources.length ? input.requestedSources : ["wikidata", "radio_browser"];
  const selectedPolicyMap = new Map<SourceSlug, SourceSearchPlan["sourcePolicies"][number]>();
  const skippedSources: SourceSearchPlan["skippedSources"] = [];
  const lanes = [...new Set(input.lanes.length ? input.lanes : ["radio"])] as SearchLane[];

  const plannedLanes = lanes.map((lane) => {
    const variants = queryVariants(baseQuery, lane, input.fitContext);
    const laneSources: SourceSlug[] = [];
    let estimatedRequests = 0;
    for (const rawSlug of requested) {
      const policy = SOURCE_POLICIES[rawSlug as SourceSlug];
      if (!policy) {
        skippedSources.push({ slug: rawSlug, reason: "source_not_registered", lane });
        continue;
      }
      const adapter = getSourceAdapter(policy.slug);
      const health = adapter.health();
      if (!policySupportsLane(policy, lane)) {
        skippedSources.push({ slug: policy.slug, reason: "source_lane_not_supported", lane });
        continue;
      }
      if (!policyAllowsExecution(policy)) {
        skippedSources.push({ slug: policy.slug, reason: policy.executionBlockReason ?? `policy_${policy.disposition}`, lane });
        selectedPolicyMap.set(policy.slug, { ...policy, health });
        continue;
      }
      laneSources.push(policy.slug);
      selectedPolicyMap.set(policy.slug, { ...policy, health });
      estimatedRequests += policy.estimatedRequestsPerLane * variants.length;
    }
    return {
      lane,
      query: variants[0],
      queryVariants: variants,
      sources: [...new Set(laneSources)],
      estimatedRequests,
    };
  });

  const selectedPolicies = [...selectedPolicyMap.values()];
  const estimatedRequestCount = plannedLanes.reduce((total, lane) => total + lane.estimatedRequests, 0);
  const estimatedCostSummary = Object.fromEntries(selectedPolicies.map((source) => [source.slug, source.costLabel]));

  return {
    planVersion: "network-source-runtime-v2",
    generatedAt: new Date().toISOString(),
    objective: objective || `Find evidence-backed music-industry targets for ${baseQuery}.`,
    baseQuery,
    releaseId: input.releaseId ?? null,
    fitContext: input.fitContext?.trim().slice(0, 1000) || null,
    lanes: plannedLanes,
    sourcePolicies: selectedPolicies,
    skippedSources,
    estimatedRequestCount,
    estimatedCostSummary,
    executionMode: "human_operated",
  };
}

export async function executeSourcePlan(plan: SourceSearchPlan, maxResultsPerLane = 12) {
  const results: SourceSearchResult[] = [];
  const boundedMax = Math.max(1, Math.min(25, maxResultsPerLane));
  for (const lane of plan.lanes) {
    const variants = lane.queryVariants?.length ? lane.queryVariants : [lane.query];
    for (const sourceSlug of lane.sources) {
      const policy = SOURCE_POLICIES[sourceSlug];
      if (!policy || !policyAllowsExecution(policy) || !policySupportsLane(policy, lane.lane)) {
        results.push({ sourceSlug, status: "skipped", candidates: [], nextCursor: null, requestCount: 0, rateLimit: {}, warnings: ["source_policy_blocked"], error: policy?.executionBlockReason ?? "source_policy_blocked" });
        continue;
      }
      const adapter = getSourceAdapter(sourceSlug);
      const health = adapter.health();
      if (health.status !== "available") {
        results.push({ sourceSlug, status: "skipped", candidates: [], nextCursor: null, requestCount: 0, rateLimit: {}, warnings: [health.detail], error: health.detail });
        continue;
      }
      for (const variant of variants) {
        try {
          const result = await adapter.search({ query: variant, lane: lane.lane, maxResults: boundedMax, fitContext: plan.fitContext });
          results.push({ ...result, rateLimit: { ...result.rateLimit, query_variant: variant } });
        } catch (error) {
          results.push({ sourceSlug, status: "failed", candidates: [], nextCursor: null, requestCount: 0, rateLimit: { query_variant: variant }, warnings: [], error: error instanceof Error ? error.message : "source_search_failed" });
        }
      }
    }
  }

  const sourceDeduped = new Map<string, DiscoveryCandidate>();
  for (const result of results) {
    for (const candidate of result.candidates) {
      const key = `${candidate.sourceSlug}:${candidate.externalId}`;
      const current = sourceDeduped.get(key);
      if (!current || candidate.fitScore > current.fitScore) sourceDeduped.set(key, candidate);
    }
  }
  const candidates = mergeCandidateClusters([...sourceDeduped.values()]);
  const requestCount = results.reduce((total, result) => total + result.requestCount, 0);
  const sourceCostSummary = Object.fromEntries([...new Set(results.map((result) => result.sourceSlug))].map((slug) => [slug, SOURCE_POLICIES[slug].costLabel]));
  return { reports: results, candidates, requestCount, sourceCostSummary };
}
