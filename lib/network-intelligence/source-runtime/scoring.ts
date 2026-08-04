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
  audienceSignal?: number | null;
  existingMatchScore?: number | null;
}) {
  const queryTokens = tokenize(`${args.query} ${args.fitContext ?? ""} ${laneQuerySuffixForScore[args.lane]}`);
  const candidateTokens = new Set(tokenize(`${args.title} ${args.summary ?? ""}`));
  const overlap = queryTokens.length ? queryTokens.filter((token) => candidateTokens.has(token)).length / queryTokens.length : 0;
  const sourceTrust = args.sourceSlug === "youtube" ? 0.96 : 0.92;
  const reach = args.audienceSignal && args.audienceSignal > 0 ? Math.min(1, Math.log10(args.audienceSignal + 1) / 7) : 0.25;
  const relationship = args.existingMatchScore ?? 0;
  const fit = clamp(overlap * 60 + sourceTrust * 25 + reach * 15);
  const legitimacy = clamp(sourceTrust * 100);
  const reachQuality = clamp(reach * 100);
  const accessibility = 20;
  const relationshipScore = clamp(relationship * 100);
  const risk = clamp(12 + (accessibility < 30 ? 10 : 0));
  const features: DiscoveryFeature[] = [
    { key: "query_overlap", value: overlap, label: "Query and release-context overlap", weight: 60, contribution: overlap * 60, explanation: `${Math.round(overlap * 100)}% of normalized target terms are visible in the source text.` },
    { key: "official_source", value: sourceTrust, label: "Official-source strength", weight: 25, contribution: sourceTrust * 25, explanation: `The candidate came from the approved ${args.sourceSlug} adapter.` },
    { key: "audience_signal", value: reach, label: "Reach signal", weight: 15, contribution: reach * 15, explanation: args.audienceSignal ? `Public audience signal: ${args.audienceSignal}.` : "No reliable public audience value was returned." },
  ];
  return { fit, legitimacy, reachQuality, accessibility, relationshipScore, risk, features };
}

