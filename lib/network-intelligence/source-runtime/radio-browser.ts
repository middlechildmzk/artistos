import "server-only";
import type { DiscoveryCandidate, SourceAdapter } from "./types";
import { SOURCE_POLICIES } from "./policy";
import { scoreDiscovery } from "./scoring";
import { identityClusterKey } from "./identity";
import { radioBrowserSearchParams, radioFreshness, safeHttpUrl, splitTags } from "./radio-browser-helpers";

const MAX_BYTES = 2_000_000;
const DEFAULT_ORIGINS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
async function fetchStations(input: { query: string; fitContext?: string | null; maxResults: number }) {
  const configured = process.env.RADIO_BROWSER_API_ORIGIN?.trim();
  const origins = configured ? [configured.replace(/\/+$/, "")] : DEFAULT_ORIGINS;
  let lastError: Error | null = null;
  for (const origin of origins) {
    try {
      const url = new URL("/json/stations/search", origin);
      const params = radioBrowserSearchParams(input.query, input.fitContext);
      params.set("limit", String(Math.max(1, Math.min(25, input.maxResults))));
      url.search = params.toString();
      const contact = process.env.ARTISTOS_SOURCE_CONTACT || "https://artistos-next.vercel.app/contact";
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": `ArtistOS/0.2 (${contact})` },
        cache: "force-cache",
        next: { revalidate: SOURCE_POLICIES.radio_browser.cacheTtlSeconds },
        signal: AbortSignal.timeout(10_000),
      });
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_BYTES) throw new Error("radio_browser_response_too_large");
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("radio_browser_response_too_large");
      if (!response.ok) throw new Error(`radio_browser_request_failed:${response.status}`);
      const payload = JSON.parse(text || "[]");
      if (!Array.isArray(payload)) throw new Error("radio_browser_response_invalid");
      return { rows: payload.map(objectValue), requestUrl: url.toString(), origin };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("radio_browser_request_failed");
    }
  }
  throw lastError ?? new Error("radio_browser_unavailable");
}

export const radioBrowserAdapter: SourceAdapter = {
  slug: "radio_browser",
  policy: SOURCE_POLICIES.radio_browser,
  health: () => ({ status: "available", detail: "Public community radio directory available without credentials; results are identity and stream-health observations, not submission permission." }),
  async search(input) {
    if (input.lane !== "radio") {
      return { sourceSlug: "radio_browser", status: "skipped", candidates: [], nextCursor: null, requestCount: 0, rateLimit: {}, warnings: ["source_lane_not_supported"], error: "source_lane_not_supported" };
    }
    const { rows, requestUrl, origin } = await fetchStations(input);
    const observedAt = new Date().toISOString();
    const candidates = rows.map((row): DiscoveryCandidate | null => {
      const externalId = typeof row.stationuuid === "string" ? row.stationuuid : null;
      const title = typeof row.name === "string" ? row.name.trim() : null;
      if (!externalId || !title) return null;
      const homepage = safeHttpUrl(row.homepage);
      const streamUrl = safeHttpUrl(row.url_resolved) ?? safeHttpUrl(row.url);
      const tags = splitTags(row.tags);
      const countryCode = typeof row.countrycode === "string" ? row.countrycode : null;
      const country = typeof row.country === "string" ? row.country : null;
      const state = typeof row.state === "string" ? row.state : null;
      const language = typeof row.language === "string" ? row.language : null;
      const lastCheckIso = typeof row.lastchecktime_iso8601 === "string" ? row.lastchecktime_iso8601 : null;
      const lastCheckOk = row.lastcheckok === 1 || row.lastcheckok === "1" || row.lastcheckok === true;
      const freshnessStatus = radioFreshness(lastCheckIso, lastCheckOk);
      const sourceRecordUrl = `${origin}/json/stations/byuuid?uuids=${encodeURIComponent(externalId)}`;
      const canonicalUrl = homepage ?? sourceRecordUrl;
      const summaryParts = [countryCode || country, state, tags.slice(0, 6).join(", "), language].filter(Boolean);
      const summary = summaryParts.length ? summaryParts.join(" · ") : "Public internet-radio directory record";
      const scored = scoreDiscovery({ title, summary, query: input.query, fitContext: input.fitContext, lane: input.lane, sourceSlug: "radio_browser" });
      const identityUrls = [homepage, streamUrl].filter((value): value is string => Boolean(value));
      const externalIdentifiers = { radio_browser_station_uuid: externalId };
      const confidence = homepage && lastCheckOk ? "supported" as const : "weak" as const;
      const riskFlags = ["community_directory_record", "submission_route_unverified"];
      if (!homepage) riskFlags.push("homepage_missing");
      if (!lastCheckOk) riskFlags.push("stream_offline_or_unverified");
      const observation = {
        sourceSlug: "radio_browser" as const,
        sourcePolicyDisposition: SOURCE_POLICIES.radio_browser.disposition,
        externalId,
        canonicalUrl: sourceRecordUrl,
        observedAt,
        identityUrls,
        externalIdentifiers,
        rawPayload: row,
        normalizedPayload: {
          station_uuid: externalId,
          name: title,
          homepage,
          stream_url: streamUrl,
          tags,
          country_code: countryCode,
          state,
          language,
          last_check_at: lastCheckIso,
          stream_online: lastCheckOk,
          request_url: requestUrl,
        },
      };
      const base = {
        sourceSlug: "radio_browser" as const,
        sourcePolicyDisposition: SOURCE_POLICIES.radio_browser.disposition,
        externalId,
        canonicalUrl,
        title,
        summary,
        candidateKind: "property" as const,
        opportunityType: input.lane,
        observedAt,
        freshnessStatus,
        confidence,
        legitimacyStatus: "unreviewed" as const,
        audienceSignal: null,
        fitScore: scored.fit,
        legitimacyScore: null,
        reachQualityScore: null,
        accessibilityScore: null,
        relationshipScore: null,
        riskScore: null,
        riskFlags,
        eligibility: { source_use: "radio_identity_and_stream_health", actionable_route: false, stream_online: lastCheckOk, country_code: countryCode, tags },
        scoreFeatures: scored.features,
        rawPayload: row,
        normalizedPayload: observation.normalizedPayload,
        identityUrls,
        externalIdentifiers,
        discoveryClusterKey: "",
        corroboratingSources: ["radio_browser" as const],
        sourceObservations: [observation],
      };
      return { ...base, discoveryClusterKey: identityClusterKey(base) };
    }).filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));

    return {
      sourceSlug: "radio_browser",
      status: "completed",
      candidates,
      nextCursor: null,
      requestCount: 1,
      rateLimit: { service: "community_operated", guarantee: "none", cache_ttl_seconds: SOURCE_POLICIES.radio_browser.cacheTtlSeconds },
      warnings: ["directory_identity_not_submission_permission", "service_has_no_availability_guarantee"],
    };
  },
};
