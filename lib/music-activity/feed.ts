import { createHash } from "node:crypto";
import {
  deriveMusicActivityFreshness,
  type MusicActivityFreshness,
  type MusicActivitySourceClass,
} from "./contract";

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
  confidence: string;
  sourceUrl: string | null;
  value: number | null;
};

type ReleaseRow = {
  id: string;
  artist_id?: string | null;
  title: string;
  featured_artist?: string | null;
  isrc?: string | null;
  spotify_url?: string | null;
};

type SmartLinkRow = {
  id: string;
  release_id: string;
  slug: string;
};

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
  artist_id?: string | null;
  release_id?: string | null;
  platform: string;
  metric: string;
  value: number | string;
  captured_on: string;
  source_url?: string | null;
};

type PlacementRow = {
  id: string;
  release_id?: string | null;
  playlist_name: string;
  playlist_url?: string | null;
  external_playlist_id?: string | null;
  followers?: number | string | null;
  track_position?: number | null;
  added_at?: string | null;
  removed_at?: string | null;
  last_activity_at?: string | null;
  source_type?: string | null;
  confidence?: number | string | null;
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
  confidence_score?: number | string | null;
  observed_at: string;
  summary: string;
  source_uri?: string | null;
  metadata?: unknown;
};

export type BuildMusicActivityFeedArgs = {
  releases: ReleaseRow[];
  smartLinks: SmartLinkRow[];
  linkEvents: LinkEventRow[];
  metrics: MetricRow[];
  placements: PlacementRow[];
  evidence: EvidenceRow[];
  now?: Date;
};

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourceClassForMetric(platform: string): MusicActivitySourceClass {
  const normalized = platform.toLowerCase();
  if (["soundcharts", "chartmetric", "viberate", "spotontrack", "acrcloud", "bmat", "radiomonitor"].includes(normalized)) return "licensed";
  if (["youtube", "youtube-analytics", "kit", "instagram", "meta", "tiktok", "soundcloud"].includes(normalized)) return "authorized";
  if (["listenbrainz", "musicbrainz", "lastfm", "audius"].includes(normalized)) return "public";
  return "imported";
}

function sourceClassForEvidence(row: EvidenceRow): MusicActivitySourceClass {
  const type = `${row.evidence_type} ${row.verification_method ?? ""}`.toLowerCase();
  if (/soundcharts|chartmetric|viberate|spotontrack|acrcloud|bmat|radiomonitor/.test(type)) return "licensed";
  if (/youtube|google|kit|instagram|meta|tiktok|soundcloud/.test(type)) return "authorized";
  if (/listenbrainz|musicbrainz|lastfm|audius/.test(type)) return "public";
  if (/import|csv|export/.test(type)) return "imported";
  if (/fingerprint|audio match/.test(type)) return "fingerprint";
  return row.source_type === "manual" ? "manual" : "manual";
}

function cadenceForSource(sourceClass: MusicActivitySourceClass, kind: MusicActivityFeedKind) {
  if (["link_view", "link_click", "fan_capture"].includes(kind)) return "webhook" as const;
  if (sourceClass === "licensed" || sourceClass === "authorized") return "daily" as const;
  if (sourceClass === "public") return "daily" as const;
  return "manual" as const;
}

function toObservedAt(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function activityKey(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function identityForRelease(release: ReleaseRow | null) {
  if (release?.isrc?.trim()) return { isrc: release.isrc.trim().toUpperCase(), state: "strong_recording_identity" as const };
  if (release) return { isrc: null, state: "release_link_only" as const };
  return { isrc: null, state: "workspace_signal" as const };
}

function confidenceLabel(value: number | string | null | undefined, fallback: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0.95) return "verified";
    if (numeric >= 0.75) return "supported";
    if (numeric > 0) return "review required";
  }
  return fallback;
}

