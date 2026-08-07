import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);

export const syncSoundchartsReleasePilotCapability = registerCapability({
  name: "integrations.sync_soundcharts_release_pilot",
  version: 1,
  kind: "command",
  purpose: "Resolve one exact-ISRC release in Soundcharts and ingest entitled playlist, radio, chart, metric, and source-health observations.",
  input: z.object({
    releaseId: uuid,
    idempotencyKey,
  }),
  output: z.object({
    releaseId: uuid,
    artistId: uuid,
    isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/),
    soundchartsUuid: z.string().min(1),
    metricCount: z.number().int().nonnegative(),
    playlistCount: z.number().int().nonnegative(),
    radioSpinCount: z.number().int().nonnegative(),
    chartCount: z.number().int().nonnegative(),
    endpointAvailableCount: z.number().int().nonnegative(),
    endpointUnavailableCount: z.number().int().nonnegative(),
    endpointFailedCount: z.number().int().nonnegative(),
    syncedAt: z.string().datetime(),
    evidenceId: uuid,
  }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "required",
  auditEvents: ["integrations.soundcharts_release_pilot_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: [
    "user_context_required",
    "release_not_found",
    "release_isrc_required",
    "release_isrc_invalid",
    "soundcharts_connection_not_found",
    "soundcharts_song_uuid_missing",
    "soundcharts_isrc_mismatch",
    "soundcharts_request_failed",
  ],
});
