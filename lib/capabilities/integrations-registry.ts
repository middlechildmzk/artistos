import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);

export const savePlatformProfileCapability = registerCapability({
  name: "integrations.save_platform_profile",
  version: 1,
  kind: "command",
  purpose: "Attach a canonical ArtistOS artist to an external platform profile with source-visible identity data.",
  input: z.object({
    artistId: uuid,
    platformId: uuid,
    externalArtistId: z.string().trim().max(300).nullable().optional(),
    profileUrl: z.string().url().nullable().optional(),
    sourceType: z.enum(["manual", "oauth", "api", "export", "distributor", "public"]).default("manual"),
    idempotencyKey,
  }),
  output: z.object({ profileId: uuid, saved: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.integrations.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.platform_profile_saved"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artist_not_found", "platform_not_found"],
});

const importedMetric = z.object({
  artistId: uuid.nullable().optional(),
  releaseId: uuid.nullable().optional(),
  platform: z.string().trim().min(1).max(80),
  metric: z.string().trim().min(1).max(120),
  value: z.number().finite(),
  capturedOn: z.string().date(),
  sourceUrl: z.string().url().nullable().optional(),
});

export const importMetricSnapshotsCapability = registerCapability({
  name: "integrations.import_metric_snapshots",
  version: 1,
  kind: "command",
  purpose: "Import source-visible artist and release metrics from a verified platform export.",
  input: z.object({
    rows: z.array(importedMetric).min(1).max(2000),
    sourceName: z.string().trim().min(1).max(160),
    idempotencyKey,
  }),
  output: z.object({ imported: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.metric_export_imported"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artist_not_found", "release_not_found", "invalid_metric_export"],
});

export const syncGoogleYouTubeCapability = registerCapability({
  name: "integrations.sync_google_youtube",
  version: 1,
  kind: "command",
  purpose: "Refresh the authenticated Google connection and ingest owned YouTube channel and analytics metrics.",
  input: z.object({ idempotencyKey }),
  output: z.object({
    channelId: z.string().min(1),
    channelTitle: z.string().min(1),
    metricCount: z.number().int().nonnegative(),
    syncedAt: z.string().datetime(),
  }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.integrations.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.google_youtube_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["google_connection_not_found", "legacy_token_reconnect_required", "youtube_api_not_enabled", "youtube_channel_not_found"],
});
