import type { SourceAdapter, SourceSlug } from "./types";
import { SOURCE_POLICIES } from "./policy";

export function blockedAdapter(slug: Exclude<SourceSlug, "wikidata" | "radio_browser">): SourceAdapter {
  const policy = SOURCE_POLICIES[slug];
  return {
    slug,
    policy,
    health: () => ({
      status: policy.executionEnabled ? "configuration_required" : "blocked_by_policy",
      detail: policy.executionBlockReason ?? "Source execution is not approved.",
    }),
    async search() {
      return {
        sourceSlug: slug,
        status: "skipped",
        candidates: [],
        nextCursor: null,
        requestCount: 0,
        rateLimit: {},
        warnings: [policy.executionBlockReason ?? "source_policy_blocked"],
        error: policy.executionBlockReason ?? "source_policy_blocked",
      };
    },
  };
}
