import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Sources is a primary ArtistOS surface", () => {
  const dashboard = read("app/dashboard/page.tsx");
  const sources = read("app/connections/page.tsx");
  const analytics = read("app/analytics/page.tsx");
  assert.match(dashboard, /href="\/connections"/);
  assert.match(sources, /Google \+ YouTube/);
  assert.match(sources, /Import artist-dashboard exports/);
  assert.match(analytics, /Source health/);
  assert.match(analytics, /Owned audience and link conversion/);
  assert.match(analytics, /Campaign and placement impact/);
});

test("Google OAuth uses state, offline access, read-only scopes, and server-only credentials", () => {
  const google = read("lib/integrations/google.ts");
  const connect = read("app/api/integrations/google/connect/route.ts");
  const callback = read("app/api/integrations/google/callback/route.ts");
  assert.match(google, /access_type: "offline"/);
  assert.match(google, /youtube\.readonly/);
  assert.match(google, /yt-analytics\.readonly/);
  assert.match(connect, /artistos_google_oauth_state/);
  assert.match(connect, /httpOnly: true/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /encryptIntegrationToken/);
  for (const file of [google, connect, callback]) {
    assert.doesNotMatch(file, /NEXT_PUBLIC_GOOGLE|NEXT_PUBLIC_.*SECRET|NEXT_PUBLIC_.*ENCRYPTION/i);
  }
});

test("integration tokens use an authenticated encryption envelope", () => {
  const crypto = read("lib/integrations/token-crypto.ts");
  assert.match(crypto, /aes-256-gcm/);
  assert.match(crypto, /getAuthTag/);
  assert.match(crypto, /setAuthTag/);
  assert.match(crypto, /ARTISTOS_TOKEN_ENCRYPTION_KEY/);
  assert.match(crypto, /legacy_token_reconnect_required/);
});

test("source writes run through audited idempotent capabilities", () => {
  const registry = read("lib/capabilities/integrations-registry.ts");
  const handlers = read("lib/capabilities/integrations-handlers.ts");
  const actions = read("app/connections/actions.ts");
  for (const capability of [
    "integrations.save_platform_profile",
    "integrations.import_metric_snapshots",
    "integrations.sync_google_youtube",
  ]) {
    assert.match(registry, new RegExp(capability.replaceAll(".", "\\.")));
  }
  assert.match(registry, /idempotency: "key_required"/);
  assert.match(actions, /invokeCapability/);
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /eq\("workspace_id", ctx\.workspaceId\)/);
  assert.doesNotMatch(actions, /service_role/i);
  assert.doesNotMatch(handlers, /service_role/i);
});

test("metric exports are bounded, idempotent, and create Proof receipts", () => {
  const csv = read("lib/integrations/csv.ts");
  const actions = read("app/connections/actions.ts");
  const handlers = read("lib/capabilities/integrations-handlers.ts");
  assert.match(csv, /2_000/);
  assert.match(actions, /5_000_000/);
  assert.match(actions, /createHash\("sha256"\)/);
  assert.match(actions, /metric-import:/);
  assert.match(handlers, /evidence_type: "metric_export_import"/);
  assert.match(handlers, /source_type: "uploaded_file"/);
  assert.match(handlers, /verification_method: "source_export"/);
});

test("YouTube sync writes source-visible channel and analytics metrics", () => {
  const google = read("lib/integrations/google.ts");
  const handlers = read("lib/capabilities/integrations-handlers.ts");
  for (const metric of [
    "subscribers",
    "channel_views",
    "videos",
    "views_28d",
    "watch_minutes_28d",
    "average_view_duration_seconds_28d",
    "subscribers_gained_28d",
    "subscribers_lost_28d",
  ]) {
    assert.match(handlers, new RegExp(`"${metric}"`));
  }
  assert.match(google, /youtubeanalytics\.googleapis\.com\/v2\/reports/);
  assert.match(handlers, /music_metric_snapshots/);
  assert.match(handlers, /source_type: "youtube_api"/);
  assert.match(handlers, /source_url: channelUrl/);
});

test("source catalog does not pretend Spotify public API provides private artist analytics", () => {
  const catalog = read("lib/integrations/source-catalog.ts");
  assert.match(catalog, /Spotify removed artist follower and popularity fields/);
  assert.match(catalog, /Streams and monthly listeners are not available from the public API/);
  assert.match(catalog, /DistroKid does not provide a general public analytics API/);
  assert.match(catalog, /paid_key_required/);
});
