import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

const obsoleteBranches = /agent\/artistos-canonical-integration|agent\/artistos-public-links|claude-major-rebuild/;

test("repository hygiene blocks future credential files and high-confidence secrets", () => {
  assert.equal(fs.existsSync(".gitignore"), true);
  assert.equal(fs.existsSync(".env.example"), true);
  const ci = read(".github/workflows/ci.yml");
  const hygiene = read("scripts/check-secret-hygiene.mjs");
  assert.match(ci, /check-secret-hygiene\.mjs/);
  assert.match(hygiene, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(hygiene, /PRIVATE KEY/);
  assert.match(hygiene, /only browser-safe NEXT_PUBLIC_/);
});

test("migration filenames and reviewed manifest exactly follow the live Supabase ledger", () => {
  const expected = [
    "20260729172057_restore_authenticated_workspace_onboarding.sql",
    "20260730180631_share_artist_platform_profiles_with_workspace.sql",
    "20260730204030_external_artist_identities_and_provider_credentials.sql",
    "20260802111802_allow_spotontrack_provider.sql",
  ];
  expected.forEach((name) => assert.equal(fs.existsSync(`supabase/migrations/${name}`), true));
  const obsolete = [
    "20260729165000_restore_authenticated_workspace_onboarding.sql",
    "20260730180500_share_artist_platform_profiles_with_workspace.sql",
    "20260730202500_external_artist_identities_and_provider_credentials.sql",
    "20260802110000_allow_spotontrack_provider.sql",
  ];
  obsolete.forEach((name) => assert.equal(fs.existsSync(`supabase/migrations/${name}`), false));
  const manifest = read("supabase/REMOTE_MIGRATION_MANIFEST.json");
  expected.forEach((name) => assert.match(manifest, new RegExp(name.slice(0, 14))));
  const gate = read("scripts/check-remote-migration-manifest.mjs");
  assert.match(gate, /item\.version > latestReviewedVersion/);
  assert.match(gate, /UNREVIEWED INTERLEAVED MIGRATIONS/);
  assert.doesNotMatch(gate, /\+ pending\.length/);
});

test("canonical verification workflows run against main and no stale deploy workflow remains", () => {
  const replay = read(".github/workflows/database-replay.yml");
  const publicLinks = read(".github/workflows/public-links-verification.yml");
  assert.match(replay, /pull_request:/);
  assert.match(replay, /branches: \[main\]/);
  assert.match(publicLinks, /pull_request:/);
  assert.match(publicLinks, /branches: \[main\]/);
  assert.doesNotMatch(replay, obsoleteBranches);
  assert.doesNotMatch(publicLinks, obsoleteBranches);
  assert.equal(fs.existsSync(".github/workflows/publish-session-d.yml"), false);
  assert.equal(fs.existsSync(".github/workflows/release-readiness-report.yml"), false);
});

test("public-link verification proves anonymous access and private-route isolation", () => {
  const journey = read("scripts/run-public-links-e2e.mjs");
  assert.match(journey, /private_route_guard/);
  assert.match(journey, /\/dashboard/);
  assert.match(journey, /\/login/);
  assert.match(journey, /public_release_page/);
  assert.match(journey, /destination_click/);
  assert.match(journey, /explicit_fan_consent/);
});

test("production parity is a read-only exact-SHA gate for the canonical Vercel project", () => {
  const workflow = read(".github/workflows/production-parity.yml");
  const script = read("scripts/check-production-deployment-parity.mjs");
  assert.match(workflow, /prj_7fmrmgPO4z3hWiC2qX4vxZVoXYBe/);
  assert.match(workflow, /expected_sha/);
  assert.match(script, /target: "production"/);
  assert.match(script, /actualSha === expectedSha/);
  assert.doesNotMatch(script, /POST|PATCH|DELETE/);
});