export function buildMusicActivityFeed(args: BuildMusicActivityFeedArgs): MusicActivityFeedItem[] {
  const now = args.now ?? new Date();
  const releasesById = new Map(args.releases.map((release) => [release.id, release]));
  const releaseBySmartLinkId = new Map(
    args.smartLinks.map((link) => [link.id, releasesById.get(link.release_id) ?? null]),
  );
  const items: MusicActivityFeedItem[] = [];

  for (const event of args.linkEvents) {
    const release = releaseBySmartLinkId.get(event.smart_link_id) ?? null;
    const identity = identityForRelease(release);
    const kind: MusicActivityFeedKind | null = event.event_type === "page_view"
      ? "link_view"
      : event.event_type === "destination_click"
        ? "link_click"
        : event.event_type === "fan_signup"
          ? "fan_capture"
          : null;
    if (!kind) continue;
    const sourceDetail = event.utm_campaign?.trim() || event.utm_source?.trim() || event.referrer?.trim() || null;
    const destination = event.destination_service?.trim() || null;
    const territory = event.country_code?.trim() || null;
    const detailParts = [
      release?.title ?? "ArtistOS release link",
      destination ? `destination: ${destination}` : null,
      territory ? `territory: ${territory}` : null,
      sourceDetail ? `attribution: ${sourceDetail}` : null,
    ].filter(Boolean);
    const title = kind === "link_view"
      ? "Release link viewed"
      : kind === "link_click"
        ? `${destination ? humanize(destination) : "Release"} destination clicked`
        : "Fan signup captured";
    const observedAt = toObservedAt(event.occurred_at);
    items.push({
      key: activityKey(["link_event", event.id]),
      kind,
      source: "ArtistOS Links",
      sourceClass: "owned",
      title,
      detail: detailParts.join(" · "),
      releaseId: release?.id ?? null,
      releaseTitle: release?.title ?? null,
      isrc: identity.isrc,
      identityState: identity.state,
      eventAt: observedAt,
      observedAt,
      freshness: deriveMusicActivityFreshness({ observedAt, cadence: "webhook", now }),
      verificationStatus: "recorded",
      confidence: "verified",
      sourceUrl: null,
      value: null,
    });
  }

  for (const placement of args.placements) {
    const release = placement.release_id ? releasesById.get(placement.release_id) ?? null : null;
    const identity = identityForRelease(release);
    const removed = Boolean(placement.removed_at);
    const eventAt = toObservedAt(placement.removed_at ?? placement.added_at ?? placement.last_activity_at ?? placement.last_verified_at ?? new Date(0).toISOString());
    const sourceClass: MusicActivitySourceClass = placement.source_type === "provider_api" || placement.source_type === "licensed"
      ? "licensed"
      : placement.source_type === "public"
        ? "public"
        : placement.source_type === "imported"
          ? "imported"
          : "manual";
    const detailParts = [
      release?.title ?? "Unlinked release",
      placement.track_position ? `position ${placement.track_position}` : null,
      placement.followers ? `${Number(placement.followers).toLocaleString("en-US")} followers` : null,
      placement.verification_state ? `verification: ${humanize(placement.verification_state)}` : null,
    ].filter(Boolean);
    items.push({
      key: activityKey(["playlist_placement", placement.id, removed ? "removed" : "added", eventAt]),
      kind: removed ? "playlist_removed" : "playlist_added",
      source: placement.source_type ? humanize(placement.source_type) : "Playlist evidence",
      sourceClass,
      title: `${removed ? "Removed from" : "Added to"} ${placement.playlist_name}`,
      detail: detailParts.join(" · "),
      releaseId: release?.id ?? null,
      releaseTitle: release?.title ?? null,
      isrc: identity.isrc,
      identityState: identity.state,
      eventAt,
      observedAt: toObservedAt(placement.last_verified_at ?? placement.last_activity_at ?? eventAt),
      freshness: deriveMusicActivityFreshness({
        observedAt: toObservedAt(placement.last_verified_at ?? placement.last_activity_at ?? eventAt),
        cadence: cadenceForSource(sourceClass, removed ? "playlist_removed" : "playlist_added"),
        now,
      }),
      verificationStatus: placement.verification_state ?? "unverified",
      confidence: confidenceLabel(placement.confidence, placement.verification_state ?? "review required"),
      sourceUrl: safeUrl(placement.playlist_url),
      value: placement.track_position ?? null,
    });
  }

  const latestMetricBySeries = new Map<string, MetricRow>();
  for (const metric of args.metrics) {
    const seriesKey = `${metric.artist_id ?? "workspace"}:${metric.release_id ?? "all"}:${metric.platform}:${metric.metric}`;
    if (!latestMetricBySeries.has(seriesKey)) latestMetricBySeries.set(seriesKey, metric);
  }
  for (const metric of latestMetricBySeries.values()) {
    const release = metric.release_id ? releasesById.get(metric.release_id) ?? null : null;
    const identity = identityForRelease(release);
    const sourceClass = sourceClassForMetric(metric.platform);
    const observedAt = toObservedAt(metric.captured_on);
    const numericValue = Number(metric.value);
    items.push({
      key: activityKey(["metric", metric.id]),
      kind: "metric_snapshot",
      source: humanize(metric.platform),
      sourceClass,
      title: `${humanize(metric.metric)} updated`,
      detail: `${release?.title ?? "Artist or workspace signal"} · ${Number.isFinite(numericValue) ? numericValue.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(metric.value)}`,
      releaseId: release?.id ?? null,
      releaseTitle: release?.title ?? null,
      isrc: identity.isrc,
      identityState: identity.state,
      eventAt: observedAt,
      observedAt,
      freshness: deriveMusicActivityFreshness({ observedAt, cadence: cadenceForSource(sourceClass, "metric_snapshot"), now }),
      verificationStatus: sourceClass === "licensed" || sourceClass === "authorized" || sourceClass === "public" ? "source observed" : "imported",
      confidence: sourceClass === "imported" ? "supported" : "verified",
      sourceUrl: safeUrl(metric.source_url),
      value: Number.isFinite(numericValue) ? numericValue : null,
    });
  }

  for (const receipt of args.evidence) {
    const release = receipt.release_id ? releasesById.get(receipt.release_id) ?? null : null;
    const identity = identityForRelease(release);
    const sourceClass = sourceClassForEvidence(receipt);
    const observedAt = toObservedAt(receipt.observed_at);
    items.push({
      key: activityKey(["evidence", receipt.id]),
      kind: "source_receipt",
      source: receipt.verification_method ? humanize(receipt.verification_method) : humanize(receipt.source_type ?? "ArtistOS Proof"),
      sourceClass,
      title: humanize(receipt.evidence_type),
      detail: receipt.summary,
      releaseId: release?.id ?? null,
      releaseTitle: release?.title ?? null,
      isrc: identity.isrc,
      identityState: identity.state,
      eventAt: observedAt,
      observedAt,
      freshness: deriveMusicActivityFreshness({ observedAt, cadence: cadenceForSource(sourceClass, "source_receipt"), now }),
      verificationStatus: receipt.verification_status ?? "pending",
      confidence: receipt.confidence ?? confidenceLabel(receipt.confidence_score, "supported"),
      sourceUrl: safeUrl(receipt.source_uri),
      value: null,
    });
  }

  const deduplicated = new Map<string, MusicActivityFeedItem>();
  for (const item of items) if (!deduplicated.has(item.key)) deduplicated.set(item.key, item);
  return [...deduplicated.values()].sort((left, right) => right.eventAt.localeCompare(left.eventAt));
}
