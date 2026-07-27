import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const registry = read("lib/capabilities/campaign-registry.ts");
const handlers = read("lib/capabilities/campaign-handlers.ts");
const actions = read("app/campaigns/actions.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const migration = read("supabase/migrations/20260727183000_evidence_records.sql");

test("campaign mutation contracts are registered and loaded by the server runtime", () => {
  for (const name of ["campaigns.update_target_status", "campaigns.record_reply", "campaigns.record_outcome"]) {
    assert.match(registry, new RegExp(name.replaceAll(".", "\\.")));
  }
  assert.match(runtime, /import "\.\/campaign-registry"/);
  assert.match(runtime, /import "\.\/campaign-handlers"/);
});

test("campaign server actions invoke capabilities instead of writing domain tables directly", () => {
  assert.match(actions, /invokeCapability/);
  assert.match(actions, /campaigns\.update_target_status/);
  assert.match(actions, /campaigns\.record_reply/);
  assert.match(actions, /campaigns\.record_outcome/);
  assert.doesNotMatch(actions, /\.from\("campaign_targets"\)/);
  assert.doesNotMatch(actions, /\.from\("interactions"\)/);
  assert.doesNotMatch(actions, /\.from\("outcomes"\)/);
  assert.doesNotMatch(actions, /\.from\("organizations"\)/);
});

test("campaign outcomes require and return evidence", () => {
  assert.match(registry, /evidence: "required"/);
  assert.match(registry, /evidenceSummary: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(handlers, /from\("evidence_records"\)/);
  assert.match(handlers, /evidenceIds: \[evidence\.id\]/);
  assert.match(actions, /evidence_summary_required/);
});

test("evidence records preserve source, confidence, lineage, and revocation state", () => {
  assert.match(migration, /create table if not exists public\.evidence_records/);
  for (const field of ["source_type", "source_uri", "confidence", "observed_at", "content_hash", "supersedes_id", "revoked_at", "revocation_reason"]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.is_workspace_member/);
});

test("campaign commands use durable idempotency and workspace constraints", () => {
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /input_hash/);
  assert.match(handlers, /eq\("workspace_id", ctx\.workspaceId\)/);
  assert.match(handlers, /error\.code !== "23505"/);
});
