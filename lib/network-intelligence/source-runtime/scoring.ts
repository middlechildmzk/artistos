import type { DiscoveryFeature, SearchLane, SourceSlug } from "./types";

const laneQuerySuffixForScore: Record<SearchLane, string> = {
  playlist: "music playlist curator", publication: "music publication blog magazine", youtube_channel: "music discovery YouTube channel", creator: "music creator influencer", radio: "radio station music show", podcast: "music podcast", sync: "music licensing sync agency", music_library: "production music library", label: "record label publishing A&R", booking: "music venue festival booking promoter", other: "music industry opportunity",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function tokenize(value: string | null | undefined) {
  return [...new Set(String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2))];
}

export function scoreDiscovery(args: {
  title: string;
  summary?: string | null;
  query: string;
  fitContext?: string | null;
  lane: SearchLane;
  sourceSlug: SourceSlug;
}) {
  const queryTokens = tokenize(`${args.query} ${args.fitContext ?? ""} ${laneQuerySuffixForScore[args.lane]}`);
  const candidateTokens = new Set(tokenize(`${args.title} ${args.summary ?? ""}`));
  const overlap = queryTokens.length ? queryTokens.filter((token) => candidateTokens.has(token)).length / queryTokens.length : 0;
  const fit = clamp(overlap * 100);
  const features: DiscoveryFeature[] = [
    { key: "query_overlap", value: overlap, label: "Query and release-context overlap", weight: 100, contribution: overlap * 100, explanation: `${Math.round(overlap * 100)}% of normalized target terms are visible in the source text.` },
    { key: "official_source_identity", value: 1, label: "Approved source identity", weight: 0, contribution: 0, explanation: `The candidate came from the approved ${args.sourceSlug} identity adapter. This supports provenance, not candidate legitimacy.` },
  ];
  return {
    fit,
    legitimacy: null,
    reachQuality: null,
    accessibility: null,
    relationshipScore: null,
    risk: null,
    features,
  };
}
