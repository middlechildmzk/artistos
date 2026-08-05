import type { DiscoveryCandidate, SourceSlug } from "./types";

const PROVIDER_HOSTS = new Set([
  "www.wikidata.org",
  "wikidata.org",
  "de1.api.radio-browser.info",
  "nl1.api.radio-browser.info",
  "at1.api.radio-browser.info",
  "all.api.radio-browser.info",
]);

export function normalizeIdentityUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${host}${pathname}`;
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function identityTokens(candidate: Pick<DiscoveryCandidate, "identityUrls" | "externalIdentifiers">) {
  const urlTokens = candidate.identityUrls.map(normalizeIdentityUrl).filter(Boolean).map((url) => `url:${url}`);
  const idTokens = Object.entries(candidate.externalIdentifiers)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `id:${key}:${String(value).trim().toLowerCase()}`);
  return [...new Set([...urlTokens, ...idTokens])];
}

function preferredClusterToken(candidate: Pick<DiscoveryCandidate, "identityUrls" | "externalIdentifiers" | "sourceSlug" | "externalId">) {
  const normalized = [...new Set(candidate.identityUrls.map(normalizeIdentityUrl).filter(Boolean))];
  const official = normalized.find((value) => !PROVIDER_HOSTS.has(value.split("/")[0]));
  if (official) return `url:${official}`;
  const stableIdentifier = Object.entries(candidate.externalIdentifiers)
    .filter(([, value]) => Boolean(value))
    .sort(([left], [right]) => left.localeCompare(right))[0];
  if (stableIdentifier) return `id:${stableIdentifier[0]}:${String(stableIdentifier[1]).trim().toLowerCase()}`;
  return `source:${candidate.sourceSlug}:${candidate.externalId}`;
}

export function identityClusterKey(candidate: Pick<DiscoveryCandidate, "identityUrls" | "externalIdentifiers" | "sourceSlug" | "externalId">) {
  return preferredClusterToken(candidate);
}

function confidenceRank(value: DiscoveryCandidate["confidence"]) {
  return { verified: 6, supported: 5, weak: 4, unknown: 3, stale: 2, conflicting: 1 }[value] ?? 0;
}

function candidateRank(candidate: DiscoveryCandidate) {
  return candidate.identityUrls.length * 10
    + Object.keys(candidate.externalIdentifiers).length * 6
    + confidenceRank(candidate.confidence) * 3
    + candidate.fitScore / 100;
}

export function mergeCandidateClusters(candidates: DiscoveryCandidate[]) {
  const parent = candidates.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  const tokenOwner = new Map<string, number>();
  candidates.forEach((candidate, index) => {
    for (const token of identityTokens(candidate)) {
      const owner = tokenOwner.get(token);
      if (owner == null) tokenOwner.set(token, index);
      else union(index, owner);
    }
  });

  const groups = new Map<number, DiscoveryCandidate[]>();
  candidates.forEach((candidate, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), candidate]);
  });

  return [...groups.values()].map((group) => {
    const primary = [...group].sort((a, b) => candidateRank(b) - candidateRank(a))[0];
    const sources = [...new Set(group.flatMap((candidate) => candidate.corroboratingSources.length ? candidate.corroboratingSources : [candidate.sourceSlug]))] as SourceSlug[];
    const observations = group.flatMap((candidate) => candidate.sourceObservations);
    const observationKeys = new Set<string>();
    const uniqueObservations = observations.filter((observation) => {
      const key = `${observation.sourceSlug}:${observation.externalId}`;
      if (observationKeys.has(key)) return false;
      observationKeys.add(key);
      return true;
    });
    const identityUrls = [...new Set(group.flatMap((candidate) => candidate.identityUrls).filter(Boolean))];
    const externalIdentifiers = Object.assign({}, ...group.map((candidate) => candidate.externalIdentifiers));
    const clusterKey = preferredClusterToken({ ...primary, identityUrls, externalIdentifiers });
    const corroborated = sources.length > 1;
    const scoreFeatures = [...primary.scoreFeatures];
    if (corroborated) {
      scoreFeatures.push({
        key: "cross_source_corroboration",
        value: sources.length,
        label: "Cross-source identity corroboration",
        weight: 0,
        contribution: 0,
        explanation: `${sources.length} approved sources share a stable identity URL or identifier. This strengthens identity confidence, not outreach permission or legitimacy.`,
      });
    }
    return {
      ...primary,
      confidence: corroborated && primary.confidence !== "verified" ? "supported" as const : primary.confidence,
      discoveryClusterKey: clusterKey,
      corroboratingSources: sources,
      sourceObservations: uniqueObservations,
      identityUrls,
      externalIdentifiers,
      scoreFeatures,
      riskFlags: [...new Set(group.flatMap((candidate) => candidate.riskFlags))],
      normalizedPayload: {
        ...primary.normalizedPayload,
        discovery_cluster_key: clusterKey,
        corroborating_sources: sources,
        corroboration_count: sources.length,
        identity_urls: identityUrls,
        external_identifiers: externalIdentifiers,
      },
    };
  }).sort((a, b) => b.fitScore - a.fitScore || b.corroboratingSources.length - a.corroboratingSources.length || a.title.localeCompare(b.title));
}
