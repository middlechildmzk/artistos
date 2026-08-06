import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  deriveMusicActivityFreshness,
  musicActivityObservationKey,
  parseMusicActivityObservation,
} from "../lib/music-activity/contract.ts";

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
  assert.match(runtime, /music-activity-registry/);
  assert.match(runtime, /music-activity-handlers/);
  assert.match(action, /invokeCapability/);
  assert.match(panel, /Test free Soundcharts sandbox/);
  assert.match(panel, /does not prove Middle Child coverage/);
});

test("research brief requires rights, technical and evidence review", () => {
  const prompt = read("docs/research/music-activity-provider-research-prompt.md");
  assert.match(prompt, /Multi-tenant use rights/);
  assert.match(prompt, /caching\/retention rights/);
  assert.match(prompt, /Do not create accounts/);
  assert.match(prompt, /avoid name-only matching/);
});
