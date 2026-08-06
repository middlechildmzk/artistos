import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");

test("Today is focused on the current release and highest-value actions", () => {
  assert.match(dashboard, /<h1>Today<\/h1>/);
  assert.match(dashboard, /Current release/);
  assert.match(dashboard, /Best next move/);
  assert.match(dashboard, /Priority actions/);
  assert.match(dashboard, /Strong opportunities to review/);
  assert.match(dashboard, /Follow-ups due/);
  assert.match(dashboard, /Campaign pulse/);
  assert.match(dashboard, /One useful signal/);
});

test("Today does not expose workspace diagnostics as artist priorities", () => {
  assert.doesNotMatch(dashboard, /Source health/);
  assert.doesNotMatch(dashboard, /Workspace data/);
  assert.doesNotMatch(dashboard, /Workspace health/);
  assert.doesNotMatch(dashboard, /oauth_connections/);
  assert.doesNotMatch(dashboard, /artist_platform_profiles/);
  assert.doesNotMatch(dashboard, /Imported fan records/);
});
