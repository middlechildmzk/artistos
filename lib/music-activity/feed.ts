import { createHash } from "node:crypto";
import {
  deriveMusicActivityFreshness,
  type MusicActivityFreshness,
  type MusicActivitySourceClass,
} from "#music-activity-contract";

export type MusicActivityFeedKind =
  | "metric_snapshot"
  | "playlist_added"
  | "playlist_removed"
  | "link_view"
  | "link_click"
  | "fan_capture"
  | "source_receipt";

export type MusicActivityFeedItem = {
  key: string;
  kind: MusicActivityFeedKind;
  source: string;
  sourceClass: MusicActivitySourceClass;
  title: string;
  detail: string;
  releaseId: string | null;
  releaseTitle: string | null;
  isrc: string | null;
  identityState: "strong_recording_identity" | "release_link_only" | "workspace_signal";
  eventAt: string;
  observedAt: string;
  freshness: MusicActivityFreshness;
  verificationStatus: string;
  sourceUrl: string | null;
};

type ReleaseRow = {
  id: string;
  artist_id: string | null;
  title: string;
  featured_artist?: string | null;
  isrc?: string | null;
  spotify_url?: string | null;
};

type SmartLinkRow = { id: string; release_id: string | null; slug: string };
type LinkEventRow = {
  id: string;
  smart_link_id: string;
  event_type: string;
  destination_service?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
  country_code?: string | null;
  occurred_at: string;
};
type MetricRow = {
  id: string;
  artist_id: string | null;
  release_id: string | null;
  platform: string;
  metric: string;
  value: number | string;
  captured_on: string;
  source_url?: string | null;
};
type PlacementRow = {
  id: string;
  release_id: string | null;
  playlist_name: string;
  playlist_url?: string | null;
  external_playlist_id?: string | null;
  followers?: number | null;
  track_position?: number | null;
  added_at?: string | null;
  removed_at?: string | null;
  last_activity_at?: string | null;
  source_type?: string | null;
  confidence?: number | null;
  verification_state?: string | null;
  last_verified_at?: string | null;
};
type EvidenceRow = {
  id: string;
  artist_id?: string | null;
  release_id?: string | null;
  evidence_type: string;
  source_type?: string | null;
  verification_status?: string | null;
  verification_method?: string | null;
  confidence?: string | null;
  confidence_score?: number | null;
  observed_at: string;
  summary: string;
  source_uri?: string | null;
  metadata?: unknown;
};

function normalizedSourceClass(value: string | null | undefined): MusicActivitySourceClass {
  const normalized = String(value ?? "").toLowerCase();
  if (["licensed", "soundcharts", "chartmetric", "viberate"].includes(normalized)) return "licensed";
  if (["uploaded_file", "source_export", "imported", "export"].includes(normalized)) return "imported";
  if (["api_response", "public", "public_profile", "public_api", "listenbrainz", "audius", "lastfm"].includes(normalized)) return "public";
  if (["oauth", "authorized", "youtube_api", "kit_api"].includes(normalized)) return "authorized";
  if (["manual", "manual_verification"].includes(normalized)) return "manual";
  if (["fingerprinted", "fingerprint", "audio_fingerprint"].includes(normalized)) return "fingerprint";
  if (["inferred", "probable"].includes(normalized)) return "inferred";
  return "owned";
}

function sourceClassForMetric(platform: string): MusicActivitySourceClass {
  const normalized = platform.toLowerCase();
  if (["soundcharts", "chartmetric", "viberate"].includes(normalized)) return "licensed";
  if (["youtube", "kit"].includes(normalized)) return "authorized";
  if (["listenbrainz", "audius", "lastfm", "spotify", "apple_music", "shazam"].includes(normalized)) return "public";
  return "imported";
}

function titleForRelease(release: ReleaseRow | undefined) {
  if (!release) return null;
  return `${release.title}${release.featured_artist ? ` (feat. ${release.featured_artist})` : ""}`;
}

function eventIdentity(release: ReleaseRow | undefined) {
  return release?.isrc
    ? { identityState: "strong_recording_identity" as const, isrc: release.isrc }
    : release
      ? { identityState: "release_link_only" as const, isrc: null }
      : { identityState: "workspace_signal" as const, isrc: null };
}

