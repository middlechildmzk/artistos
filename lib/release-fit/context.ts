import { normalizeName } from "./scoring";
import type { FeaturedArtistEvidence, ReleaseContext, SimilarArtistRef, TargetContext } from "./scoring";

type ReleaseRow = {
  id: string;
  title: string;
  status: string | null;
  release_date: string | null;
  subgenre_tags?: string[] | null;
  mood_tags?: string[] | null;
  territory_focus?: string[] | null;
  artist_size_band?: string | null;
  primary_language?: string | null;
  vocal_type?: string | null;
  ai_involvement?: string | null;
  ai_disclosure_preference?: string | null;
  lyrical_themes?: string[] | null;
};

type SimilarArtistRow = {
  artist_name: string;
  normalized_name: string;
  external_identifiers: Record<string, string> | null;
  confirmation_state: string;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())) : [];
}

export function buildReleaseContext(args: {
  release: ReleaseRow;
  artistName: string | null;
  artistGenreTags: string[] | null;
  similarArtists: SimilarArtistRow[];
}): ReleaseContext {
  return {
    releaseId: args.release.id,
    title: args.release.title,
    artistName: args.artistName,
    releaseDate: args.release.release_date,
    status: args.release.status,
    // Artist-level genre tags are the only genre signal that exists today. They
    // are used as a fallback and labelled as artist-level in the UI so the user
    // knows the release itself has no recorded genres.
    genreTags: stringArray(args.artistGenreTags),
    subgenreTags: stringArray(args.release.subgenre_tags),
    moodTags: stringArray(args.release.mood_tags),
    territoryFocus: stringArray(args.release.territory_focus),
    artistSizeBand: args.release.artist_size_band ?? null,
    primaryLanguage: args.release.primary_language ?? null,
    confirmedSimilarArtists: args.similarArtists.map(
      (row): SimilarArtistRef => ({
        name: row.artist_name,
        normalizedName: row.normalized_name,
        externalIdentifiers: row.external_identifiers ?? {},
        confirmationState:
          row.confirmation_state === "user_confirmed"
            ? "user_confirmed"
            : row.confirmation_state === "rejected"
              ? "rejected"
              : "inferred",
      }),
    ),
  };
}

type OpportunityRow = {
  id: string;
  title: string;
  opportunity_type?: string | null;
  country?: string | null;
  normalized_payload?: Record<string, unknown> | null;
  eligibility?: Record<string, unknown> | null;
  tags?: string[] | null;
};

/**
 * Reads a tri-state flag. Only an explicit boolean counts. A missing key, a
 * null, or an unparsable value all stay unknown, because "we never asked" is
 * not the same as "no".
 */
function triState(source: Record<string, unknown> | null | undefined, key: string): boolean | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === "boolean" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildTargetContext(args: {
  opportunity: OpportunityRow;
  featuredArtists?: FeaturedArtistEvidence[];
  audienceValue?: number | null;
  audienceObservedAt?: string | null;
}): TargetContext {
  const normalized = args.opportunity.normalized_payload ?? null;
  const eligibility = args.opportunity.eligibility ?? null;
  return {
    opportunityId: args.opportunity.id,
    title: args.opportunity.title,
    genreTags: stringArray(args.opportunity.tags ?? normalized?.genre_tags),
    moodTags: stringArray(normalized?.mood_tags),
    country: args.opportunity.country ?? null,
    featuredArtists: args.featuredArtists ?? [],
    acceptsReleased: triState(eligibility, "accepts_released"),
    acceptsUnreleased: triState(eligibility, "accepts_unreleased"),
    audienceValue: args.audienceValue ?? numberOrNull(normalized?.subscriber_count) ?? null,
    audienceObservedAt: args.audienceObservedAt ?? null,
    targetsEmergingArtists: triState(eligibility, "targets_emerging_artists"),
  };
}

/**
 * Featured-artist evidence must carry external identifiers to be usable. Rows
 * that only carry a name are still returned so the UI can show them, but they
 * are marked so the scorer will refuse to treat them as a match.
 */
export function buildFeaturedArtistEvidence(
  observations: { normalized_payload?: Record<string, unknown> | null; evidence_id?: string | null; observed_at?: string | null }[],
): FeaturedArtistEvidence[] {
  const results: FeaturedArtistEvidence[] = [];
  for (const observation of observations) {
    const featured = observation.normalized_payload?.featured_artists;
    if (!Array.isArray(featured)) continue;
    for (const entry of featured) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : null;
      if (!name) continue;
      const identifiers =
        record.external_identifiers && typeof record.external_identifiers === "object" && !Array.isArray(record.external_identifiers)
          ? Object.fromEntries(
              Object.entries(record.external_identifiers as Record<string, unknown>).filter(
                (pair): pair is [string, string] => typeof pair[1] === "string",
              ),
            )
          : {};
      results.push({
        normalizedName: normalizeName(name),
        externalIdentifiers: identifiers,
        evidenceId: observation.evidence_id ?? null,
        observedAt: observation.observed_at ?? null,
      });
    }
  }
  return results;
}

/** Fields with no recorded value, for the "what is missing" prompt in the UI. */
export function missingReleaseMetadata(release: ReleaseContext) {
  const missing: string[] = [];
  if (!release.subgenreTags.length) missing.push("subgenres");
  if (!release.moodTags.length) missing.push("moods");
  if (!release.confirmedSimilarArtists.some((artist) => artist.confirmationState === "user_confirmed"))
    missing.push("confirmed similar artists");
  if (!release.territoryFocus.length) missing.push("territory focus");
  if (!release.artistSizeBand) missing.push("artist size");
  return missing;
}
