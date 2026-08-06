import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Connections remains in workspace settings without crowding primary navigation", () => {
  const header = read("components/app-header.tsx");
  const sources = read("app/connections/page.tsx");
  const analytics = read("app/analytics/page.tsx");
  assert.match(header, /label: "Connections", href: "\/connections"/);
  assert.doesNotMatch(header, /key: "connections"/);
  assert.match(sources, /Google \+ YouTube/);
  assert.match(sources, /Import artist-dashboard exports/);
  assert.match(sources, /Soundcharts/);
  assert.match(sources, /Kit/);
  assert.match(analytics, /Connected data/);
  assert.match(analytics, /Owned audience and link conversion/);
  assert.match(analytics, /Campaign and placement impact/);
});

test("Google OAuth uses a stable origin, state, offline access, read-only scopes, and server-only credentials", () => {
  const google = read("lib/integrations/google.ts");
  const sources = read("app/connections/page.tsx");
  const connect = read("app/api/integrations/google/connect/route.ts");
  const callback = read("app/api/integrations/google/callback/route.ts");
  const persistence = read("lib/capabilities/google-connection-handler.ts");
  assert.match(google, /ARTISTOS_PUBLIC_ORIGIN/);
  assert.match(google, /googleOAuthRedirectUri/);
  assert.match(google, /invalid_artistos_public_origin/);
  assert.match(sources, /googleConnectHref/);
  assert.match(sources, /Stable OAuth origin/);
  assert.match(google, /access_type: "offline"/);
  assert.match(google, /youtube\.readonly/);
  assert.match(google, /yt-analytics\.readonly/);
  assert.match(connect, /artistos_google_oauth_state/);
  assert.match(connect, /httpOnly: true/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /invokeCapability/);
  assert.match(callback, /integrations\.connect_google_account/);
  assert.doesNotMatch(callback, /\.from\([^)]*\)[\s\S]{0,160}\.(?:upsert|insert|update|delete)\(/);
  assert.match(persistence, /encryptIntegrationToken/);
  for (const file of [google, connect, callback, persistence]) {
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
  const providerRegistry = read("lib/capabilities/provider-integrations-registry.ts");
  const handlers = read("lib/capabilities/integrations-handlers.ts");
  const providerHandlers = read("lib/capabilities/provider-integrations-handlers.ts");
  const connectionHandler = read("lib/capabilities/google-connection-handler.ts");
  const actions = read("app/connections/actions.ts");
  for (const capability of [
    "integrations.connect_google_account",
    "integrations.save_platform_profile",
    "integrations.import_metric_snapshots",
    "integrations.sync_google_youtube",
  ]) {
    assert.match(registry, new RegExp(capability.replaceAll(".", "\\.")));
  }
  for (const capability of [
    "integrations.connect_api_provider",
    "integrations.sync_kit",
    "integrations.sync_soundcharts",
  ]) {
    assert.match(providerRegistry, new RegExp(capability.replaceAll(".", "\\.")));
  }
  assert.match(registry, /idempotency: "key_required"/);
  assert.match(providerRegistry, /idempotency: "key_required"/);
  assert.match(actions, /invokeCapability/);
  assert.match(handlers, /capability_idempotency/);
  assert.match(providerHandlers, /capability_idempotency/);
  assert.match(connectionHandler, /capability_idempotency/);
  assert.match(handlers, /eq\("workspace_id", ctx\.workspaceId\)/);
  assert.match(providerHandlers, /workspace_id: ctx\.workspaceId/);
  assert.match(connectionHandler, /workspace_id: ctx\.workspaceId/);
  assert.doesNotMatch(actions, /service_role/i);
  assert.doesNotMatch(handlers, /service_role/i);
  assert.doesNotMatch(providerHandlers, /service_role/i);
  assert.doesNotMatch(connectionHandler, /service_role/i);
});

test("Soundcharts credentials are exchanged server-side and sync uses canonical Spotify identity", () => {
  const clients = read("lib/integrations/provider-clients.ts");
  const handlers = read("lib/capabilities/provider-integrations-handlers.ts");
  const page = read("app/connections/page.tsx");
  assert.match(clients, /account\.soundcharts\.com\/oauth\/token/);
  assert.match(clients, /customer\.api\.soundcharts\.com/);
  assert.match(clients, /by-platform\/spotify/);
  assert.match(handlers, /spotify_profile_not_found/);
  assert.match(handlers, /soundcharts_artist_sync/);
  assert.match(handlers, /spotify_playlist_entries/);
  assert.match(page, /Validate and save Soundcharts/);
  assert.match(page, /Sync Soundcharts now/);
  assert.doesNotMatch(page, /clientSecret\s*[:=]/);
});

test("Kit sync stores aggregate email metrics without raw subscriber records", () => {
  const clients = read("lib/integrations/provider-clients.ts");
  const handlers = read("lib/capabilities/provider-integrations-handlers.ts");
  const page = read("app/connections/page.tsx");
  assert.match(clients, /https:\/\/api\.kit\.com/);
  assert.match(clients, /\/v4\/subscribers/);
  assert.match(clients, /\/v4\/broadcasts\/stats/);
  assert.match(handlers, /raw_subscriber_records_stored: false/);
  for (const metric of ["subscribers_active", "broadcast_recipients", "emails_opened", "email_clicks", "email_open_rate"]) {
    assert.match(handlers, new RegExp(`"${metric}"`));
  }
  assert.match(page, /Validate and save Kit/);
  assert.match(page, /Sync Kit now/);
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

test("source catalog is explicit about free, export, licensed, and constrained coverage", () => {
  const catalog = read("lib/integrations/source-catalog.ts");
  assert.match(catalog, /Spotify removed artist follower and popularity fields/);
  assert.match(catalog, /Streams and monthly listeners are not available from the public API/);
  assert.match(catalog, /DistroKid does not provide a general public analytics API/);
  assert.match(catalog, /1,000 initial production requests/);
  assert.match(catalog, /ListenBrainz/);
  assert.match(catalog, /MusicBrainz/);
  assert.match(catalog, /Ticketmaster Discovery/);
  assert.match(catalog, /EUR 300 per month/);
  assert.match(catalog, /paid_key_required/);
});