function stableFeedKey(parts: Array<string | number | null | undefined>) {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex");
}

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function buildMusicActivityFeed(input: {
  releases: ReleaseRow[];
  smartLinks: SmartLinkRow[];
  linkEvents: LinkEventRow[];
  metrics: MetricRow[];
  placements: PlacementRow[];
  evidence: EvidenceRow[];
  now?: Date;
}): MusicActivityFeedItem[] {
  const now = input.now ?? new Date();
  const releasesById = new Map(input.releases.map((release) => [release.id, release]));
  const smartLinksById = new Map(input.smartLinks.map((link) => [link.id, link]));
  const items: MusicActivityFeedItem[] = [];

  for (const event of input.linkEvents) {
    const smartLink = smartLinksById.get(event.smart_link_id);
    const release = smartLink?.release_id ? releasesById.get(smartLink.release_id) : undefined;
    const identity = eventIdentity(release);
    const kind = event.event_type === "page_view"
      ? "link_view"
      : event.event_type === "destination_click"
        ? "link_click"
        : event.event_type === "fan_signup"
          ? "fan_capture"
          : null;
    if (!kind) continue;
    const sourceDetail = kind === "link_click"
      ? `Clicked ${event.destination_service ?? "a release destination"}`
      : kind === "fan_capture"
        ? "Fan signup recorded with ArtistOS consent evidence"
        : "Release page viewed";
    items.push({
      key: stableFeedKey(["link", event.id]),
      kind,
      source: "ArtistOS Links",
      sourceClass: "owned",
      title: titleForRelease(release) ?? "ArtistOS Link",
      detail: `${sourceDetail}${event.country_code ? ` · ${event.country_code}` : ""}`,
      releaseId: release?.id ?? null,
      releaseTitle: titleForRelease(release),
      ...identity,
      eventAt: event.occurred_at,
      observedAt: event.occurred_at,
      freshness: deriveMusicActivityFreshness({ observedAt: event.occurred_at, cadence: "near_real_time", now }),
      verificationStatus: "recorded",
      sourceUrl: smartLink ? `/l/${smartLink.slug}` : null,
    });
  }

  const latestMetrics = new Map<string, MetricRow>();
  for (const metric of input.metrics) {
    const key = `${metric.artist_id ?? "workspace"}:${metric.release_id ?? "all"}:${metric.platform}:${metric.metric}`;
    const existing = latestMetrics.get(key);
    if (!existing || existing.captured_on < metric.captured_on) latestMetrics.set(key, metric);
  }
  for (const metric of latestMetrics.values()) {
    const release = metric.release_id ? releasesById.get(metric.release_id) : undefined;
    const identity = eventIdentity(release);
    items.push({
      key: stableFeedKey(["metric", metric.id]),
      kind: "metric_snapshot",
      source: metric.platform,
      sourceClass: sourceClassForMetric(metric.platform),
      title: release ? titleForRelease(release) ?? metric.metric : metric.metric.replace(/_/g, " "),
      detail: `${metric.metric.replace(/_/g, " ")}: ${metric.value}`,
      releaseId: release?.id ?? metric.release_id ?? null,
      releaseTitle: titleForRelease(release),
      ...identity,
      eventAt: `${metric.captured_on}T12:00:00.000Z`,
      observedAt: `${metric.captured_on}T12:00:00.000Z`,
      freshness: deriveMusicActivityFreshness({ observedAt: `${metric.captured_on}T12:00:00.000Z`, cadence: "daily", now }),
      verificationStatus: "source observed",
      sourceUrl: safeUrl(metric.source_url),
    });
  }

  for (const placement of input.placements) {
    const release = placement.release_id ? releasesById.get(placement.release_id) : undefined;
    const identity = eventIdentity(release);
    const sourceClass = normalizedSourceClass(placement.source_type);
    const eventAt = placement.removed_at ?? placement.last_activity_at ?? placement.added_at ?? placement.last_verified_at;
    if (!eventAt) continue;
    const removed = Boolean(placement.removed_at);
    items.push({
      key: stableFeedKey(["placement", placement.id, removed ? "removed" : "added", eventAt]),
      kind: removed ? "playlist_removed" : "playlist_added",
      source: sourceClass === "licensed" ? "Licensed playlist intelligence" : "Playlist evidence",
      sourceClass,
      title: placement.playlist_name,
      detail: `${removed ? "Removed" : "Placed"}${placement.track_position ? ` at position ${placement.track_position}` : ""}${placement.followers ? ` · ${placement.followers.toLocaleString()} followers` : ""}`,
      releaseId: release?.id ?? placement.release_id ?? null,
      releaseTitle: titleForRelease(release),
      ...identity,
      eventAt,
      observedAt: placement.last_verified_at ?? placement.last_activity_at ?? eventAt,
      freshness: deriveMusicActivityFreshness({ observedAt: placement.last_verified_at ?? placement.last_activity_at ?? eventAt, cadence: "daily", now }),
      verificationStatus: placement.verification_state ?? "unverified",
      sourceUrl: safeUrl(placement.playlist_url),
    });
  }

  for (const evidence of input.evidence) {
    if (["fan_signup", "playlist_placement"].includes(evidence.evidence_type)) continue;
    const release = evidence.release_id ? releasesById.get(evidence.release_id) : undefined;
    const identity = eventIdentity(release);
    const metadata = asObject(evidence.metadata);
    const provider = typeof metadata.provider === "string" ? metadata.provider : evidence.verification_method ?? evidence.source_type ?? "Proof";
    items.push({
      key: stableFeedKey(["evidence", evidence.id]),
      kind: "source_receipt",
      source: provider,
      sourceClass: normalizedSourceClass(typeof metadata.source_class === "string" ? metadata.source_class : evidence.source_type),
      title: release ? titleForRelease(release) ?? evidence.evidence_type : evidence.evidence_type.replace(/_/g, " "),
      detail: evidence.summary,
      releaseId: release?.id ?? evidence.release_id ?? null,
      releaseTitle: titleForRelease(release),
      ...identity,
      eventAt: evidence.observed_at,
      observedAt: evidence.observed_at,
      freshness: deriveMusicActivityFreshness({ observedAt: evidence.observed_at, cadence: "daily", now }),
      verificationStatus: evidence.verification_status ?? "unverified",
      sourceUrl: safeUrl(evidence.source_uri),
    });
  }

  return items.sort((a, b) => b.eventAt.localeCompare(a.eventAt));
}