import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const handlers = read("lib/capabilities/core-handlers.ts");
const invoke = read("lib/capabilities/invoke.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const dashboardActions = read("app/dashboard/actions.ts");
const migration = read("supabase/migrations/20260727170000_capability_runtime_ledger.sql");

test("the first executable slice has handlers for every non-governance capability", () => {
  for (const capability of [
    "getActiveWorkspaceCapability",
    "listArtistsCapability",
    "getArtistCapability",
    "listReleasesCapability",
    "getReleaseCapability",
    "createTaskCapability",
    "updateTaskStatusCapability",
    "completeInteractionFollowUpCapability",
    "suppressAudienceCapability",
  ]) {
    assert.match(handlers, new RegExp(`registerCapabilityHandler\\(${capability}`));
  }
  assert.doesNotMatch(handlers, /registerCapabilityHandler\(unsuppressAudienceCapability/);
});

test("runtime validates handler output before reporting success", () => {
  const execute = invoke.indexOf("dependencies.execute");
  const validate = invoke.indexOf("capability.output.safeParse");
  const success = invoke.indexOf('status: "ok"');
  assert.ok(execute >= 0 && validate > execute && success > validate);
  assert.match(invoke, /invalid_handler_output/);
});

test("runtime rejects conflicting idempotency keys", () => {
  assert.match(invoke, /idempotency_key_mismatch/);
  assert.match(invoke, /parsed\.data\.idempotencyKey !== args\.idempotencyKey/);
});

test("explicit human action is distinct from autonomous authority", () => {
  assert.match(runtime, /ctx\.principalId === `user:\$\{ctx\.userId\}`/);
  assert.match(runtime, /system\.explicit_human_action/);
  assert.match(runtime, /Agent principals receive no implicit grant/);
});

test("dashboard mutations use the capability runtime instead of direct table writes", () => {
  assert.match(dashboardActions, /invokeCapability/);
  assert.match(dashboardActions, /tasks\.update_status/);
  assert.match(dashboardActions, /interactions\.complete_follow_up/);
  assert.doesNotMatch(dashboardActions, /\.from\("tasks"\)/);
  assert.doesNotMatch(dashboardActions, /\.from\("interactions"\)/);
});

test("runtime migration creates approval, replay, and audit ledgers with RLS", () => {
  for (const table of ["capability_approvals", "capability_idempotency", "capability_audit_log"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /private\.is_workspace_member/);
  assert.match(migration, /private\.can_manage_workspace/);
});
