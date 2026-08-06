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

const scoring = await loadTypeScriptModule("lib/network-intelligence/source-runtime/scoring.ts");
const matching = await loadTypeScriptModule("lib/network-intelligence/source-runtime/matching.ts");
const idempotency = await loadTypeScriptModule("lib/network-intelligence/source-runtime/idempotency.ts");
const policy = await loadTypeScriptModule("lib/network-intelligence/source-runtime/policy.ts");

const read = (file) => fs.readFileSync(file, "utf8");
const actions = read("app/opportunities/actions.ts");
const page = read("app/opportunities/page.tsx");
const execute = read("lib/capabilities/opportunity-handlers/execute-search.ts");
const promote = read("lib/capabilities/opportunity-handlers/promote.ts");
const review = read("lib/capabilities/opportunity-handlers/review.ts");
const core = read("lib/network-intelligence/source-runtime/core.ts");
const wikidata = read("lib/network-intelligence/source-runtime/wikidata.ts");
const youtube = read("lib/network-intelligence/source-runtime/youtube.ts");
const migration = read("supabase/migrations/20260804163000_network_source_runtime_v1.sql");

function candidate(overrides = {}) {
  return {
    sourceSlug: "wikidata",
    sourcePolicyDisposition: "accept_verified_source",
    externalId: "Q123",
    canonicalUrl: "https://www.wikidata.org/wiki/Q123",
    title: "100% Pure Sound",
    summary: null,
    candidateKind: "unknown",
    opportunityType: "radio",
    observedAt: "2026-08-04T00:00:00.000Z",
    freshnessStatus: "unknown",
    confidence: "weak",
    legitimacyStatus: "unreviewed",
    audienceSignal: null,
    fitScore: 0,
    legitimacyScore: null,
    reachQualityScore: null,
    accessibilityScore: null,
    relationshipScore: null,
    riskScore: null,
    riskFlags: [],
    eligibility: {},
    scoreFeatures: [],
    rawPayload: {},
    normalizedPayload: {},
    identityUrls: [],
    externalIdentifiers: {},
    discoveryClusterKey: "source:wikidata:Q123",
    corroboratingSources: ["wikidata"],
    sourceObservations: [{ sourceSlug: "wikidata", sourcePolicyDisposition: "accept_verified_source", externalId: "Q123", canonicalUrl: "https://www.wikidata.org/wiki/Q123", observedAt: "2026-08-04T00:00:00.000Z", identityUrls: [], externalIdentifiers: {}, rawPayload: {}, normalizedPayload: {} }],
    ...overrides,
  };
}

test("missing evidence stays unassessed instead of receiving synthetic positive scores", () => {
  const result = scoring.scoreDiscovery({ title: "Example station", summary: null, query: "melodic bass radio", fitContext: null, lane: "radio", sourceSlug: "wikidata" });
  assert.equal(result.legitimacy, null);
  assert.equal(result.reachQuality, null);
  assert.equal(result.accessibility, null);
  assert.equal(result.relationshipScore, null);
  assert.equal(result.risk, null);
  assert.equal(result.features.some((feature) => feature.key === "audience_signal"), false);
});

test("name-only identity similarity never clears the deterministic match threshold", () => {
  const matches = matching.findMatches(candidate(), [{ id: "org-1", canonical_name: "100% Pure Sound", display_name: null, website: "https://other.example", primary_source_url: null }], []);
  assert.deepEqual(matches, []);
});

test("stable source IDs and canonical URLs remain strong match signals", () => {
  const stable = matching.findMatches(candidate(), [], [{ id: "prop-1", organization_id: null, name: "Different", url: null, platform_url: null, raw_record: { source_slug: "wikidata", external_id: "Q123" } }]);
  assert.equal(stable[0].score, 1);
  assert.deepEqual(stable[0].reasons, ["stable_source_identity_exact"]);

  const url = matching.findMatches(candidate(), [{ id: "org-1", canonical_name: "Different", display_name: null, website: "https://www.wikidata.org/wiki/Q123/?utm_source=test", primary_source_url: null }], []);
  assert.equal(url[0].score, 0.98);
});

