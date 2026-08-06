
/**
 * Release-fit scoring.
 *
 * Two rules govern every dimension in this file.
 *
 * 1. A dimension returns null when the evidence needed to compute it is absent.
 *    Null renders as "unknown". It never renders as zero, and it never
 *    contributes to the overall score in either direction.
 * 2. The overall score is the evidence-weighted mean of the dimensions that
 *    could actually be computed, and it is always reported alongside the
 *    number of dimensions that were unknown. A candidate scored on one
 *    dimension is never presented as equivalent to one scored on six.
 *
 * Nothing here is calibrated against observed outcomes, so nothing here is a
 * probability. Callers must present these as relative ranking signals only.
 */

/**
 * Local copy of the shared name normalizer. Duplicated deliberately so this
 * module stays dependency-free and directly executable by the test runner.
 * tests/release-fit-sourcing-v1.test.mjs asserts it agrees with the shared
 * implementation in lib/network-intelligence/source-runtime/matching.ts.
 */
export function normalizeName(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export type FitDimensionKey =
  | "genre_overlap"
  | "similar_artist_overlap"
  | "mood_overlap"
  | "release_stage_eligibility"
  | "artist_size_fit"
  | "territory_fit";

export type FitDimension = {
  key: FitDimensionKey;
  label: string;
  /** null means the evidence required to compute this dimension was absent. */
  value: number | null;
  weight: number;
  explanation: string;
  evidenceRefs: string[];
  unknownReason: string | null;
};

export type ReleaseContext = {
  releaseId: string;
  title: string;
  artistName: string | null;
  releaseDate: string | null;
  status: string | null;
  genreTags: string[];
  subgenreTags: string[];
  moodTags: string[];
  territoryFocus: string[];
  artistSizeBand: string | null;
  primaryLanguage: string | null;
  /** Only user-confirmed comparable artists are eligible as fit evidence. */
  confirmedSimilarArtists: SimilarArtistRef[];
};

export type SimilarArtistRef = {
  name: string;
  normalizedName: string;
  externalIdentifiers: Record<string, string>;
  confirmationState: "user_confirmed" | "inferred" | "rejected";
};

export type TargetContext = {
  opportunityId: string;
  title: string;
  genreTags: string[];
  moodTags: string[];
  country: string | null;
  /** Artist names the target is evidenced to have featured, with provenance. */
  featuredArtists: FeaturedArtistEvidence[];
  acceptsReleased: boolean | null;
  acceptsUnreleased: boolean | null;
  audienceValue: number | null;
  audienceObservedAt: string | null;
  targetsEmergingArtists: boolean | null;
};

export type FeaturedArtistEvidence = {
  normalizedName: string;
  externalIdentifiers: Record<string, string>;
  evidenceId: string | null;
  observedAt: string | null;
};

const DIMENSION_WEIGHTS: Record<FitDimensionKey, number> = {
  genre_overlap: 30,
  similar_artist_overlap: 25,
  mood_overlap: 10,
  release_stage_eligibility: 20,
  artist_size_fit: 10,
  territory_fit: 5,
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizedSet(values: string[]) {
  return new Set(values.map((value) => normalizeName(value)).filter(Boolean));
}

/**
 * Jaccard-style overlap that is only defined when BOTH sides carry evidence.
 * An empty target tag list means we do not know the target's genres, which is
 * different from knowing the target's genres do not overlap.
 */
function overlapRatio(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return null;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return clamp01(shared / Math.min(left.size, right.size));
}

function genreDimension(release: ReleaseContext, target: TargetContext): FitDimension {
  const releaseTags = normalizedSet([...release.genreTags, ...release.subgenreTags]);
  const targetTags = normalizedSet(target.genreTags);
  const ratio = overlapRatio(releaseTags, targetTags);
  if (ratio === null) {
    return {
      key: "genre_overlap",
      label: "Genre match",
      value: null,
      weight: DIMENSION_WEIGHTS.genre_overlap,
      explanation: "Genre overlap could not be computed.",
      evidenceRefs: [],
      unknownReason: !releaseTags.size
        ? "No genre or subgenre tags are recorded on this release."
        : "No genre evidence has been observed for this target.",
    };
  }
  const shared = [...releaseTags].filter((tag) => targetTags.has(tag));
  return {
    key: "genre_overlap",
    label: "Genre match",
    value: ratio,
    weight: DIMENSION_WEIGHTS.genre_overlap,
    explanation: shared.length
      ? `Shares ${shared.length} recorded genre ${shared.length === 1 ? "tag" : "tags"}: ${shared.join(", ")}.`
      : "No recorded genre tags are shared between this release and this target.",
    evidenceRefs: [],
    unknownReason: null,
  };
}

/**
 * Similar-artist overlap requires a confirmed comparable artist AND a target
 * that is evidenced to have featured that artist, matched on external identity.
 * Name-only agreement is deliberately rejected: two acts can share a name.
 */
function similarArtistDimension(release: ReleaseContext, target: TargetContext): FitDimension {
  const confirmed = release.confirmedSimilarArtists.filter(
    (artist) => artist.confirmationState === "user_confirmed",
  );
  if (!confirmed.length) {
    return {
      key: "similar_artist_overlap",
      label: "Similar-artist overlap",
      value: null,
      weight: DIMENSION_WEIGHTS.similar_artist_overlap,
      explanation: "Similar-artist overlap could not be computed.",
      evidenceRefs: [],
      unknownReason: "No comparable artists have been confirmed for this release.",
    };
  }
  if (!target.featuredArtists.length) {
    return {
      key: "similar_artist_overlap",
      label: "Similar-artist overlap",
      value: null,
      weight: DIMENSION_WEIGHTS.similar_artist_overlap,
      explanation: "Similar-artist overlap could not be computed.",
      evidenceRefs: [],
      unknownReason: "No featured-artist evidence has been observed for this target.",
    };
  }

  const matched: { name: string; evidenceId: string | null }[] = [];
  for (const artist of confirmed) {
    for (const featured of target.featuredArtists) {
      const sharedIdentity = Object.entries(artist.externalIdentifiers).some(
        ([scheme, value]) => value && featured.externalIdentifiers[scheme] === value,
      );
      // External identity is required. Matching names alone is not evidence.
      if (sharedIdentity) {
        matched.push({ name: artist.name, evidenceId: featured.evidenceId });
        break;
      }
    }
  }

  const nameOnlyCollisions = confirmed.filter((artist) =>
    target.featuredArtists.some(
      (featured) =>
        featured.normalizedName === artist.normalizedName &&
        !Object.entries(artist.externalIdentifiers).some(
          ([scheme, value]) => value && featured.externalIdentifiers[scheme] === value,
        ),
    ),
  );

  if (!matched.length) {
    return {
      key: "similar_artist_overlap",
      label: "Similar-artist overlap",
      value: 0,
      weight: DIMENSION_WEIGHTS.similar_artist_overlap,
      explanation: nameOnlyCollisions.length
        ? `No confirmed comparable artist matched on external identity. ${nameOnlyCollisions.length} name-only ${nameOnlyCollisions.length === 1 ? "collision was" : "collisions were"} found and deliberately ignored.`
        : "This target has no observed overlap with the confirmed comparable artists.",
      evidenceRefs: [],
      unknownReason: null,
    };
  }

  const ratio = clamp01(matched.length / confirmed.length);
  const names = matched.map((entry) => entry.name);
  return {
    key: "similar_artist_overlap",
    label: "Similar-artist overlap",
    value: ratio,
    weight: DIMENSION_WEIGHTS.similar_artist_overlap,
    explanation: `Featured ${matched.length} selected comparable ${matched.length === 1 ? "artist" : "artists"} matched on external identity: ${names.join(", ")}.`,
    evidenceRefs: matched.map((entry) => entry.evidenceId).filter((id): id is string => Boolean(id)),
    unknownReason: null,
  };
}

function moodDimension(release: ReleaseContext, target: TargetContext): FitDimension {
  const ratio = overlapRatio(normalizedSet(release.moodTags), normalizedSet(target.moodTags));
  if (ratio === null) {
    return {
      key: "mood_overlap",
      label: "Mood fit",
      value: null,
      weight: DIMENSION_WEIGHTS.mood_overlap,
      explanation: "Mood fit could not be computed.",
      evidenceRefs: [],
      unknownReason: release.moodTags.length
        ? "No mood evidence has been observed for this target."
        : "No mood tags are recorded on this release.",
    };
  }
  return {
    key: "mood_overlap",
    label: "Mood fit",
    value: ratio,
    weight: DIMENSION_WEIGHTS.mood_overlap,
    explanation: ratio > 0 ? "Recorded moods overlap." : "No recorded moods are shared.",
    evidenceRefs: [],
    unknownReason: null,
  };
}

/**
 * Release-stage eligibility is a hard gate, not a preference. A target that is
 * evidenced to accept only unreleased material is not a partial fit for a
 * released track; it scores zero and the caller should surface it as ineligible.
 */
function releaseStageDimension(release: ReleaseContext, target: TargetContext): FitDimension {
  const isReleased = release.status === "released" || release.status === "catalog";
  const relevantFlag = isReleased ? target.acceptsReleased : target.acceptsUnreleased;
  if (relevantFlag === null || relevantFlag === undefined) {
    return {
      key: "release_stage_eligibility",
      label: "Release-stage fit",
      value: null,
      weight: DIMENSION_WEIGHTS.release_stage_eligibility,
      explanation: "Release-stage eligibility could not be confirmed.",
      evidenceRefs: [],
      unknownReason: `No evidence records whether this target accepts ${isReleased ? "released" : "unreleased"} material.`,
    };
  }
  return {
    key: "release_stage_eligibility",
    label: "Release-stage fit",
    value: relevantFlag ? 1 : 0,
    weight: DIMENSION_WEIGHTS.release_stage_eligibility,
    explanation: relevantFlag
      ? `Evidenced to accept ${isReleased ? "released" : "unreleased"} music.`
      : `Evidenced to not accept ${isReleased ? "released" : "unreleased"} music.`,
    evidenceRefs: [],
    unknownReason: null,
  };
}

function artistSizeDimension(release: ReleaseContext, target: TargetContext): FitDimension {
  if (!release.artistSizeBand || target.targetsEmergingArtists === null) {
    return {
      key: "artist_size_fit",
      label: "Artist-size fit",
      value: null,
      weight: DIMENSION_WEIGHTS.artist_size_fit,
      explanation: "Artist-size fit could not be computed.",
      evidenceRefs: [],
      unknownReason: !release.artistSizeBand
        ? "No artist-size band is recorded for this release."
        : "No evidence records the artist size this target works with.",
    };
  }
  const emergingRelease = release.artistSizeBand === "emerging" || release.artistSizeBand === "developing";
  const aligned = emergingRelease === target.targetsEmergingArtists;
  return {
    key: "artist_size_fit",
    label: "Artist-size fit",
    value: aligned ? 1 : 0.25,
    weight: DIMENSION_WEIGHTS.artist_size_fit,
    explanation: aligned
      ? `Works with ${emergingRelease ? "emerging and independent" : "established"} artists, matching this release.`
      : "Typically works with a different artist size than this release.",
    evidenceRefs: [],
    unknownReason: null,
  };
}

function territoryDimension(release: ReleaseContext, target: TargetContext): FitDimension {
  if (!release.territoryFocus.length || !target.country) {
    return {
      key: "territory_fit",
      label: "Territory fit",
      value: null,
      weight: DIMENSION_WEIGHTS.territory_fit,
      explanation: "Territory fit could not be computed.",
      evidenceRefs: [],
      unknownReason: release.territoryFocus.length
        ? "No country evidence has been observed for this target."
        : "No territory focus is recorded on this release.",
    };
  }
  const focus = normalizedSet(release.territoryFocus);
  const matched = focus.has(normalizeName(target.country));
  return {
    key: "territory_fit",
    label: "Territory fit",
    value: matched ? 1 : 0.3,
    weight: DIMENSION_WEIGHTS.territory_fit,
    explanation: matched
      ? `Located in a recorded target territory (${target.country}).`
      : `Located outside the recorded territory focus (${target.country}).`,
    evidenceRefs: [],
    unknownReason: null,
  };
}

export type ReleaseFitResult = {
  /** 0 to 100, or null when no dimension could be computed at all. */
  overall: number | null;
  dimensions: FitDimension[];
  knownDimensionCount: number;
  unknownDimensionCount: number;
  /** Weight of the dimensions that were computable, as a share of total weight. */
  evidenceCoverage: number;
  /** Human-readable lines that are safe to display because each is evidenced. */
  explanations: string[];
  /** True when the target is evidenced ineligible for this release stage. */
  ineligible: boolean;
  scoringVersion: "release-fit-v1";
};

export function scoreReleaseFit(release: ReleaseContext, target: TargetContext): ReleaseFitResult {
  const dimensions = [
    genreDimension(release, target),
    similarArtistDimension(release, target),
    moodDimension(release, target),
    releaseStageDimension(release, target),
    artistSizeDimension(release, target),
    territoryDimension(release, target),
  ];

  const known = dimensions.filter((dimension) => dimension.value !== null);
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const knownWeight = known.reduce((sum, dimension) => sum + dimension.weight, 0);

  const overall = knownWeight
    ? Math.round(
        (known.reduce((sum, dimension) => sum + (dimension.value ?? 0) * dimension.weight, 0) / knownWeight) * 100,
      )
    : null;

  const stage = dimensions.find((dimension) => dimension.key === "release_stage_eligibility");

  return {
    overall,
    dimensions,
    knownDimensionCount: known.length,
    unknownDimensionCount: dimensions.length - known.length,
    evidenceCoverage: totalWeight ? knownWeight / totalWeight : 0,
    explanations: known
      .filter((dimension) => (dimension.value ?? 0) > 0)
      .sort((a, b) => (b.value ?? 0) * b.weight - (a.value ?? 0) * a.weight)
      .map((dimension) => dimension.explanation),
    ineligible: stage?.value === 0,
    scoringVersion: "release-fit-v1",
  };
}

/**
 * Audience signal is reported separately and is never folded into the fit
 * score. Popularity is context for a human, not a ranking input.
 */
export function describeAudienceSignal(target: TargetContext) {
  if (target.audienceValue === null) {
    return { value: null, label: "Audience signal unknown", asOf: null, stale: null };
  }
  const asOf = target.audienceObservedAt;
  const ageDays = asOf ? (Date.now() - new Date(asOf).getTime()) / 86_400_000 : null;
  return {
    value: target.audienceValue,
    label: `${target.audienceValue.toLocaleString("en-US")} reported`,
    asOf,
    stale: ageDays === null ? null : ageDays > 30,
  };
}
