import type { SourcePolicy, SourceSlug } from "./types";

export const SOURCE_POLICIES: Record<SourceSlug, SourcePolicy> = {
  wikidata: {
    slug: "wikidata",
    label: "Wikidata",
    disposition: "accept_verified_source",
    officialUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
    allowedUse: "CC0 public entity identity and relationship data through documented Wikimedia interfaces.",
    requiresConfiguration: false,
  },
  youtube: {
    slug: "youtube",
    label: "YouTube Data API v3",
    disposition: "accept_verified_source",
    officialUrl: "https://developers.google.com/youtube/v3",
    allowedUse: "Public channel identity and metadata through the official API within current quota and retention rules.",
    requiresConfiguration: true,
  },
};

export function policyAllowsExecution(policy: SourcePolicy) {
  return policy.disposition === "accept_verified_source";
}
