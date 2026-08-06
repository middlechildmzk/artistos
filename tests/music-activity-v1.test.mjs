import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  deriveMusicActivityFreshness,
  musicActivityObservationKey,
  parseMusicActivityObservation,
} from "../lib/music-activity/contract.ts";
import { buildMusicActivityFeed } from "../lib/music-activity/feed.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const observation = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  artistId: "22222222-2222-4222-8222-222222222222",
  releaseId: "33333333-3333-4333-8333-333333333333",
  recording: {
    isrc: "USABC2600001",
    artistName: "Middle Child",
    trackTitle: "Never Alone",
  },
  kind: "playlist_added",
  source: {
    provider: "soundcharts",
    sourceClass: "licensed",
    sourceUrl: "https://example.com/provider/placement/123",
    providerRecordId: "placement-123",
    acquisitionMethod: "provider_api",
    cadence: "hourly",
  },
  match: {
    method: "isrc",
    confidence: "verified",
    confidenceScore: 1,
  },
  occurredAt: "2026-08-06T20:00:00.000Z",
  observedAt: "2026-08-06T20:05:00.000Z",
  territory: "US",
  subject: {
    name: "Example playlist",
    type: "playlist",
    externalId: "playlist-456",
    url: "https://example.com/playlist/456",
  },
  metrics: { position: 12, reach: 5000 },
  metadata: {},
};

test("music activity requires a strong recording identity", () => {
  assert.doesNotThrow(() => parseMusicActivityObservation(observation));
  assert.throws(() => parseMusicActivityObservation({
    ...observation,
    recording: { artistName: "Middle Child", trackTitle: "Never Alone" },
  }), /requires an ISRC, platform track ID, or provider recording ID/);
});

test("music activity observation keys are deterministic and provider-record specific", () => {
  const first = musicActivityObservationKey(observation);
  const second = musicActivityObservationKey(JSON.parse(JSON.stringify(observation)));
  const changed = musicActivityObservationKey({
    ...observation,
    source: { ...observation.source, providerRecordId: "placement-124" },
  });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, changed);
});

test("music activity freshness respects source cadence", () => {
  const now = new Date("2026-08-07T08:00:00.000Z");
  assert.equal(deriveMusicActivityFreshness({ observedAt: "2026-08-07T07:30:00.000Z", cadence: "hourly", now }), "current");
  assert.equal(deriveMusicActivityFreshness({ observedAt: "2026-08-06T12:00:00.000Z", cadence: "hourly", now }), "stale");
  assert.equal(deriveMusicActivityFreshness({ observedAt: "2026-08-01T08:00:00.000Z", cadence: "hourly", now }), "expired");
});

test("unified activity feed combines owned, placement, metric and evidence signals", () => {
  const items = buildMusicActivityFeed({
    now: new Date("2026-08-06T22:00:00.000Z"),
    releases: [{
      id: "33333333-3333-4333-8333-333333333333",
      artist_id: "22222222-2222-4222-8222-222222222222",
      title: "Never Alone",
      isrc: "USABC2600001",
    }],
    smartLinks: [{ id: "44444444-4444-4444-8444-444444444444", release_id: "33333333-3333-4333-8333-333333333333", slug: "never-alone" }],
    linkEvents: [{
      id: "55555555-5555-4555-8555-555555555555",
      smart_link_id: "44444444-4444-4444-8444-444444444444",
      event_type: "destination_click",
      destination_service: "spotify",
      country_code: "US",
      occurred_at: "2026-08-06T21:50:00.000Z",
    }],
    metrics: [{
      id: "66666666-6666-4666-8666-666666666666",
      artist_id: "22222222-2222-4222-8222-222222222222",
      release_id: "33333333-3333-4333-8333-333333333333",
      platform: "listenbrainz",
      metric: "total_listen_count",
      value: 42,
      captured_on: "2026-08-06",
      source_url: "https://api.listenbrainz.org/1/popularity/artist",
    }],
    placements: [{
      id: "77777777-7777-4777-8777-777777777777",
      release_id: "33333333-3333-4333-8333-333333333333",
      playlist_name: "Example Playlist",
      playlist_url: "https://open.spotify.com/playlist/example",
      track_position: 12,
      added_at: "2026-08-06T20:00:00.000Z",
      source_type: "licensed",
      confidence: 1,
      verification_state: "verified",
      last_verified_at: "2026-08-06T20:05:00.000Z",
    }],
    evidence: [{
      id: "88888888-8888-4888-8888-888888888888",
      release_id: "33333333-3333-4333-8333-333333333333",
      evidence_type: "listenbrainz_artist_sync",
      source_type: "api_response",
      verification_status: "verified",
      verification_method: "listenbrainz_api",
      confidence: "verified",
      observed_at: "2026-08-06T19:00:00.000Z",
      summary: "Synced open ListenBrainz observations.",
      source_uri: "https://api.listenbrainz.org/1/popularity/artist",
    }],
  });
  assert.equal(items.length, 4);
  assert.equal(items[0].kind, "link_click");
  assert.ok(items.every((item) => item.isrc === "USABC2600001"));
  assert.ok(items.every((item) => item.identityState === "strong_recording_identity"));
  assert.deepEqual(new Set(items.map((item) => item.sourceClass)), new Set(["owned", "licensed", "public"]));
});

