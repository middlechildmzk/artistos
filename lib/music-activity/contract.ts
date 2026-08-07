import { createHash } from "node:crypto";
import { z } from "zod";

export const musicActivityKindSchema = z.enum([
  "metric_snapshot",
  "playlist_added",
  "playlist_removed",
  "playlist_position_changed",
  "radio_spin",
  "chart_entry",
  "chart_exit",
  "video_post",
  "social_sound_use",
  "media_mention",
  "link_view",
  "link_click",
  "fan_capture",
]);

export const musicActivitySourceClassSchema = z.enum([
  "owned",
  "authorized",
  "public",
  "licensed",
  "imported",
  "fingerprint",
  "manual",
  "inferred",
]);

export const musicActivityMatchMethodSchema = z.enum([
  "isrc",
  "platform_id",
  "provider_id",
  "canonical_url",
  "fingerprint",
  "manual",
  "metadata_inference",
]);

export const musicActivityConfidenceSchema = z.enum([
  "verified",
  "supported",
  "probable",
  "review_required",
  "rejected",
]);

export const musicActivityCadenceSchema = z.enum([
  "webhook",
  "near_real_time",
  "hourly",
  "daily",
  "manual",
]);

const strongRecordingIdentitySchema = z.object({
  isrc: z.string().trim().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/i).transform((value) => value.toUpperCase()).optional(),
  platformTrackId: z.string().trim().min(1).max(500).optional(),
  providerRecordingId: z.string().trim().min(1).max(500).optional(),
  artistName: z.string().trim().min(1).max(300).optional(),
  trackTitle: z.string().trim().min(1).max(500).optional(),
}).superRefine((identity, context) => {
  if (!identity.isrc && !identity.platformTrackId && !identity.providerRecordingId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A music activity observation requires an ISRC, platform track ID, or provider recording ID. Artist and title alone are not sufficient.",
      path: ["isrc"],
    });
  }
});

export const musicActivityObservationSchema = z.object({
  workspaceId: z.string().uuid(),
  artistId: z.string().uuid().nullable().optional(),
  releaseId: z.string().uuid().nullable().optional(),
  recording: strongRecordingIdentitySchema,
  kind: musicActivityKindSchema,
  source: z.object({
    provider: z.string().trim().min(1).max(120),
    sourceClass: musicActivitySourceClassSchema,
    sourceUrl: z.string().url().nullable().optional(),
    providerRecordId: z.string().trim().min(1).max(500).nullable().optional(),
    acquisitionMethod: z.string().trim().min(1).max(200),
    cadence: musicActivityCadenceSchema,
  }),
  match: z.object({
    method: musicActivityMatchMethodSchema,
    confidence: musicActivityConfidenceSchema,
    confidenceScore: z.number().min(0).max(1),
    reviewedByUserId: z.string().uuid().nullable().optional(),
  }),
  occurredAt: z.string().datetime().nullable().optional(),
  observedAt: z.string().datetime(),
  territory: z.string().trim().min(2).max(12).nullable().optional(),
  subject: z.object({
    name: z.string().trim().min(1).max(500).nullable().optional(),
    type: z.string().trim().min(1).max(120).nullable().optional(),
    externalId: z.string().trim().min(1).max(500).nullable().optional(),
    url: z.string().url().nullable().optional(),
  }).default({}),
  metrics: z.record(z.string().trim().min(1).max(120), z.number().finite()).default({}),
  evidenceId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type MusicActivityObservation = z.infer<typeof musicActivityObservationSchema>;
export type MusicActivityKind = z.infer<typeof musicActivityKindSchema>;
export type MusicActivitySourceClass = z.infer<typeof musicActivitySourceClassSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function parseMusicActivityObservation(value: unknown): MusicActivityObservation {
  return musicActivityObservationSchema.parse(value);
}

export function musicActivityObservationKey(value: unknown): string {
  const observation = parseMusicActivityObservation(value);
  const identity = {
    workspaceId: observation.workspaceId,
    recording: observation.recording,
    kind: observation.kind,
    provider: observation.source.provider,
    providerRecordId: observation.source.providerRecordId ?? null,
    subjectExternalId: observation.subject.externalId ?? null,
    occurredAt: observation.occurredAt ?? null,
    observedAt: observation.observedAt,
    territory: observation.territory ?? null,
    metrics: observation.metrics,
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(identity))).digest("hex");
}

export type MusicActivityFreshness = "current" | "stale" | "expired";

export function deriveMusicActivityFreshness(args: {
  observedAt: string;
  cadence: z.infer<typeof musicActivityCadenceSchema>;
  now?: Date;
}): MusicActivityFreshness {
  const observed = new Date(args.observedAt);
  if (Number.isNaN(observed.getTime())) throw new Error("invalid_observed_at");
  const ageMs = (args.now ?? new Date()).getTime() - observed.getTime();
  const hour = 60 * 60 * 1000;
  const thresholds: Record<typeof args.cadence, [number, number]> = {
    webhook: [2 * hour, 24 * hour],
    near_real_time: [6 * hour, 48 * hour],
    hourly: [12 * hour, 72 * hour],
    daily: [48 * hour, 14 * 24 * hour],
    manual: [30 * 24 * hour, 180 * 24 * hour],
  };
  const [staleAfter, expiredAfter] = thresholds[args.cadence];
  if (ageMs > expiredAfter) return "expired";
  if (ageMs > staleAfter) return "stale";
  return "current";
}
