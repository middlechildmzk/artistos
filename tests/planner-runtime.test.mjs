import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registry = await readFile(new URL("../lib/capabilities/planner-registry.ts", import.meta.url), "utf8");
const handlers = await readFile(new URL("../lib/capabilities/planner-handlers.ts", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/intelligence/actions.ts", import.meta.url), "utf8");
const runtime = await readFile(new URL("../lib/capabilities/server-runtime.ts", import.meta.url), "utf8");

const requiredCapabilities = [
  "planner.create_recommendation",
  "planner.update_recommendation_status",
  "planner.create_content_idea",
  "planner.update_content_idea_status",
  "analytics.record_metric_snapshot",
  "planner.create_automation_plan",
  "planner.set_automation_plan_enabled",
];

test("planner capabilities are registered and loaded", () => {
  for (const capability of requiredCapabilities) assert.match(registry, new RegExp(capability.replaceAll(".", "\\.")));
  assert.match(runtime, /import "\.\/planner-registry"/);
  assert.match(runtime, /import "\.\/planner-handlers"/);
});

test("all intelligence actions invoke the trusted runtime", () => {
  for (const capability of requiredCapabilities) assert.match(actions, new RegExp(capability.replaceAll(".", "\\.")));
  assert.match(actions, /invokeCapability/);
});

test("intelligence actions cannot write domain tables directly", () => {
  for (const table of ["recommendations", "content_ideas", "metric_snapshots", "automation_rules"]) {
    assert.doesNotMatch(actions, new RegExp(`from\\(["']${table}["']\\)`));
  }
});

test("planner handlers preserve workspace scope and durable idempotency", () => {
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /workspace_id/);
  assert.match(handlers, /executionMode: "plan_only"/);
});
