import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const registry = read("lib/capabilities/crm-release-registry.ts");
const handlers = read("lib/capabilities/crm-release-handlers.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const releases = read("app/releases/actions.ts");
const crm = read("app/targets/[id]/actions.ts");

test("CRM and release capabilities are registered and loaded", () => {
  for (const name of ["crm.update_organization_relationship", "releases.create", "releases.update"]) {
    assert.match(registry, new RegExp(name.replaceAll(".", "\\.")));
  }
  assert.match(runtime, /crm-release-registry/);
  assert.match(runtime, /crm-release-handlers/);
});

test("release create and metadata update use the common runtime", () => {
  assert.match(releases, /invoke\("releases\.create"/);
  assert.match(releases, /invoke\("releases\.update"/);
  const createSection = releases.slice(releases.indexOf("export async function createRelease"), releases.indexOf("export async function updateRelease"));
  const updateSection = releases.slice(releases.indexOf("export async function updateRelease"), releases.indexOf("export async function addReleaseAsset"));
  assert.doesNotMatch(createSection, /from\("releases"\)\.insert/);
  assert.doesNotMatch(updateSection, /from\("releases"\)\.update/);
});

test("CRM relationship edits use a typed capability", () => {
  const section = crm.slice(crm.indexOf("export async function updateRelationship"));
  assert.match(section, /crm\.update_organization_relationship/);
  assert.match(section, /invokeCapability/);
  assert.doesNotMatch(section, /from\("organizations"\)\.update/);
});

test("handlers constrain workspace and persist idempotent results", () => {
  assert.match(handlers, /capability_idempotency/);
  assert.match(handlers, /workspace_id/);
  assert.match(handlers, /starterTaskCount/);
  assert.match(handlers, /organization_not_found/);
});