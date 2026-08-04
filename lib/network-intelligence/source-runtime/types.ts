export const sourceSlugs = ["wikidata", "youtube"] as const;
export type SourceSlug = (typeof sourceSlugs)[number];

export const searchLanes = [
  "playlist",
  "publication",
  "youtube_channel",
  "creator",
  "radio",
  "podcast",
  "sync",
  "music_library",
  "label",
  "booking",
  "other",
] as const;
export type SearchLane = (typeof searchLanes)[number];

export type SourcePolicyDisposition =
  | "accept_verified_source"
  | "accept_verified_route"
  | "verify_official_source"
  | "verify_official_route"
  | "external_handoff"
  | "partnership_required"
  | "license_review"
  | "reject_ineligible"
  | "reject_no_unsolicited";

export type SourceHealth = {
  status: "available" | "configuration_required" | "blocked_by_policy" | "unavailable";
  detail: string;
};

export type SourcePolicy = {
  slug: SourceSlug;
  label: string;
  disposition: SourcePolicyDisposition;
  officialUrl: string;
  allowedUse: string;
  requiresConfiguration: boolean;
  executionEnabled: boolean;
  executionBlockReason?: string;
};

export type SearchPlanLane = {
  lane: SearchLane;
  query: string;
  sources: SourceSlug[];
};

export type SourceSearchPlan = {
  planVersion: "network-source-runtime-v1";
  generatedAt: string;
  objective: string;
  baseQuery: string;
  releaseId: string | null;
  fitContext: string | null;
  lanes: SearchPlanLane[];
  sourcePolicies: Array<SourcePolicy & { health: SourceHealth }>;
  skippedSources: Array<{ slug: string; reason: string }>;
  executionMode: "human_operated";
};

export type DiscoveryFeature = {
  key: string;
  value: number;
  label: string;
  weight: number;
  contribution: number;
  explanation: string;
};

export type DiscoveryCandidate = {
  sourceSlug: SourceSlug;
  sourcePolicyDisposition: SourcePolicyDisposition;
  externalId: string;
  canonicalUrl: string;
  title: string;
  summary: string | null;
  candidateKind: "organization" | "person" | "property" | "submission_route" | "platform" | "unknown";
  opportunityType: SearchLane;
  observedAt: string;
  freshnessStatus: "current" | "aging" | "stale" | "unknown";
  confidence: "verified" | "supported" | "weak" | "unknown" | "stale" | "conflicting";
  legitimacyStatus: "unreviewed" | "credible" | "mixed" | "suspicious" | "blocked";
  audienceSignal: number | null;
  fitScore: number;
  legitimacyScore: number | null;
  reachQualityScore: number | null;
  accessibilityScore: number | null;
  relationshipScore: number | null;
  riskScore: number | null;
  riskFlags: string[];
  eligibility: Record<string, unknown>;
  scoreFeatures: DiscoveryFeature[];
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
};

export type SourceSearchInput = {
  query: string;
  lane: SearchLane;
  maxResults: number;
  fitContext?: string | null;
};

export type SourceSearchResult = {
  sourceSlug: SourceSlug;
  status: "completed" | "skipped" | "failed";
  candidates: DiscoveryCandidate[];
  nextCursor: string | null;
  rateLimit: Record<string, unknown>;
  error?: string;
};

export type SourceAdapter = {
  slug: SourceSlug;
  policy: SourcePolicy;
  health: () => SourceHealth;
  search: (input: SourceSearchInput) => Promise<SourceSearchResult>;
};
