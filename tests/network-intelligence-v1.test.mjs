import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

async function loadTypeScriptModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const rules = await loadTypeScriptModule("lib/network-intelligence/entity-search.ts");
const page = fs.readFileSync("app/targets/page.tsx", "utf8");
const detail = fs.readFileSync("app/targets/[id]/page.tsx", "utf8");
const actions = fs.readFileSync("app/targets/[id]/actions.ts", "utf8");
const registry = fs.readFileSync("lib/capabilities/crm-release-registry.ts", "utf8");
const runtime = fs.readFileSync("lib/capabilities/server-runtime.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260804143000_network_intelligence_contact_safety.sql", "utf8");

test("entity rules classify unlinked Spotify properties without an organization", () => {
  assert.equal(rules.categoryMatches("playlist", ["Spotify playlist", "Spotify", "Future Bass Finds"]), true);
  assert.equal(rules.categoryMatches("radio", ["Spotify playlist", "Spotify", "Future Bass Finds"]), false);
});

test("public and inherited contact labels never become automatically open routes", () => {
  const legacyPermission = rules.derivePermissionState("Active - imported from opt-in/download/old list", false);
  assert.equal(legacyPermission, "marketing_opt_in");
  assert.equal(rules.deriveContactRouteState({ emails: ["public@example.com"], permissionState: legacyPermission }), "human_review_required");

  const publicPermission = rules.derivePermissionState("Public business contact; outreach not authorized", false);
  assert.equal(publicPermission, "public_business_contact");
  assert.equal(rules.deriveContactRouteState({ emails: ["public@example.com"], permissionState: publicPermission }), "human_review_required");
});

test("suppression always overrides every other contact state", () => {
  const suppressed = new Set(["blocked@example.com"]);
  assert.equal(rules.deriveContactRouteState({ emails: ["BLOCKED@example.com"], suppressedEmails: suppressed, submissionStatus: "open" }), "blocked_suppressed");
  assert.equal(rules.derivePermissionState("Business relationship / direct correspondence", true), "suppressed");
});

test("submission routes distinguish open, verification required, and missing", () => {
  assert.equal(rules.deriveContactRouteState({ submissionStatus: "open" }), "open");
  assert.equal(rules.deriveContactRouteState({ submissionStatus: "needs_verification" }), "needs_verification");
  assert.equal(rules.deriveContactRouteState({}), "no_route");
});

test("contact email parsing is normalized and deduplicated", () => {
  assert.deepEqual(rules.parseContactEmails("One@Example.com; one@example.com, two@example.org"), ["one@example.com", "two@example.org"]);
});

test("Network Intelligence queries properties and people as first-class search entities", () => {
  assert.match(page, /from\("properties"\)[\s\S]*\{ count: "exact" \}/);
  assert.match(page, /from\("people"\)[\s\S]*\{ count: "exact" \}/);
  assert.match(page, /Organization unresolved/);
  assert.match(page, /Searchable properties/);
  assert.match(page, /Searchable people/);
  assert.doesNotMatch(page, /\.in\("organization_id", organizationIds\)/);
  assert.doesNotMatch(page, /Verified route/);
  assert.doesNotMatch(page, /Apple Music/);
});

test("search results expose evidence, freshness, and safe route state without send actions", () => {
  assert.match(page, /followers_asof/);
  assert.match(page, /source_record_id/);
  assert.match(page, /Human review required/);
  assert.doesNotMatch(page, /mailto:/);
  assert.doesNotMatch(page, /Record outreach/);
});

test("target detail blocks unassigned, suppressed, and unverified outreach", () => {
  assert.match(detail, /Assign this target to a campaign/);
  assert.match(detail, /actionableEndpoints/);
  assert.match(detail, /campaignTargets\.length > 0/);
  assert.match(detail, /Evidence note or final message sent/);
  assert.match(detail, /followers_asof/);
  assert.match(detail, /suppressedEmails/);
});

test("outreach actions use form-render idempotency and require full route context", () => {
  assert.match(actions, /submissionNonce/);
  assert.match(actions, /!campaignId \|\| !endpointId/);
  assert.match(actions, /createHash\("sha256"\)/);
  assert.doesNotMatch(actions, /randomUUID/);
});

test("the capability contract requires evidence and a campaign endpoint", () => {
  const outreachBlock = registry.slice(registry.indexOf("export const logOutboundOutreachCapability"), registry.indexOf("export const createReleaseCapability"));
  assert.match(outreachBlock, /campaignId: uuid/);
  assert.match(outreachBlock, /endpointId: uuid/);
  assert.match(outreachBlock, /body: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(outreachBlock, /evidence: "required"/);
});

test("the common runtime enforces campaign assignment, open routes, and suppression", () => {
  assert.match(runtime, /assertVerifiedOutreachRoute/);
  assert.match(runtime, /campaign_target_not_assigned/);
  assert.match(runtime, /submission_endpoint_not_open/);
  assert.match(runtime, /submission_endpoint_suppressed/);
  assert.match(runtime, /args\.capabilityName === "crm\.log_outbound_outreach"/);
});

test("the pending migration preserves history and creates RLS-invoker contact state", () => {
  assert.match(migration, /consent_status_original/);
  assert.match(migration, /Public business contact; outreach not authorized/);
  assert.match(migration, /contact_permission_state/);
  assert.match(migration, /with \(security_invoker = true\)/);
  assert.match(migration, /contactable_industry_people/);
  assert.match(migration, /contactable_submission_endpoints/);
  assert.match(migration, /workspace_id set not null/);
});
