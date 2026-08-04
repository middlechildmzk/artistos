import type { SourcePolicy, SourceSlug } from "./types";

export const SOURCE_POLICIES: Record<SourceSlug, SourcePolicy> = {
  wikidata: {
    slug: "wikidata",
    label: "Wikidata",
    disposition: "accept_verified_source",
    officialUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
    allowedUse: "CC0 public entity identity and relationship data through documented Wikimedia interfaces.",
    requiresConfiguration: false,
    executionEnabled: true,
  },
  youtube: {
    slug: "youtube",
    label: "YouTube Data API v3",
    disposition: "accept_verified_source",
    officialUrl: "https://developers.google.com/youtube/v3",
    allowedUse: "Public channel identity metadata through the official API only after ArtistOS retention, refresh, quota, and policy controls are approved.",
    requiresConfiguration: true,
    executionEnabled: false,
    executionBlockReason: "Blocked pending YouTube API compliance approval and 30-day refresh-or-delete controls.",
  },
};

export function policyAllowsExecution(policy: SourcePolicy) {
  return policy.disposition === "accept_verified_source" && policy.executionEnabled;
}
