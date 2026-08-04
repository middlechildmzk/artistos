import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  page: read("app/opportunities/page.tsx"),
  actions: read("app/opportunities/actions.ts"),
  handlers: read("lib/capabilities/opportunity-handlers.ts"),
  registry: read("lib/capabilities/opportunity-registry.ts"),
  serverRuntime: read("lib/capabilities/server-runtime.ts"),
  policy: read("lib/network-intelligence/source-runtime/policy.ts"),
  core: read("lib/network-intelligence/source-runtime/core.ts"),
  wikidata: read("lib/network-intelligence/source-runtime/wikidata.ts"),
  youtube: read("lib/network-intelligence/source-runtime/youtube.ts"),
  migration: read("supabase/migrations/20260804163000_network_source_runtime_v1.sql"),
  env: read(".env.example"),
};

test("source runtime reuses capability and Opportunity Intelligence boundaries", () => {
  for (const capability of ["opportunity.create_search", "opportunity.execute_search", "opportunity.review", "opportunity.promote_to_crm"]) {
    assert.match(files.registry, new RegExp(capability.replaceAll(".", "\\.")));
  }
  assert.match(files.serverRuntime, /opportunity-registry/);
  assert.match(files.serverRuntime, /opportunity-handlers/);
  assert.match(files.actions, /invokeCapability/);
  assert.doesNotMatch(files.actions, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(/);
});

test("source policy allows only approved official adapters", () => {
  assert.match(files.policy, /wikidata/);
  assert.match(files.policy, /youtube/);
  assert.match(files.policy, /accept_verified_source/);
  assert.match(files.policy, /policyAllowsExecution/);
  assert.doesNotMatch(files.policy, /tiktok|submithub|groover/i);
  assert.match(files.page, /TikTok Research API/);
  assert.match(files.page, /Commercial use rejected/);
  assert.match(files.page, /External handoff only/);
});

test("adapters use official endpoints and server-only configuration", () => {
  assert.match(files.wikidata, /https:\/\/www\.wikidata\.org\/w\/api\.php/);
  assert.match(files.wikidata, /User-Agent/);
  assert.match(files.youtube, /https:\/\/www\.googleapis\.com\/youtube\/v3\/search/);
  assert.match(files.youtube, /https:\/\/www\.googleapis\.com\/youtube\/v3\/channels/);
  assert.match(files.youtube, /process\.env\.YOUTUBE_DATA_API_KEY/);
  assert.match(files.env, /YOUTUBE_DATA_API_KEY=/);
  assert.doesNotMatch(files.env, /NEXT_PUBLIC_YOUTUBE/);
});

test("discovery remains review-only and CRM promotion is approval gated", () => {
  assert.match(files.page, /No result becomes a CRM target merely because an API returned it/);
  assert.match(files.registry, /approval: "always"/);
  assert.match(files.handlers, /merge_requires_dedicated_workflow/);
  assert.match(files.handlers, /opportunity_match_candidates/);
  assert.match(files.handlers, /evidence_records/);
  assert.doesNotMatch(files.handlers, /mailto:|sendEmail|gmail\.send|automatic outreach/i);
});

test("source runtime migration is workspace scoped and anonymous access is denied", () => {
  for (const table of ["opportunity_search_runs", "opportunity_match_candidates"]) {
    assert.match(files.migration, new RegExp(`create table if not exists public\.${table}`));
    assert.match(files.migration, new RegExp(`alter table public\.${table} enable row level security`));
  }
  assert.match(files.migration, /revoke all on public\.opportunity_search_runs, public\.opportunity_match_candidates from anon/);
  assert.match(files.migration, /private\.is_workspace_member/);
  assert.match(files.migration, /private\.can_manage_workspace/);
  assert.match(files.migration, /No row authorizes an automatic merge/);
});

test("scoring and identity review remain explainable", () => {
  assert.match(files.page, /Follower count alone never determines quality/);
  assert.match(files.page, /Identity and duplicate resolution/);
  assert.match(files.page, /Feature-level fit scoring/);
  assert.match(files.handlers, /raw_payload/);
  assert.match(files.handlers, /stable_external_id_exact/);
  assert.match(files.handlers, /raw_record: \{ source_slug:/);
  assert.match(files.handlers, /canonical_url_exact/);
  assert.match(files.handlers, /normalized_name_exact/);
});
