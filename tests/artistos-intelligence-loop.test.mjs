import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("ArtistOS exposes the connected intelligence surfaces", () => {
  const dashboard = read("app/dashboard/page.tsx");
  assert.match(dashboard, /href="\/campaigns"/);
  assert.match(dashboard, /href="\/targets"/);
  assert.match(dashboard, /href="\/proof"/);
  assert.match(dashboard, /href="\/analytics"/);
});

test("campaign outcomes preserve release, campaign, target, and verification lineage", () => {
  const handlers = read("lib/capabilities/campaign-handlers.ts");
  assert.match(handlers, /release_id: releaseId/);
  assert.match(handlers, /campaign_id: target\.campaign_id/);
  assert.match(handlers, /campaign_target_id: target\.id/);
  assert.match(handlers, /verification_status:/);
  assert.match(handlers, /confidence_score:/);
  assert.match(handlers, /contradiction_state: "clear"/);
});

test("outreach creates canonical submission and evidence receipts without direct public writes", () => {
  const handlers = read("lib/capabilities/crm-release-handlers.ts");
  assert.match(handlers, /from\("campaign_submissions"\)/);
  assert.match(handlers, /submission_mode: "outreach"/);
  assert.match(handlers, /status: "in_review"/);
  assert.match(handlers, /evidence_type: "campaign_submission"/);
  assert.match(handlers, /source_type: "human_attestation"/);
  assert.doesNotMatch(handlers, /service_role/i);
});

test("campaign deliverables use the production lifecycle vocabulary", () => {
  const registry = read("lib/capabilities/campaign-registry.ts");
  const actions = read("app/campaigns/actions.ts");
  for (const status of ["planned", "accepted", "scheduled", "delivered", "verified", "disputed", "cancelled"]) {
    assert.match(registry, new RegExp(`"${status}"`));
    assert.match(actions, new RegExp(`"${status}"`));
  }
  assert.doesNotMatch(registry, /"pending"|"in_progress"|"completed"/);
});

test("Proof treats clear evidence as non-contradictory and counts canonical completion states", () => {
  const proof = read("app/proof/page.tsx");
  assert.match(proof, /contradiction_state !== "clear"/);
  assert.match(proof, /\["delivered", "verified"\]/);
  assert.match(proof, /\["accepted", "promotion_committed", "completed"\]/);
});

test("Network Intelligence uses authenticated workspace scoping", () => {
  const network = read("app/targets/page.tsx");
  assert.match(network, /eq\("workspace_id", workspaceId\)/);
  assert.match(network, /Search network/);
  assert.match(network, /Evidence/);
});

test("Music Intelligence computes changes from source-visible snapshots", () => {
  const analytics = read("app/analytics/page.tsx");
  assert.match(analytics, /metric_snapshots/);
  assert.match(analytics, /formatTrend/);
  assert.match(analytics, /Release comparison/);
  assert.match(analytics, /Source URL/);
});
