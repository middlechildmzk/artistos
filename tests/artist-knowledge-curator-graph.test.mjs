import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260727203000_artist_knowledge_curator_graph.sql");
const page = read("app/opportunities/page.tsx");
const dashboard = read("app/dashboard/page.tsx");

test("knowledge graph schema exists", () => {
  assert.match(migration, /knowledge_entities/);
  assert.match(migration, /knowledge_entity_links/);
  assert.match(migration, /canonical_key/);
  assert.match(migration, /evidence_ids/);
});

test("opportunity intelligence preserves plans observations and explanations", () => {
  assert.match(migration, /opportunity_searches/);
  assert.match(migration, /opportunities/);
  assert.match(migration, /opportunity_source_observations/);
  assert.match(migration, /opportunity_score_features/);
  assert.match(migration, /plan_only/);
  assert.match(migration, /raw_payload/);
  assert.match(migration, /normalization_version/);
  assert.match(migration, /feature_key/);
  assert.match(migration, /explanation/);
});

test("quality scoring is multidimensional and explainable", () => {
  for (const dimension of ["fit_score", "legitimacy_score", "reach_quality_score", "accessibility_score", "relationship_score", "risk_score"]) {
    assert.match(migration, new RegExp(dimension));
  }
  assert.match(migration, /risk_flags/);
  assert.match(page, /legitimacyScore: item\.legitimacy_score/);
  assert.match(page, /riskScore: item\.risk_score/);
  assert.match(page, /corroborationCount:/);
});

test("all graph tables use workspace row level security", () => {
  for (const table of ["knowledge_entities", "knowledge_entity_links", "opportunity_searches", "opportunities", "opportunity_source_observations", "opportunity_score_features"]) {
    assert.ok(migration.includes(`alter table public.${table} enable row level security`));
  }
  assert.match(migration, /is_workspace_member/);
  assert.match(migration, /can_manage_workspace/);
});

test("opportunity intelligence is visible in product navigation", () => {
  assert.match(dashboard, /href="\/opportunities"/);
  assert.match(page, /Network Intelligence/);
  assert.match(page, /<h1>Discover<\/h1>/);
});
