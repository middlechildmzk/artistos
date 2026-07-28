import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const registry = read("lib/capabilities/crm-release-registry.ts");
const handlers = read("lib/capabilities/crm-release-handlers.ts");
const releaseActions = read("app/releases/actions.ts");
const targetActions = read("app/targets/[id]/actions.ts");
const approvals = read("app/approvals/page.tsx");

test("remaining CRM and release write contracts are registered and executable", () => {
  for (const name of ["releases.add_asset", "releases.create_campaign", "crm.add_organization_to_campaign", "crm.log_outbound_outreach"]) assert.match(registry, new RegExp(name.replaceAll(".", "\\.")));
  for (const handler of ["addReleaseAssetCapability", "createReleaseCampaignCapability", "addOrganizationToCampaignCapability", "logOutboundOutreachCapability"]) assert.match(handlers, new RegExp(`registerCapabilityHandler\\(${handler}`));
});

test("release actions no longer directly mutate assets or campaigns", () => {
  assert.match(releaseActions, /releases\.add_asset/);
  assert.match(releaseActions, /releases\.create_campaign/);
  assert.doesNotMatch(releaseActions, /from\("assets"\)/);
  assert.doesNotMatch(releaseActions, /from\("campaigns"\)/);
});

test("CRM detail actions no longer directly mutate interactions, targets, or organizations", () => {
  assert.match(targetActions, /crm\.add_organization_to_campaign/);
  assert.match(targetActions, /crm\.log_outbound_outreach/);
  for (const table of ["interactions", "campaign_targets", "organizations"]) assert.doesNotMatch(targetActions, new RegExp(`from\\(\"${table}\"\\)`));
});

test("Approval Center exposes source-level evidence provenance", () => {
  assert.match(approvals, /Evidence provenance/);
  assert.match(approvals, /evidence_records/);
  assert.match(approvals, /Open source/);
  assert.match(approvals, /Corrects prior evidence/);
  assert.match(approvals, /Evidence IDs/);
});