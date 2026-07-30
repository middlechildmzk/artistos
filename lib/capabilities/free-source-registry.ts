import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16);
const identityProvider = z.enum(["musicbrainz", "listenbrainz", "lastfm", "ticketmaster"]);

export const saveExternalArtistIdentityCapability = registerCapability({
  name: "integrations.save_external_artist_identity",
  version: 1,
  kind: "command",
  purpose: "Attach a canonical ArtistOS artist to an explicitly confirmed external provider identity.",
  input: z.object({
    artistId: uuid,
    provider: identityProvider,
    externalId: z.string().trim().min(1).max(500),
    displayName: z.string().trim().max(300).nullable().optional(),
    profileUrl: z.string().url().nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ identityId: uuid, provider: identityProvider, saved: z.literal(true) }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.integrations.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.external_artist_identity_saved"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["artist_not_found", "external_identity_conflict", "invalid_provider_identity"],
});

export const connectFreeApiProviderCapability = registerCapability({
  name: "integrations.connect_free_api_provider",
  version: 1,
  kind: "command",
  purpose: "Validate and store an encrypted read-only API key for a free public-data provider.",
  input: z.object({
    provider: z.enum(["lastfm", "ticketmaster"]),
    apiKey: z.string().trim().min(8).max(20_000),
    accountLabel: z.string().trim().max(300).nullable().optional(),
    idempotencyKey,
  }),
  output: z.object({ provider: z.enum(["lastfm", "ticketmaster"]), connectionId: uuid, connected: z.literal(true) }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.integrations.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.free_api_provider_connected"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["provider_credentials_invalid", "user_context_required"],
});

export const syncLastFmCapability = registerCapability({
  name: "integrations.sync_lastfm",
  version: 1,
  kind: "command",
  purpose: "Ingest public Last.fm artist listeners, playcounts, top tracks, and similar-artist signals for a confirmed identity.",
  input: z.object({ artistId: uuid, idempotencyKey }),
  output: z.object({ artistId: uuid, metricCount: z.number().int().nonnegative(), syncedAt: z.string().datetime() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.lastfm_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["lastfm_connection_not_found", "lastfm_identity_not_found", "lastfm_request_failed"],
});

export const syncListenBrainzCapability = registerCapability({
  name: "integrations.sync_listenbrainz",
  version: 1,
  kind: "command",
  purpose: "Ingest open ListenBrainz popularity and top-recording signals for a confirmed MusicBrainz artist ID.",
  input: z.object({ artistId: uuid, idempotencyKey }),
  output: z.object({ artistId: uuid, metricCount: z.number().int().nonnegative(), syncedAt: z.string().datetime() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.listenbrainz_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["musicbrainz_identity_not_found", "listenbrainz_request_failed"],
});

export const syncTicketmasterCapability = registerCapability({
  name: "integrations.sync_ticketmaster",
  version: 1,
  kind: "command",
  purpose: "Ingest upcoming Ticketmaster events, venue, market, and date signals for a confirmed attraction ID.",
  input: z.object({ artistId: uuid, idempotencyKey }),
  output: z.object({ artistId: uuid, metricCount: z.number().int().nonnegative(), eventCount: z.number().int().nonnegative(), syncedAt: z.string().datetime() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.analytics.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["integrations.ticketmaster_synced"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["ticketmaster_connection_not_found", "ticketmaster_identity_not_found", "ticketmaster_request_failed"],
});
