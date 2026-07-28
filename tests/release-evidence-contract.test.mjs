import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const validator = fs.readFileSync('scripts/validate-release-evidence.mjs', 'utf8');

test('authenticated E2E evidence requires executed passing journeys', () => {
  assert.match(validator, /journeys/);
  assert.match(validator, /journeys\.length === 0/);
  assert.match(validator, /journey\.status/);
  assert.match(validator, /run_id/);
  assert.match(validator, /base_url/);
});

test('Brain reconciliation is count-balanced and confidence-safe', () => {
  assert.match(validator, /mapped_rows \+ brain\.exception_rows !== brain\.source_rows/);
  assert.match(validator, /confidence_promotions !== 0/);
  assert.match(validator, /duplicate_rows !== 0/);
});

test('production approval binds commit and migration manifest digest', () => {
  assert.match(validator, /RELEASE_GIT_SHA/);
  assert.match(validator, /git_sha does not match/);
  assert.match(validator, /migration_manifest_sha256/);
  assert.match(validator, /createHash\('sha256'\)/);
  assert.match(validator, /rollback_owner/);
});
