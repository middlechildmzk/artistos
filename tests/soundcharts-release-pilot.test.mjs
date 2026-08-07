import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("release pilot resolves only by a strong ISRC identity", () => {
  const adapter = read("lib/integrations/soundcharts-release-pilot.ts");
  assert.match(adapter, /\/api\/v2\.25\/song\/by-isrc\//);
  assert.match(adapter, /\^\[A-Z\]\{2\}\[A-Z0-9\]\{3\}\[0-9\]\{7\}\$/);
  assert.match(adapter, /soundcharts_isrc_mismatch/);
  assert.doesNotMatch(adapter, /song\/search/);
  assert.doesNotMatch(adapter, /artistName.*trackTitle/);
});

test("release pilot probes source families independently", () => {
  const adapter = read("lib/integrations/soundcharts-release-pilot.ts");
  assert.match(adapter, /playlist\/current\/spotify/);
  assert.match(adapter, /playlist\/reach\/spotify/);
  assert.match(adapter, /\/broadcasts/);
  assert.match(adapter, /broadcast-groups/);
  assert.match(adapter, /charts\/ranks/);
  assert.match(adapter, /current\/stats/);
  assert.match(adapter, /team\/usage/);
  assert.match(adapter, /Promise\.allSettled/);
  assert.match(adapter, /status === 403 \|\| status === 404 \? "unavailable" : "failed"/);
});

test("playlist reach uses Soundcharts analytics fields and excludes pagination", () => {
  const adapter = read("lib/integrations/soundcharts-release-pilot.ts");
  assert.match(adapter, /playlistReachMetrics/);
  assert.match(adapter, /playlistCount/);
  assert.match(adapter, /playlistReach/);
  assert.match(adapter, /playlistEditorialCount/);
  assert.match(adapter, /playlistEditorialReach/);
  assert.match(adapter, /playlistUserCount/);
  assert.match(adapter, /playlistUserReach/);
  assert.match(adapter, /spotify_playlist_count/);
  assert.match(adapter, /spotify_playlist_reach/);
  assert.match(adapter, /\["page", "pagination", "offset", "limit", "next", "previous", "total"\]/);
  assert.doesNotMatch(adapter, /spotify_playlist_reach_page_/);
});

test("release pilot stores normalized evidence instead of raw provider bodies", () => {
  const adapter = read("lib/integrations/soundcharts-release-pilot.ts");
  const handler = read("lib/capabilities/soundcharts-release-pilot-handlers.ts");
  assert.match(adapter, /rawPayloadStored: false/);
  assert.match(handler, /raw_payload_stored: false/);
  assert.match(handler, /rights_boundary: "provider_contract_required_for_multi_tenant_customer_display"/);
  assert.doesNotMatch(handler, /raw_payload:/);
  assert.doesNotMatch(handler, /\.delete\(\)/);
});

test("release writes stay release-scoped, idempotent, and evidence-backed", () => {
  const registry = read("lib/capabilities/soundcharts-release-pilot-registry.ts");
  const handler = read("lib/capabilities/soundcharts-release-pilot-handlers.ts");
  assert.match(registry, /integrations\.sync_soundcharts_release_pilot/);
  assert.match(registry, /evidence: "required"/);
  assert.match(registry, /artist\.analytics\.write/);
  assert.match(handler, /release_id: release\.id/);
  assert.match(handler, /artist_id: release\.artist_id/);
  assert.match(handler, /capability_idempotency/);
  assert.match(handler, /external_playlist_id === placement\.externalPlaylistId/);
  assert.match(handler, /observation_key/);
  assert.match(handler, /soundcharts_release_pilot_sync/);
});

test("Insights presents music intelligence instead of provider setup", () => {
  const page = read("app/insights/page.tsx");
  const layout = read("app/insights/layout.tsx");
  const overview = read("components/music-intelligence-overview.tsx");
  const styles = read("components/music-intelligence-overview.module.css");
  const action = read("app/connections/soundcharts-release-pilot-actions.ts");

  assert.match(page, /MusicIntelligenceOverview/);
  assert.doesNotMatch(layout, /SoundchartsReleasePilotCard/);
  assert.match(overview, /Number of playlists/);
  assert.match(overview, /Total playlist followers \/ reach/);
  assert.match(overview, /Recent playlist adds/);
  assert.match(overview, /Cross-platform audience/);
  assert.match(overview, /Source health/);
  assert.match(overview, /buildPlacementSeries/);
  assert.match(overview, /spotify_playlist_reach/);
  assert.match(styles, /\.chartGrid/);
  assert.match(styles, /\.placementTable/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(action, /integrations\.sync_soundcharts_release_pilot/);
  assert.match(action, /revalidatePath\("\/insights"\)/);
  assert.match(action, /revalidatePath\("\/proof"\)/);
});