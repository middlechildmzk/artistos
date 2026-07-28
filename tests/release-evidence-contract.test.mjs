import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const validator = fs.readFileSync('scripts/validate-release-evidence.mjs', 'utf8');
const reportGenerator = fs.readFileSync('scripts/generate-release-readiness-report.mjs', 'utf8');

test('database replay evidence is complete and release-source bound', () => {
  assert.match(validator, /local-db-replay\.json/);
  assert.match(validator, /historical_schema_drift_checked/);
  assert.match(validator, /workspace_rls_checked/);
  assert.match(validator, /requireReleaseSource\(replay/);
  assert.match(reportGenerator, /Database replay evidence is stale for the selected release source/);
});

test('authenticated E2E evidence requires executed passing journeys', () => {
  assert.match(validator, /journeys/);
  assert.match(validator, /journeys\.length === 0/);
  assert.match(validator, /journey\.status/);
  assert.match(validator, /run_id/);
  assert.match(validator, /base_url/);
  assert.match(validator, /requireReleaseSource\(e2e/);
  assert.match(validator, /requiredJourneyIds/);
  assert.match(reportGenerator, /Authenticated E2E evidence is stale for the selected release source/);
});

test('Brain reconciliation is count-balanced and confidence-safe', () => {
  assert.match(validator, /normalized\.mapped_rows \+ normalized\.exception_rows !== normalized\.source_rows/);
  assert.match(validator, /normalized\.confidence_promotions !== 0/);
  assert.match(validator, /normalized\.duplicate_rows !== 0/);
});

test('production approval binds commit and migration manifest digest', () => {
  assert.match(validator, /RELEASE_GIT_SHA/);
  assert.match(validator, /git_sha does not match/);
  assert.match(validator, /migration_manifest_sha256/);
  assert.match(validator, /createHash\('sha256'\)/);
  assert.match(validator, /rollback_owner/);
});
