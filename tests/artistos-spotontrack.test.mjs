import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Spotontrack is an isolated audited provider capability", () => {
  const registry = read("lib/capabilities/provider-integrations-registry.ts");
  const runtime = read("lib/capabilities/server-runtime.ts");
  const handlers = read("lib/capabilities/spotontrack-handlers.ts");
  assert.match(registry, /integrations\.connect_spotontrack/);
  assert.match(registry, /integrations\.sync_spotontrack/);
  assert.match(registry, /idempotency: "key_required"/);
  assert.match(runtime, /spotontrack-handlers/);
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /workspace_id: ctx\.workspaceId/);
  assert.doesNotMatch(handlers, /service_role/i);
});

test("Spotontrack uses bearer auth and exact release ISRC matching", () => {
  const clients = read("lib/integrations/provider-clients.ts");
  const handlers = read("lib/capabilities/spotontrack-handlers.ts");
  assert.match(clients, /www\.spotontrack\.com\/api\/v1/);
  assert.match(clients, /authorization: `Bearer \${apiKey}`/);
  assert.match(handlers, /release_isrc_required/);
  assert.match(handlers, /encodeURIComponent\(isrc\)/);
  assert.match(handlers, /spotify\/streams/);
  assert.match(handlers, /shazam\/shazams/);
  assert.match(handlers, /spotify\/playlists\/removed/);
});

test("Spotontrack sync stores source-visible metrics and Proof", () => {
  const handlers = read("lib/capabilities/spotontrack-handlers.ts");
  const page = read("app/connections/spotontrack/page.tsx");
  for (const metric of ["spotify_total_streams", "shazam_total", "current_playlist_reach", "spotify_removed_playlist_entries", "best_current_chart_position"]) assert.match(handlers, new RegExp(metric));
  assert.match(handlers, /spotontrack_release_sync/);
  assert.match(handlers, /verification_method: "spotontrack_api"/);
  assert.match(page, /Validate and save API key/);
  assert.match(page, /Sync release now/);
  assert.match(page, /exact ISRC/i);
});

test("Spotontrack provider is admitted through a tracked migration", () => {
  const migration = read("supabase/migrations/20260802111802_allow_spotontrack_provider.sql");
  assert.match(migration, /oauth_connections_provider_check/);
  assert.match(migration, /'spotontrack'::text/);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
});

test("Spotontrack successful sync redirects outside the error boundary", () => {
  const actions = read("app/connections/spotontrack/actions.ts");
  assert.match(actions, /let metricCount = 0;/);
  assert.match(actions, /redirect\(`\/connections\/spotontrack\?synced=1&metrics=\$\{metricCount\}`\);/);
  assert.doesNotMatch(actions, /const output[\s\S]+redirect\(`\/connections\/spotontrack\?synced=1[\s\S]+catch/);
});
