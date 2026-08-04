import "server-only";
import type { DiscoveryCandidate, SearchLane, SourceAdapter } from "./types";
import { SOURCE_POLICIES } from "./policy";
import { scoreDiscovery } from "./scoring";

const MAX_BYTES = 1_500_000;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function candidateKind(lane: SearchLane): DiscoveryCandidate["candidateKind"] {
  if (["playlist", "youtube_channel", "radio", "podcast", "music_library"].includes(lane)) return "property";
  if (["publication", "creator", "sync", "label", "booking"].includes(lane)) return "organization";
  return "unknown";
}

export const wikidataAdapter: SourceAdapter = {
  slug: "wikidata",
  policy: SOURCE_POLICIES.wikidata,
  health: () => ({ status: "available", detail: "Public CC0 search is available without credentials." }),
  async search(input) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("search", input.query);
    url.searchParams.set("language", "en");
    url.searchParams.set("uselang", "en");
    url.searchParams.set("type", "item");
    url.searchParams.set("limit", String(Math.max(1, Math.min(25, input.maxResults))));
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const origin = process.env.ARTISTOS_PUBLIC_ORIGIN || "https://artistos-next.vercel.app";
    const response = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip,deflate", "User-Agent": `ArtistOS/0.1 (${origin})` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("wikidata_response_too_large");
    if (!response.ok) throw new Error(`wikidata_request_failed:${response.status}`);
    const payload = objectValue(JSON.parse(text || "{}"));
    const observedAt = new Date().toISOString();
    const search = Array.isArray(payload.search) ? payload.search : [];
    const candidates = search.map((raw): DiscoveryCandidate | null => {
      const row = objectValue(raw);
      const externalId = typeof row.id === "string" ? row.id : null;
      const title = typeof row.label === "string" ? row.label : null;
      if (!externalId || !title) return null;
      const summary = typeof row.description === "string" ? row.description : null;
      const canonicalUrl = `https://www.wikidata.org/wiki/${encodeURIComponent(externalId)}`;
      const scored = scoreDiscovery({ title, summary, query: input.query, fitContext: input.fitContext, lane: input.lane, sourceSlug: "wikidata" });
      return {
        sourceSlug: "wikidata",
        sourcePolicyDisposition: SOURCE_POLICIES.wikidata.disposition,
        externalId,
        canonicalUrl,
        title,
        summary,
        candidateKind: candidateKind(input.lane),
        opportunityType: input.lane,
        observedAt,
        freshnessStatus: "current",
        confidence: "supported",
        legitimacyStatus: "credible",
        audienceSignal: null,
        fitScore: scored.fit,
        legitimacyScore: scored.legitimacy,
        reachQualityScore: scored.reachQuality,
        accessibilityScore: scored.accessibility,
        relationshipScore: scored.relationshipScore,
        riskScore: scored.risk,
        riskFlags: ["public_identity_only", "submission_route_unverified"],
        eligibility: { source_use: "identity_discovery", actionable_route: false },
        scoreFeatures: scored.features,
        rawPayload: row,
        normalizedPayload: { external_id: externalId, canonical_url: canonicalUrl, title, summary, lane: input.lane },
      };
    }).filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));
    return { sourceSlug: "wikidata", status: "completed", candidates, nextCursor: null, rateLimit: { guidance: "Respect Wikimedia User-Agent and retry-after policies." } };
  },
};
