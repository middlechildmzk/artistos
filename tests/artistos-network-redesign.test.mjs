import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { inferMusicService, parseMusicDestinationUrls } from "../lib/smart-links/services.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("public homepage leads with the ArtistOS Network promise", () => {
  const page = read("app/page.tsx");
  assert.match(page, /The opportunity intelligence engine for independent artists/);
  assert.match(page, /Know exactly where your next release belongs/);
  assert.match(page, /Find opportunities/);
  assert.match(page, /NetworkPreview/);
  assert.match(page, /Discover, Match, Pitch, Track, Learn|Discover/);
});

test("authenticated primary navigation has exactly five destinations", () => {
  const header = read("components/app-header.tsx");
  const primaryBlock = header.slice(header.indexOf("const primaryNavigation"), header.indexOf("const workspaceNavigation"));
  for (const label of ["Today", "Network", "Releases", "Campaigns", "Insights"]) assert.match(primaryBlock, new RegExp("label: \"" + label + "\""));
  assert.equal((primaryBlock.match(/label:/g) ?? []).length, 5);
  for (const hidden of ["Connections", "Integrations", "Automations", "Approvals", "Billing", "Help"]) assert.doesNotMatch(primaryBlock, new RegExp(hidden));
});

test("legacy product routes consolidate into the new information architecture", () => {
  assert.match(read("app/command-center/page.tsx"), /redirect\("\/dashboard"\)/);
  assert.match(read("app/operating/page.tsx"), /redirect\("\/dashboard"\)/);
  assert.match(read("app/creator/page.tsx"), /redirect\("\/releases"\)/);
  assert.match(read("app/releases/page.tsx"), /Music links/);
  assert.match(read("app/releases/page.tsx"), /Creator tools/);
  assert.match(read("app/campaigns/page.tsx"), /Proof & outcomes/);
  assert.match(read("app/analytics/page.tsx"), /<h1>Insights<\/h1>/);
});

test("music smart links infer major services and reject malformed input", () => {
  assert.equal(inferMusicService("https://open.spotify.com/track/123"), "spotify");
  assert.equal(inferMusicService("https://music.apple.com/us/album/example/123"), "apple_music");
  assert.equal(inferMusicService("https://music.youtube.com/watch?v=123"), "youtube_music");
  assert.equal(inferMusicService("javascript:alert(1)"), "other");
  const parsed = parseMusicDestinationUrls("https://open.spotify.com/track/123\nnot-a-url\nhttps://tidal.com/browse/track/456");
  assert.deepEqual(parsed.map((item) => item.service), ["spotify", "tidal"]);
});

test("free smart-link acquisition page bridges into Network Intelligence", () => {
  const page = read("app/free-music-smart-link/page.tsx");
  assert.match(page, /One music link\. Every place your fans listen/);
  assert.match(page, /Click tracking/);
  assert.match(page, /Campaign attribution/);
  assert.match(page, /Artist-owned audience/);
  assert.match(page, /Network matches next/);
  assert.match(page, /does not automatically pre-save|currently supports pre-release pages/i);
});

test("public music links have search and social discovery support", () => {
  const page = read("app/l/[slug]/page.tsx");
  assert.match(page, /MusicRecording/);
  assert.match(page, /alternates: \{ canonical/);
  assert.match(page, /openGraph/);
  assert.match(page, /next\/image/);
  assert.match(read("app/sitemap.ts"), /smart_links/);
  assert.match(read("app/robots.ts"), /free-music-smart-link/);
});
