import type { DiscoveryCandidate } from "./types";
export function normalizeName(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

type ExistingOrganization = {
  id: string;
  canonical_name: string;
  display_name: string | null;
  website: string | null;
  primary_source_url: string | null;
};

type ExistingProperty = {
  id: string;
  organization_id: string | null;
  name: string;
  url: string | null;
  platform_url: string | null;
  raw_record: Record<string, unknown> | null;
};

export type MatchSuggestion = {
  entityType: "organization" | "property";
  entityId: string;
  score: number;
  reasons: string[];
  conflicts: string[];
};

function rawExternalIdentifiers(rawRecord: Record<string, unknown> | null) {
  if (!rawRecord) return {} as Record<string, string>;
  const nested = rawRecord.external_identifiers;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return {} as Record<string, string>;
  return Object.fromEntries(Object.entries(nested as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export function findMatches(candidate: DiscoveryCandidate, organizations: ExistingOrganization[], properties: ExistingProperty[]) {
  const title = normalizeName(candidate.title);
  const candidateUrls = [...new Set([candidate.canonicalUrl, ...candidate.identityUrls].map(normalizeUrl).filter(Boolean))];
  const observationIds = new Set(candidate.sourceObservations.map((observation) => `${observation.sourceSlug}:${observation.externalId}`));
  const suggestions: MatchSuggestion[] = [];

  for (const property of properties) {
    const reasons: string[] = [];
    const conflicts: string[] = [];
    let score = 0;
    const rawId = typeof property.raw_record?.external_id === "string" ? property.raw_record.external_id : null;
    const rawSource = typeof property.raw_record?.source_slug === "string" ? property.raw_record.source_slug : null;
    const propertyUrls = [property.url, property.platform_url].map(normalizeUrl).filter(Boolean);
    const existingIdentifiers = rawExternalIdentifiers(property.raw_record);

    if (rawId && rawSource && observationIds.has(`${rawSource}:${rawId}`)) {
      score = 1;
      reasons.push("stable_source_identity_exact");
    }
    for (const [key, value] of Object.entries(candidate.externalIdentifiers)) {
      if (existingIdentifiers[key] === value) {
        score = 1;
        reasons.push(`external_identifier_exact:${key}`);
      }
    }
    if (candidateUrls.some((url) => propertyUrls.includes(url))) {
      score = Math.max(score, 0.99);
      reasons.push("canonical_url_exact");
    }
    if (title && normalizeName(property.name) === title) {
      score = Math.max(score, 0.55);
      reasons.push("normalized_name_exact_unconfirmed");
      if (candidateUrls.length && propertyUrls.length && !candidateUrls.some((url) => propertyUrls.includes(url))) conflicts.push("canonical_url_mismatch");
    }
    if (score >= 0.8) suggestions.push({ entityType: "property", entityId: property.id, score, reasons: [...new Set(reasons)], conflicts: [...new Set(conflicts)] });
  }

  for (const organization of organizations) {
    const reasons: string[] = [];
    const conflicts: string[] = [];
    let score = 0;
    const organizationUrls = [organization.website, organization.primary_source_url].map(normalizeUrl).filter(Boolean);

    if (candidateUrls.some((url) => organizationUrls.includes(url))) {
      score = 0.98;
      reasons.push("canonical_url_exact");
    }
    if (title && [organization.canonical_name, organization.display_name].map(normalizeName).includes(title)) {
      score = Math.max(score, 0.5);
      reasons.push("normalized_name_exact_unconfirmed");
      if (candidateUrls.length && organizationUrls.length && !candidateUrls.some((url) => organizationUrls.includes(url))) conflicts.push("canonical_url_mismatch");
    }
    if (score >= 0.8) suggestions.push({ entityType: "organization", entityId: organization.id, score, reasons: [...new Set(reasons)], conflicts: [...new Set(conflicts)] });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}
