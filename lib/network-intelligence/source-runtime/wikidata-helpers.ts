import type { DiscoveryCandidate, SearchLane } from "./types";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function wikidataClaimStrings(entity: Record<string, unknown>, property: string) {
  const claims = objectValue(entity.claims);
  const rows = Array.isArray(claims[property]) ? claims[property] as unknown[] : [];
  return rows.map((claim) => {
    const mainsnak = objectValue(objectValue(claim).mainsnak);
    const datavalue = objectValue(mainsnak.datavalue);
    return typeof datavalue.value === "string" ? datavalue.value : null;
  }).filter((value): value is string => Boolean(value));
}

export function wikidataClaimEntityIds(entity: Record<string, unknown>, property: string) {
  const claims = objectValue(entity.claims);
  const rows = Array.isArray(claims[property]) ? claims[property] as unknown[] : [];
  return rows.map((claim) => {
    const mainsnak = objectValue(objectValue(claim).mainsnak);
    const datavalue = objectValue(mainsnak.datavalue);
    const value = objectValue(datavalue.value);
    return typeof value.id === "string" ? value.id : null;
  }).filter((value): value is string => Boolean(value));
}

export function wikidataExternalIdentifiers(entity: Record<string, unknown>, wikidataId: string) {
  const result: Record<string, string> = { wikidata_id: wikidataId };
  const mappings = [
    ["P434", "musicbrainz_artist_id"],
    ["P966", "musicbrainz_label_id"],
    ["P2397", "youtube_channel_id"],
    ["P646", "freebase_id"],
    ["P214", "viaf_id"],
  ] as const;
  for (const [property, key] of mappings) {
    const value = wikidataClaimStrings(entity, property)[0];
    if (value) result[key] = value;
  }
  return result;
}

export function wikidataCandidateKind(entity: Record<string, unknown>, lane: SearchLane): DiscoveryCandidate["candidateKind"] {
  const instances = new Set(wikidataClaimEntityIds(entity, "P31"));
  if (instances.has("Q5")) return "person";
  if (instances.has("Q14350") || instances.has("Q20899") || instances.has("Q24634210")) return "property";
  if (instances.has("Q18127")) return "organization";
  if (["radio", "podcast", "playlist", "youtube_channel"].includes(lane) && instances.size > 0) return "property";
  if (["label", "sync", "music_library", "booking", "publication"].includes(lane) && instances.size > 0) return "organization";
  return "unknown";
}
