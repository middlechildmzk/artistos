import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const registry = read("lib/capabilities/links-registry.ts");
const handlers = read("lib/capabilities/links-handlers.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const actions = read("app/links/actions.ts");
const page = read("app/links/page.tsx");
const consentMigration = read("supabase/migrations/20260728223443_minimize_fan_consent_evidence.sql");

test("ArtistOS Links capabilities are registered and loaded", () => {
  assert.match(registry, /links\.save/);
  assert.match(registry, /links\.save_destination/);
  assert.match(runtime, /links-registry/);
  assert.match(runtime, /links-handlers/);
});

test("link writes use the common capability runtime", () => {
  assert.match(actions, /invoke\("links\.save"/);
  assert.match(actions, /invoke\("links\.save_destination"/);
  assert.doesNotMatch(actions, /from\("smart_links"\)\.(insert|update|upsert)/);
  assert.doesNotMatch(actions, /from\("smart_link_destinations"\)\.(insert|update|upsert)/);
});

test("link handlers constrain release and destination writes to the active workspace", () => {
  assert.match(handlers, /eq\("workspace_id", ctx\.workspaceId\)/);
  assert.match(handlers, /release_not_found/);
  assert.match(handlers, /smart_link_not_found/);
  assert.match(handlers, /slug_taken/);
  assert.match(handlers, /capability_idempotency/);
});

test("the Links workspace preserves the connected product graph", () => {
  assert.match(page, /Release → Link → Campaign → Proof → Fan → Intelligence/);
  assert.match(page, /One link per release/);
  assert.match(page, /Human-controlled activation/);
  assert.match(page, /Consent/);
});

test("fan consent evidence excludes IP and user-agent hashes", () => {
  assert.match(consentMigration, /drop column if exists ip_hash/);
  assert.match(consentMigration, /drop column if exists user_agent_hash/);
  assert.doesNotMatch(page, /ip_hash|user_agent_hash/);
});
