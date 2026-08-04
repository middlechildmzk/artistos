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
  health: () => process.env.YOUTUBE_DATA_API_KEY?.trim()
    ? { status: "available", detail: "Server-only YouTube Data API key is configured." }
    : { status: "configuration_required", detail: "YOUTUBE_DATA_API_KEY is not configured for this environment." },
  async search(input) {
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
    const items = Array.isArray(searchPayload.items) ? searchPayload.items : [];
    const channelIds = items.map((item) => {
      const id = objectValue(objectValue(item).id);
      return typeof id.channelId === "string" ? id.channelId : null;
    }).filter((value): value is string => Boolean(value));
    if (!channelIds.length) return { sourceSlug: "youtube", status: "completed", candidates: [], nextCursor: null, rateLimit: { search_requests: 1 } };

    const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    channelsUrl.searchParams.set("part", "snippet,statistics,brandingSettings");
    channelsUrl.searchParams.set("id", channelIds.join(","));
    channelsUrl.searchParams.set("key", apiKey);
    const channelsPayload = await youtubeJson(channelsUrl);
    const observedAt = new Date().toISOString();
    const channels = Array.isArray(channelsPayload.items) ? channelsPayload.items : [];
    const candidates = channels.map((raw): DiscoveryCandidate | null => {
      const row = objectValue(raw);
      const externalId = typeof row.id === "string" ? row.id : null;
      const snippet = objectValue(row.snippet);
      const statistics = objectValue(row.statistics);
      const title = typeof snippet.title === "string" ? snippet.title : null;
      if (!externalId || !title) return null;
      const summary = typeof snippet.description === "string" ? snippet.description.slice(0, 2000) : null;
      const subscribers = Number(statistics.subscriberCount);
      const audienceSignal = Number.isFinite(subscribers) ? subscribers : null;
      const canonicalUrl = `https://www.youtube.com/channel/${encodeURIComponent(externalId)}`;
      const scored = scoreDiscovery({ title, summary, query: input.query, fitContext: input.fitContext, lane: input.lane, sourceSlug: "youtube", audienceSignal });
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
        freshnessStatus: "current",
        confidence: "supported",
        legitimacyStatus: "credible",
        audienceSignal,
        fitScore: scored.fit,
        legitimacyScore: scored.legitimacy,
        reachQualityScore: scored.reachQuality,
        accessibilityScore: scored.accessibility,
        relationshipScore: scored.relationshipScore,
        riskScore: scored.risk,
        riskFlags: ["submission_route_unverified", "public_platform_metadata"],
        eligibility: { source_use: "public_channel_discovery", actionable_route: false },
        scoreFeatures: scored.features,
        rawPayload: row,
        normalizedPayload: { external_id: externalId, canonical_url: canonicalUrl, title, summary, subscriber_count: audienceSignal, lane: input.lane },
      };
    }).filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));
    return {
      sourceSlug: "youtube",
      status: "completed",
      candidates,
      nextCursor: typeof searchPayload.nextPageToken === "string" ? searchPayload.nextPageToken : null,
      rateLimit: { search_requests: 1, channel_detail_requests: 1 },
    };
  },
};