test("activity feed keeps artist-level signals distinct from track identity", () => {
  const items = buildMusicActivityFeed({
    now: new Date("2026-08-06T22:00:00.000Z"),
    releases: [],
    smartLinks: [],
    linkEvents: [],
    placements: [],
    evidence: [],
    metrics: [{
      id: "99999999-9999-4999-8999-999999999999",
      artist_id: "22222222-2222-4222-8222-222222222222",
      release_id: null,
      platform: "lastfm",
      metric: "listeners",
      value: 12,
      captured_on: "2026-08-06",
      source_url: "https://www.last.fm/music/Middle+Child",
    }],
  });
  assert.equal(items[0].identityState, "workspace_signal");
  assert.equal(items[0].releaseId, null);
  assert.equal(items[0].sourceClass, "public");
});

test("Soundcharts sandbox is read-only, credential-free and not production access", () => {
  const client = read("lib/integrations/soundcharts-sandbox.ts");
  assert.match(client, /x-app-id/);
  assert.match(client, /x-api-key/);
  assert.match(client, /soundcharts_sandbox_path_not_allowed/);
  assert.match(client, /method: "GET"/);
  assert.match(client, /productionAccess: false/);
  assert.match(client, /credentialsStored: false/);
  assert.doesNotMatch(client, /process\.env/);
  assert.doesNotMatch(client, /method: "POST"/);
});

test("sandbox verification uses capability, evidence and audit runtime", () => {
  const registry = read("lib/capabilities/music-activity-registry.ts");
  const handler = read("lib/capabilities/music-activity-handlers.ts");
  const runtime = read("lib/capabilities/server-runtime.ts");
  const action = read("app/connections/music-activity-actions.ts");
  const panel = read("app/connections/free-source-panels.tsx");
  assert.match(registry, /integrations\.verify_soundcharts_sandbox/);
  assert.match(registry, /evidence: "required"/);
  assert.match(handler, /soundcharts_sandbox_probe/);
  assert.match(handler, /production_provider_verified: false/);
  assert.match(handler, /capability_idempotency/);
  assert.match(handler, /source_uri/);
  assert.match(runtime, /music-activity-registry/);
  assert.match(runtime, /music-activity-handlers/);
  assert.match(action, /invokeCapability/);
  assert.match(panel, /Test free Soundcharts sandbox/);
  assert.match(panel, /does not prove Middle Child coverage/);
});

test("Insights embeds the unified activity read model", () => {
  const layout = read("app/insights/layout.tsx");
  const loader = read("components/music-activity-feed-loader.tsx");
  const component = read("components/music-activity-feed.tsx");
  assert.match(layout, /MusicActivityFeedLoader/);
  assert.match(loader, /buildMusicActivityFeed/);
  assert.match(loader, /playlist_placements/);
  assert.match(loader, /link_events/);
  assert.match(loader, /metric_snapshots/);
  assert.match(loader, /evidence_records/);
  assert.match(component, /Music activity/);
  assert.match(component, /strong_recording_identity/);
});

test("research brief requires rights, technical and evidence review", () => {
  const prompt = read("docs/research/music-activity-provider-research-prompt.md");
  assert.match(prompt, /Multi-tenant use rights/);
  assert.match(prompt, /caching\/retention rights/);
  assert.match(prompt, /Do not create accounts/);
  assert.match(prompt, /avoid name-only matching/);
});