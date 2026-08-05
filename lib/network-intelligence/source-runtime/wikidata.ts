import "server-only";
import type { DiscoveryCandidate, SourceAdapter } from "./types";
import { SOURCE_POLICIES } from "./policy";
import { scoreDiscovery } from "./scoring";
import { identityClusterKey } from "./identity";
import { wikidataCandidateKind, wikidataClaimEntityIds, wikidataClaimStrings, wikidataExternalIdentifiers } from "./wikidata-helpers";

const MAX_BYTES = 2_000_000;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function fetchWikidata(url: URL) {
  const origin = process.env.ARTISTOS_PUBLIC_ORIGIN || "https://artistos-next.vercel.app";
  const contact = process.env.ARTISTOS_SOURCE_CONTACT || `${origin}/contact`;
  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip,deflate", "User-Agent": `ArtistOS/0.2 (${contact})` },
      cache: "force-cache",
      next: { revalidate: SOURCE_POLICIES.wikidata.cacheTtlSeconds },
      signal: AbortSignal.timeout(12_000),
    });
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) throw new Error("wikidata_response_too_large");
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("wikidata_response_too_large");
    if (response.ok) return objectValue(JSON.parse(text || "{}"));
    if (![429, 503].includes(response.status) || attempts >= 2) throw new Error(`wikidata_request_failed:${response.status}`);
    const retryAfter = Math.min(2, Math.max(0.25, Number(response.headers.get("retry-after") ?? 1)));
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  }
  throw new Error("wikidata_request_failed");
}

export const wikidataAdapter: SourceAdapter = {
  slug: "wikidata",
  policy: SOURCE_POLICIES.wikidata,
  health: () => ({ status: "available", detail: "Public CC0 identity search and entity enrichment are available without credentials." }),
  async search(input) {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("search", input.query);
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("uselang", "en");
    searchUrl.searchParams.set("type", "item");
    searchUrl.searchParams.set("limit", String(Math.max(1, Math.min(25, input.maxResults))));
    searchUrl.searchParams.set("format", "json");
    const searchPayload = await fetchWikidata(searchUrl);
    const searchRows = Array.isArray(searchPayload.search) ? searchPayload.search.map(objectValue) : [];
    const ids = searchRows.map((row) => typeof row.id === "string" ? row.id : null).filter((id): id is string => Boolean(id));

    let entities: Record<string, unknown> = {};
    let requestCount = 1;
    if (ids.length) {
      const entityUrl = new URL("https://www.wikidata.org/w/api.php");
      entityUrl.searchParams.set("action", "wbgetentities");
      entityUrl.searchParams.set("ids", ids.join("|"));
      entityUrl.searchParams.set("props", "claims|labels|descriptions|info");
      entityUrl.searchParams.set("languages", "en");
      entityUrl.searchParams.set("format", "json");
      const entityPayload = await fetchWikidata(entityUrl);
      entities = objectValue(entityPayload.entities);
      requestCount += 1;
    }

    const observedAt = new Date().toISOString();
    const candidates = searchRows.map((row): DiscoveryCandidate | null => {
      const externalId = typeof row.id === "string" ? row.id : null;
      const title = typeof row.label === "string" ? row.label : null;
      if (!externalId || !title) return null;
      const entity = objectValue(entities[externalId]);
      const summary = typeof row.description === "string" ? row.description : null;
      const sourceRecordUrl = `https://www.wikidata.org/wiki/${encodeURIComponent(externalId)}`;
      const officialWebsites = wikidataClaimStrings(entity, "P856").filter((value) => /^https?:\/\//i.test(value));
      const identityUrls = [...new Set(officialWebsites)];
      const externalIdentifiers = wikidataExternalIdentifiers(entity, externalId);
      const instanceOf = wikidataClaimEntityIds(entity, "P31");
      const candidateKind = wikidataCandidateKind(entity, input.lane);
      const canonicalUrl = officialWebsites[0] ?? sourceRecordUrl;
      const scored = scoreDiscovery({ title, summary, query: input.query, fitContext: input.fitContext, lane: input.lane, sourceSlug: "wikidata" });
      const confidence = officialWebsites.length || instanceOf.length ? "supported" as const : "weak" as const;
      const riskFlags = ["public_identity_only", "submission_route_unverified"];
      if (!officialWebsites.length) riskFlags.push("official_website_missing");
      if (!instanceOf.length) riskFlags.push("entity_type_unverified");
      const observation = {
        sourceSlug: "wikidata" as const,
        sourcePolicyDisposition: SOURCE_POLICIES.wikidata.disposition,
        externalId,
        canonicalUrl: sourceRecordUrl,
        observedAt,
        identityUrls,
        externalIdentifiers,
        rawPayload: { search: row, entity },
        normalizedPayload: {
          wikidata_id: externalId,
          source_url: sourceRecordUrl,
          title,
          summary,
          official_websites: officialWebsites,
          instance_of: instanceOf,
          candidate_kind: candidateKind,
          external_identifiers: externalIdentifiers,
        },
      };
      const base = {
        sourceSlug: "wikidata" as const,
        sourcePolicyDisposition: SOURCE_POLICIES.wikidata.disposition,
        externalId,
        canonicalUrl,
        title,
        summary,
        candidateKind,
        opportunityType: input.lane,
        observedAt,
        freshnessStatus: "unknown" as const,
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
        eligibility: { source_use: "identity_discovery", actionable_route: false, entity_type_supported: instanceOf.length > 0 },
        scoreFeatures: scored.features,
        rawPayload: observation.rawPayload,
        normalizedPayload: observation.normalizedPayload,
        identityUrls,
        externalIdentifiers,
        discoveryClusterKey: "",
        corroboratingSources: ["wikidata" as const],
        sourceObservations: [observation],
      };
      return { ...base, discoveryClusterKey: identityClusterKey(base) };
    }).filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));

    return {
      sourceSlug: "wikidata",
      status: "completed",
      candidates,
      nextCursor: null,
      requestCount,
      rateLimit: { guidance: "One search plus one batched entity-enrichment request; cached for 24 hours; honor Retry-After and backoff." },
      warnings: ["identity_and_classification_do_not_prove_submission_permission"],
    };
  },
};
