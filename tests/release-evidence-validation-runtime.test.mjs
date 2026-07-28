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

function createFixture({ legacyE2E = false, omitApproval = false, replayCommit = 'fixture-commit' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artistos-release-evidence-'));
  fs.mkdirSync(path.join(root, 'supabase'), { recursive: true });
  fs.writeFileSync(path.join(root, 'supabase/REMOTE_MIGRATION_MANIFEST.json'), manifest);

  writeJson(root, 'artifacts/release-readiness/local-db-replay.json', {
    schema_version: 1,
    result: 'PASS',
    source_commit: replayCommit,
    workflow_run_id: '30389999999',
    supabase_cli_version: '2.84.2',
    historical_schema_drift_checked: true,
    workspace_rls_checked: true,
    production_mutated: false,
    completed_at: '2026-07-28T19:59:00.000Z',
  });

  writeJson(root, 'artifacts/authenticated-e2e/summary.json', legacyE2E
    ? {
        status: 'PASS',
        summary: 'Legacy shape that must not satisfy the release contract.',
        source_commit: 'fixture-commit',
        completed_at: '2026-07-28T20:00:00.000Z',
        production_mutated: false,
        checks: [{ name: 'owner_login', status: 'PASS' }],
      }
    : {
        status: 'PASS',
        summary: 'Authenticated journeys passed.',
        run_id: '30390000000',
        base_url: 'http://127.0.0.1:3000',
        source_commit: 'fixture-commit',
        completed_at: '2026-07-28T20:00:00.000Z',
        production_mutated: false,
        journeys: [
          { id: 'owner_login_and_workspace_provisioning', status: 'PASS' },
          { id: 'owner_release_creation', status: 'PASS' },
          { id: 'capability_task_execution', status: 'PASS' },
          { id: 'artist_brain_memory', status: 'PASS' },
          { id: 'ai_manager_request', status: 'PASS' },
          { id: 'protected_workspaces_render', status: 'PASS' },
          { id: 'viewer_read_only', status: 'PASS' },
          { id: 'second_workspace_isolation', status: 'PASS' },
          { id: 'durable_control_plane', status: 'PASS' },
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

test('release validator accepts source-bound database, authenticated journeys, and the current Brain report', () => {
  const root = createFixture();
  try {
    const result = validate(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /contracts are valid/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release validator rejects a database replay receipt from another source commit', () => {
  const root = createFixture({ replayCommit: 'stale-database-commit' });
  try {
    const result = validate(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /local-db-replay\.json: source_commit does not match the release commit/);
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

test('preapproval validation checks replay, E2E, and Brain without fabricating human approval', () => {
  const root = createFixture({ omitApproval: true });
  try {
    const result = validate(root, 'preapproval');
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release validator rejects incomplete critical journey evidence', () => {
  const root = createFixture();
  try {
    const summaryPath = path.join(root, 'artifacts/authenticated-e2e/summary.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    summary.journeys = summary.journeys.filter((journey) => journey.id !== 'durable_control_plane');
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    const result = validate(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required journey durable_control_plane is missing or did not pass/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