test("URL normalization removes query strings, fragments, www, casing, and trailing slashes", () => {
  assert.equal(matching.normalizeUrl("HTTPS://WWW.Example.com/Path/?x=1#top"), "example.com/Path");
  assert.equal(matching.normalizeUrl("https://example.com/"), "example.com");
});

test("form-render nonces make double submissions replayable but allow a new rendered form", () => {
  const first = idempotency.semanticIdempotencyKey("opportunity-execute", ["search-1", 12, "nonce-a"]);
  const duplicate = idempotency.semanticIdempotencyKey("opportunity-execute", ["search-1", 12, "nonce-a"]);
  const newRender = idempotency.semanticIdempotencyKey("opportunity-execute", ["search-1", 12, "nonce-b"]);
  assert.equal(first, duplicate);
  assert.notEqual(first, newRender);
});

test("YouTube execution is code-blocked until compliance controls are approved", () => {
  assert.equal(policy.SOURCE_POLICIES.youtube.executionEnabled, false);
  assert.equal(policy.policyAllowsExecution(policy.SOURCE_POLICIES.youtube), false);
  assert.equal(policy.policyAllowsExecution(policy.SOURCE_POLICIES.wikidata), true);
  assert.match(youtube, /blockedAdapter\("youtube"\)/);
  assert.doesNotMatch(youtube, /subscriberCount|brandingSettings|statistics/);
});

test("discovery facts remain reviewable and do not overstate legitimacy or freshness", () => {
  assert.match(wikidata, /freshnessStatus: "unknown"/);
  assert.match(wikidata, /confidence = officialWebsites\.length \|\| instanceOf\.length \? "supported" as const : "weak" as const/);
  assert.match(wikidata, /legitimacyStatus: "unreviewed"/);
  assert.doesNotMatch(wikidata, /legitimacyStatus: "credible"/);
  assert.match(page, /legitimacyScore: item\.legitimacy_score/);
  assert.match(page, /freshness: item\.freshness_status/);
});

test("UI actions use semantic keys and form-render nonces", () => {
  assert.match(actions, /semanticIdempotencyKey/);
  assert.match(actions, /submissionNonce/);
  assert.doesNotMatch(actions, /randomUUID/);
  assert.match(page, /name="submissionNonce"/);
});

test("promotion never performs wildcard name matching and stamps the actor workspace", () => {
  assert.doesNotMatch(promote, /\.ilike\(/);
  assert.match(promote, /review_disposition === "enrich_existing"/);
  assert.match(promote, /workspace_id: ctx\.workspaceId[\s\S]*campaign_id: campaign\.id/);
  assert.match(promote, /verification_status: "unverified"/);
  assert.match(promote, /evidence_strength: 1/);
});

test("review and promotion verify matched entities inside the active workspace", () => {
  assert.match(review, /assertWorkspaceEntity/);
  assert.match(review, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(review, /matched_entity_not_found/);
  assert.match(promote, /resolveReviewedEntity/);
  assert.match(promote, /\.eq\("workspace_id", workspaceId\)/);
});

test("failed executions close the run and observations remain append-only", () => {
  assert.match(execute, /status: "failed"/);
  assert.match(execute, /last_run_status: "failed"/);
  assert.doesNotMatch(execute, /approved_by|approved_at/);
  assert.match(execute, /from\("opportunity_source_observations"\)\.insert/);
  assert.doesNotMatch(execute, /from\("opportunity_source_observations"\)\.upsert/);
  assert.match(execute, /stored_until/);
});

test("source policy is evaluated again at execution time", () => {
  assert.match(core, /policyAllowsExecution\(policy\)/);
  assert.match(core, /source_policy_blocked/);
});

test("migration removes the single-workspace default and blocks viewer writes", () => {
  assert.match(migration, /campaign_targets alter column workspace_id drop default/);
  assert.match(migration, /opportunity_search_runs_insert[\s\S]*private\.can_manage_workspace/);
  assert.match(migration, /opportunity_match_candidates_insert[\s\S]*private\.can_manage_workspace/);
  assert.match(migration, /revoke update on public\.opportunity_source_observations/);
  assert.match(migration, /opportunity_match_candidates_delete/);
  assert.match(migration, /stored_until timestamptz/);
});
