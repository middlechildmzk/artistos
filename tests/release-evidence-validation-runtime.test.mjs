import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const validator = path.resolve('scripts/validate-release-evidence.mjs');
const producer = fs.readFileSync('scripts/run-authenticated-e2e.mjs', 'utf8');
const manifest = fs.readFileSync('supabase/REMOTE_MIGRATION_MANIFEST.json');
const manifestDigest = crypto.createHash('sha256').update(manifest).digest('hex');

function writeJson(root, relativePath, value) {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture({ legacyE2E = false, omitApproval = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artistos-release-evidence-'));
  fs.mkdirSync(path.join(root, 'supabase'), { recursive: true });
  fs.writeFileSync(path.join(root, 'supabase/REMOTE_MIGRATION_MANIFEST.json'), manifest);

  writeJson(root, 'artifacts/authenticated-e2e/summary.json', legacyE2E
    ? {
        status: 'PASS',
        summary: 'Legacy shape that must not satisfy the release contract.',
        completed_at: '2026-07-28T20:00:00.000Z',
        checks: [{ name: 'owner_login', status: 'PASS' }],
      }
    : {
        status: 'PASS',
        summary: 'Authenticated journeys passed.',
        run_id: '30390000000',
        base_url: 'http://127.0.0.1:3000',
        completed_at: '2026-07-28T20:00:00.000Z',
        journeys: [
          { id: 'owner_release_workflow', status: 'PASS' },
          { id: 'viewer_read_only', status: 'PASS' },
          { id: 'second_workspace_isolation', status: 'PASS' },
        ],
      });

  writeJson(root, 'artifacts/brain-reconciliation/summary.json', {
    status: 'PASS',
    summary: 'Current nested Brain reconciliation shape.',
    verified_at_utc: '2026-07-28T19:03:33.301844Z',
    source: { rows: 0 },
    reconciliation: {
      mapped_rows: 0,
      exception_rows: 0,
      duplicate_rows: 0,
      confidence_promotions: 0,
    },
  });

  if (!omitApproval) {
    writeJson(root, 'artifacts/production-rollout/approval.json', {
      status: 'PASS',
      summary: 'Fixture approval.',
      git_sha: 'fixture-commit',
      migration_manifest_sha256: manifestDigest,
      approved_by: 'fixture-reviewer',
      approved_at: '2026-07-28T20:01:00.000Z',
      rollback_owner: 'fixture-operator',
    });
  }

  return root;
}

function validate(root, stage) {
  return spawnSync(process.execPath, [validator], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RELEASE_EVIDENCE_ROOT: root,
      RELEASE_GIT_SHA: 'fixture-commit',
      ...(stage ? { RELEASE_EVIDENCE_STAGE: stage } : {}),
    },
  });
}

test('authenticated E2E producer emits the executable release-evidence contract', () => {
  assert.match(producer, /run_id:/);
  assert.match(producer, /base_url:/);
  assert.match(producer, /journeys,/);
  assert.doesNotMatch(producer, /const checks = \[\]/);
});

test('release validator accepts authenticated journeys and the current nested Brain report', () => {
  const root = createFixture();
  try {
    const result = validate(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /contracts are valid/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release validator rejects the legacy checks-only E2E shape', () => {
  const root = createFixture({ legacyE2E: true });
  try {
    const result = validate(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /run_id must be a non-empty string/);
    assert.match(result.stderr, /journeys must contain executed authenticated journeys/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('preapproval validation checks E2E and Brain without fabricating human approval', () => {
  const root = createFixture({ omitApproval: true });
  try {
    const result = validate(root, 'preapproval');
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
