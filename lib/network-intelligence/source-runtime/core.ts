import type { DiscoveryCandidate, SearchLane, SourceSearchPlan, SourceSearchResult, SourceSlug } from "./types";
import { SOURCE_POLICIES, policyAllowsExecution } from "./policy";
import { getSourceAdapter } from "./registry";

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
  const requested = input.requestedSources.length ? input.requestedSources : ["wikidata", "youtube"];
  const selectedPolicies = [] as SourceSearchPlan["sourcePolicies"];
  const skippedSources: SourceSearchPlan["skippedSources"] = [];
  for (const rawSlug of requested) {
    const policy = SOURCE_POLICIES[rawSlug as SourceSlug];
    if (!policy) {
      skippedSources.push({ slug: rawSlug, reason: "source_not_registered" });
      continue;
    }
    const adapter = getSourceAdapter(policy.slug);
    const health = adapter.health();
    if (!policyAllowsExecution(policy)) {
      skippedSources.push({ slug: policy.slug, reason: `policy_${policy.disposition}` });
      continue;
    }
    selectedPolicies.push({ ...policy, health });
  }
  const lanes = [...new Set(input.lanes.length ? input.lanes : ["youtube_channel"])] as SearchLane[];
  return {
    planVersion: "network-source-runtime-v1",
    generatedAt: new Date().toISOString(),
    objective: objective || `Find evidence-backed music-industry targets for ${baseQuery}.`,
    baseQuery,
    releaseId: input.releaseId ?? null,
    fitContext: input.fitContext?.trim().slice(0, 1000) || null,
    lanes: lanes.map((lane) => ({
      lane,
      query: `${baseQuery} ${laneQuerySuffix[lane]}`.trim(),
      sources: selectedPolicies.map((source) => source.slug).filter((slug) => slug !== "youtube" || ["playlist", "publication", "youtube_channel", "creator", "radio", "podcast", "label"].includes(lane)),
    })),
    sourcePolicies: selectedPolicies,
    skippedSources,
    executionMode: "human_operated",
  };
}

export async function executeSourcePlan(plan: SourceSearchPlan, maxResultsPerLane = 12) {
  const results: SourceSearchResult[] = [];
  for (const lane of plan.lanes) {
    for (const sourceSlug of lane.sources) {
      const adapter = getSourceAdapter(sourceSlug);
      const health = adapter.health();
      if (health.status !== "available") {
        results.push({ sourceSlug, status: "skipped", candidates: [], nextCursor: null, rateLimit: {}, error: health.detail });
        continue;
      }
      try {
        results.push(await adapter.search({ query: lane.query, lane: lane.lane, maxResults: maxResultsPerLane, fitContext: plan.fitContext }));
      } catch (error) {
        results.push({ sourceSlug, status: "failed", candidates: [], nextCursor: null, rateLimit: {}, error: error instanceof Error ? error.message : "source_search_failed" });
      }
    }
  }

  const deduped = new Map<string, DiscoveryCandidate>();
  for (const result of results) {
    for (const candidate of result.candidates) {
      const key = `${candidate.sourceSlug}:${candidate.externalId}`;
      const current = deduped.get(key);
      if (!current || candidate.fitScore > current.fitScore) deduped.set(key, candidate);
    }
  }
  return { reports: results, candidates: [...deduped.values()].sort((a, b) => b.fitScore - a.fitScore || a.title.localeCompare(b.title)) };
}
