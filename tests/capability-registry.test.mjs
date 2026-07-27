import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const registry = read("lib/capabilities/registry.ts");
const initial = read("lib/capabilities/initial-registry.ts");

test("registry permanently protects destructive, external, and governance actions", () => {
  assert.match(registry, /R2_internal_destructive/);
  assert.match(registry, /R3_external_effect/);
  assert.match(registry, /R4_governance/);
  assert.match(registry, /capability\.approval !== "always"/);
});

test("external and governance actions require evidence", () => {
  assert.match(registry, /R3_external_effect/);
  assert.match(registry, /R4_governance/);
  assert.match(registry, /capability\.evidence !== "required"/);
});

test("MCP gated writes cannot expose risky capabilities", () => {
  assert.match(registry, /capability\.mcp === "gated_write"/);
  assert.match(registry, /R0_read/);
  assert.match(registry, /R1_internal_reversible/);
});

test("initial registry contains the first complete vertical slice", () => {
  for (const capability of [
    "context.get_active_workspace",
    "context.list_artists",
    "context.get_artist",
    "releases.list",
    "releases.get",
    "tasks.create",
    "tasks.update_status",
    "audience.suppress",
    "audience.unsuppress",
  ]) {
    assert.match(initial, new RegExp(capability.replace(".", "\\.")), `${capability} is missing`);
  }
});

test("consent reversal is governance, approval-gated, evidenced, and prohibited from MCP", () => {
  const start = initial.indexOf('name: "audience.unsuppress"');
  assert.notEqual(start, -1);
  const block = initial.slice(start, start + 1500);
  assert.match(block, /risk: "R4_governance"/);
  assert.match(block, /approval: "always"/);
  assert.match(block, /evidence: "required"/);
  assert.match(block, /mcp: "prohibited"/);
});
