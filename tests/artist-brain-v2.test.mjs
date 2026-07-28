import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260727190000_artist_brain_v2.sql");
const registry = read("lib/capabilities/brain-registry.ts");
const handlers = read("lib/capabilities/brain-handlers.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const actions = read("app/brain/actions.ts");
const page = read("app/brain/page.tsx");
const dashboard = read("app/dashboard/page.tsx");

test("Artist Brain schema separates memory, claims, evidence, and observations", () => {
  for (const table of ["brain_memories", "brain_claims", "brain_claim_evidence", "brain_learning_observations"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  for (const state of ["verified", "supported", "weak", "unknown", "stale", "conflicting"]) assert.match(migration, new RegExp(state));
  assert.match(migration, /contradiction_state/);
  assert.match(migration, /review_status/);
  assert.match(migration, /supersedes_memory_id/);
  assert.match(migration, /replaces_evidence_id|brain_claim_evidence/);
});

test("Brain writes are typed capabilities loaded by the runtime", () => {
  assert.match(registry, /brain\.create_memory/);
  assert.match(registry, /brain\.review_claim/);
  assert.match(runtime, /brain-registry/);
  assert.match(runtime, /brain-handlers/);
  assert.match(handlers, /registerCapabilityHandler\(createBrainMemoryCapability/);
  assert.match(handlers, /registerCapabilityHandler\(reviewBrainClaimCapability/);
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /workspace_id/);
});

test("Artist Brain UI preserves fact versus inference and review visibility", () => {
  assert.match(page, /Semantic fact/);
  assert.match(page, /Episodic event/);
  assert.match(page, /Learned insight/);
  assert.match(page, /Claim review/);
  assert.match(page, /contradiction_state/);
  assert.match(page, /Learning observations/);
  assert.match(page, /Nothing becomes trusted memory without visible provenance and review state/);
});

test("Brain actions cannot bypass the capability runtime", () => {
  assert.match(actions, /invokeCapability/);
  assert.match(actions, /brain\.create_memory/);
  assert.match(actions, /brain\.review_claim/);
  assert.doesNotMatch(actions, /from\("brain_memories"\).*insert/s);
  assert.doesNotMatch(actions, /from\("brain_claims"\).*update/s);
});

test("Artist Brain is visible in primary navigation", () => {
  assert.match(dashboard, /href="\/brain"/);
  assert.match(dashboard, /Artist Brain/);
});