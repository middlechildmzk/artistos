import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);

export const connectApiProviderCapability = registerCapability({
  name: "integrations.connect_api_provider",
  version: 1,
  kind: "command",
  purpose: "Validate and store encrypted credentials for an approved read-only music data provider.",
  input: z.object({
    provider: z.enum(["soundcharts", "kit"]),
    primarySecret: z.string().trim().min(8).max(20_000),
    secondarySecret: z.string().trim().min(8).max(20_000).nullable().optional(),
    teamId: z.string().trim().max(300).nullable().optional(),
    accountLabel: z.string().trim().max(300).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ provider: z.enum(["soundcharts", "kit"]), connectionId: uuid, connected: z.literal(true) }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.integrations.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.api_provider_connected"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["user_context_required", "provider_credentials_invalid", "secondary_secret_required"],
});

export const syncKitCapability = registerCapability({
  name: "integrations.sync_kit",
  version: 1,
  kind: "command",
  purpose: "Ingest aggregate Kit subscriber and broadcast performance without storing raw subscriber records.",
  input: z.object({ idempotencyKey }),
  output: z.object({ metricCount: z.number().int().nonnegative(), syncedAt: z.string().datetime() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.kit_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["kit_connection_not_found", "legacy_token_reconnect_required", "kit_request_failed"],
});

export const syncSoundchartsCapability = registerCapability({
  name: "integrations.sync_soundcharts",
  version: 1,
  kind: "command",
  purpose: "Resolve a canonical ArtistOS artist in Soundcharts and ingest entitled audience and playlist observations.",
  input: z.object({ artistId: uuid, idempotencyKey }),
  output: z.object({ artistId: uuid, soundchartsUuid: z.string().min(1), metricCount: z.number().int().nonnegative(), playlistEntries: z.number().int().nonnegative(), syncedAt: z.string().datetime() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.soundcharts_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["soundcharts_connection_not_found", "spotify_profile_not_found", "soundcharts_artist_not_found", "soundcharts_request_failed"],
});
