import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const identityMigration = "supabase/migrations/20260730204030_external_artist_identities_and_provider_credentials.sql";

test("provider credential schema permits reviewed read-only providers", () => {
  const migration = read(identityMigration);
  for (const provider of ["google", "spotify", "soundcharts", "kit", "lastfm", "ticketmaster"]) {
    assert.match(migration, new RegExp(`'${provider}'::text`));
  }
  assert.match(migration, /drop constraint if exists oauth_connections_provider_check/);
  assert.match(migration, /add constraint oauth_connections_provider_check/);
});

test("external identities are workspace scoped and collision resistant", () => {
  const migration = read(identityMigration);
  assert.match(migration, /create table if not exists public\.artist_external_identities/);
  assert.match(migration, /unique \(workspace_id, artist_id, provider\)/);
  assert.match(migration, /unique \(workspace_id, provider, external_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /private\.can_manage_workspace\(workspace_id\)/);
});

test("free source writes use audited idempotent capabilities", () => {
  const registry = read("lib/capabilities/free-source-registry.ts");
  const handlers = read("lib/capabilities/free-source-handlers.ts");
  const runtime = read("lib/capabilities/server-runtime.ts");
  for (const capability of [
    "integrations.save_external_artist_identity",
    "integrations.connect_free_api_provider",
    "integrations.sync_lastfm",
    "integrations.sync_listenbrainz",
    "integrations.sync_ticketmaster",
  ]) assert.match(registry, new RegExp(capability.replaceAll(".", "\\.")));
  assert.match(registry, /idempotency: "key_required"/);
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /evidence_records/);
  assert.match(runtime, /free-source-registry/);
  assert.match(runtime, /free-source-handlers/);
  assert.doesNotMatch(handlers, /service_role/i);
});

test("provider keys are encrypted and never rendered back", () => {
  const handlers = read("lib/capabilities/free-source-handlers.ts");
  const page = read("app/connections/free-source-panels.tsx");
  assert.match(handlers, /encryptIntegrationToken\(input\.apiKey\)/);
  assert.match(handlers, /decryptIntegrationToken\(connection\.encrypted_access_token\)/);
  assert.match(page, /isCurrentTokenEnvelope\(lastFm\?\.encrypted_access_token\)/);
  assert.doesNotMatch(page, /value=\{[^}]*encrypted_access_token/);
  assert.doesNotMatch(page, />\{[^}]*encrypted_access_token/);
  assert.match(page, /type="password"/);
  assert.match(page, /ARTISTOS_TOKEN_ENCRYPTION_KEY/);
});

test("free source clients are bounded and identity first", () => {
  const clients = read("lib/integrations/free-provider-clients.ts");
  const handlers = read("lib/capabilities/free-source-handlers.ts");
  assert.match(clients, /MAX_RESPONSE_BYTES/);
  assert.match(clients, /AbortSignal\.timeout\(15_000\)/);
  assert.match(clients, /autocorrect: "0"/);
  assert.match(clients, /artist_mbids: \[musicBrainzId\]/);
  assert.match(clients, /attractionId/);
  assert.match(handlers, /artist_external_identities/);
  assert.match(handlers, /musicbrainz_identity_not_found/);
  assert.match(handlers, /ticketmaster_identity_not_found/);
  assert.doesNotMatch(handlers, /search.*Middle Child/i);
});

test("syncs store deterministic source-visible metrics and Proof", () => {
  const handlers = read("lib/capabilities/free-source-handlers.ts");
  for (const platform of ["lastfm", "listenbrainz", "ticketmaster"]) {
    assert.match(handlers, new RegExp(`platform: "${platform}"`));
  }
  assert.match(handlers, /replaceArtistMetrics/);
  assert.match(handlers, /\.delete\(\)[\s\S]{0,300}\.eq\("captured_on", args\.capturedOn\)/);
  assert.match(handlers, /verification_status: "verified"/);
  assert.match(handlers, /source_type: "api_response"/);
  assert.match(handlers, /lastfm_api/);
  assert.match(handlers, /listenbrainz_api/);
  assert.match(handlers, /ticketmaster_discovery_api/);
});

test("Sources exposes identity confirmation and all free sync controls", () => {
  const page = read("app/connections/page.tsx");
  const panels = read("app/connections/free-source-panels.tsx");
  const actions = read("app/connections/actions.ts");
  assert.match(page, /FreeSourcePanels/);
  assert.match(panels, /Confirmed external artist identities/);
  assert.match(panels, /Last\.fm/);
  assert.match(panels, /ListenBrainz/);
  assert.match(panels, /Ticketmaster Discovery/);
  assert.match(actions, /integrations\.save_external_artist_identity/);
  assert.match(actions, /integrations\.connect_free_api_provider/);
  assert.match(actions, /integrations\.sync_lastfm/);
  assert.match(actions, /integrations\.sync_listenbrainz/);
  assert.match(actions, /integrations\.sync_ticketmaster/);
});
