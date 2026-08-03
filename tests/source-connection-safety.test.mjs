import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("YouTube sync rejects OAuth channels that do not match a mapped identity", async () => {
  const [handler, identity] = await Promise.all([
    read("lib/capabilities/integrations-handlers.ts"),
    read("lib/integrations/youtube-identity.ts"),
  ]);

  assert.match(handler, /profileMatchesYouTubeChannel/);
  assert.match(handler, /youtube_channel_mismatch/);
  assert.match(handler, /profile\.source_type !== "oauth"/);
  assert.match(handler, /youtube_identity_verified/);
  assert.match(identity, /profile_url/);
  assert.match(identity, /customUrl/);
  assert.match(identity, /canonical_artist_id/);
});

test("Google reconnect forces an explicit account selection and fresh consent", async () => {
  const google = await read("lib/integrations/google.ts");
  assert.match(google, /prompt: "select_account consent"/);
  assert.match(google, /youtube\.readonly/);
  assert.match(google, /yt-analytics\.readonly/);
});

test("server-managed credentials are limited to an explicit allowlist", async () => {
  const crypto = await read("lib/integrations/token-crypto.ts");
  assert.match(crypto, /SERVER_MANAGED_TOKEN_REFERENCES/);
  assert.match(crypto, /\["env\.KIT_API_KEY", "KIT_API_KEY"\]/);
  assert.doesNotMatch(crypto, /envelope\.replace\([^\n]+env/);
  assert.doesNotMatch(crypto, /process\.env\[envelope\]/);
});

test("Kit Vercel-key bootstrap is owner-only and single-workspace only", async () => {
  const handler = await read("lib/capabilities/provider-integrations-handlers.ts");
  assert.match(handler, /KIT_SERVER_TOKEN_REFERENCE = "env\.KIT_API_KEY"/);
  assert.match(handler, /ctx\.role !== "owner"/);
  assert.match(handler, /workspaceCount !== 1/);
  assert.match(handler, /validateKitApiKey\(serverApiKey\)/);
  assert.match(handler, /raw_subscriber_records_stored: false/);
});
