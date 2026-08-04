import "server-only";
import type { DiscoveryCandidate, SourceAdapter } from "./types";
import { SOURCE_POLICIES } from "./policy";
import { scoreDiscovery } from "./scoring";

const MAX_BYTES = 2_000_000;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function youtubeJson(url: URL) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("youtube_response_too_large");
  const payload = objectValue(JSON.parse(text || "{}"));
  if (!response.ok) {
    const error = objectValue(payload.error);
    throw new Error(`youtube_request_failed:${response.status}:${String(error.message || response.statusText)}`);
  }
  return payload;
}

export const youtubeAdapter: SourceAdapter = {
  slug: "youtube",
  policy: SOURCE_POLICIES.youtube,
  health: () => {
    if (!SOURCE_POLICIES.youtube.executionEnabled) return { status: "blocked_by_policy", detail: SOURCE_POLICIES.youtube.executionBlockReason ?? "YouTube execution is disabled." };
    return process.env.YOUTUBE_DATA_API_KEY?.trim()
      ? { status: "available", detail: "Server-only YouTube Data API key is configured." }
      : { status: "configuration_required", detail: "YOUTUBE_DATA_API_KEY is not configured for this environment." };
  },
  async search(input) {
    if (!SOURCE_POLICIES.youtube.executionEnabled) throw new Error("source_policy_blocked:youtube");
    const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
    if (!apiKey) throw new Error("source_not_configured:youtube");
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "channel");
    searchUrl.searchParams.set("q", input.query);
    searchUrl.searchParams.set("maxResults", String(Math.max(1, Math.min(25, input.maxResults))));
    searchUrl.searchParams.set("safeSearch", "moderate");
    searchUrl.searchParams.set("key", apiKey);
    const searchPayload = await youtubeJson(searchUrl);
    const observedAt = new Date().toISOString();
    const items = Array.isArray(searchPayload.items) ? searchPayload.items : [];
    const candidates = items.map((raw): DiscoveryCandidate | null => {
      const row = objectValue(raw);
      const id = objectValue(row.id);
      const snippet = objectValue(row.snippet);
      const externalId = typeof id.channelId === "string" ? id.channelId : null;
      const title = typeof snippet.title === "string" ? snippet.title : null;
      if (!externalId || !title) return null;
      const summary = typeof snippet.description === "string" ? snippet.description.slice(0, 2000) : null;
      const canonicalUrl = `https://www.youtube.com/channel/${encodeURIComponent(externalId)}`;
      const scored = scoreDiscovery({ title, summary, query: input.query, fitContext: input.fitContext, lane: input.lane, sourceSlug: "youtube" });
      return {
        sourceSlug: "youtube",
        sourcePolicyDisposition: SOURCE_POLICIES.youtube.disposition,
        externalId,
        canonicalUrl,
        title,
        summary,
        candidateKind: "property",
        opportunityType: input.lane,
        observedAt,
        freshnessStatus: "unknown",
        confidence: "weak",
        legitimacyStatus: "unreviewed",
        audienceSignal: null,
        fitScore: scored.fit,
        legitimacyScore: scored.legitimacy,
        reachQualityScore: scored.reachQuality,
        accessibilityScore: scored.accessibility,
        relationshipScore: scored.relationshipScore,
        riskScore: scored.risk,
        riskFlags: ["submission_route_unverified", "public_platform_identity_only", "refresh_or_delete_within_30_days"],
        eligibility: { source_use: "public_channel_identity_discovery", actionable_route: false, retention_days: 30 },
        scoreFeatures: scored.features,
        rawPayload: row,
        normalizedPayload: { external_id: externalId, canonical_url: canonicalUrl, title, summary, lane: input.lane },
      };
    }).filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));
    return {
      sourceSlug: "youtube",
      status: "completed",
      candidates,
      nextCursor: typeof searchPayload.nextPageToken === "string" ? searchPayload.nextPageToken : null,
      rateLimit: { search_requests: 1, quota_units_estimate: 100 },
    };
  },
};
