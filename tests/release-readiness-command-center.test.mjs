import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const orchestrator = fs.readFileSync('scripts/artistos-release-readiness.sh', 'utf8');
const reporter = fs.readFileSync('scripts/generate-release-readiness-report.mjs', 'utf8');

test('release readiness orchestration is non-mutating by construction', () => {
  for (const forbidden of [
    /supabase\s+db\s+push/i,
    /supabase\s+migration\s+repair/i,
    /supabase\s+db\s+reset\s+--linked/i,
    /supabase\s+db\s+reset\s+--db-url/i,
    /vercel\s+--prod/i,
  ]) {
    assert.doesNotMatch(orchestrator, forbidden);
  }
});

test('full local readiness is explicit rather than automatic', () => {
  assert.match(orchestrator, /--full-local/);
  assert.match(orchestrator, /ARTISTOS_RUN_RECOVERY/);
  assert.match(orchestrator, /ARTISTOS_RUN_PENDING_REHEARSAL/);
  assert.match(orchestrator, /recover-remote-migrations\.sh/);
  assert.match(orchestrator, /rehearse-pending-migrations\.sh/);
});

test('report requires all production gates and never authorizes mutation', () => {
  for (const gate of [
    'historical_sql',
    'historical_replay',
    'pending_rehearsal',
    'authenticated_e2e',
    'brain_reconciliation',
    'production_approval',
  ]) {
    assert.match(reporter, new RegExp(gate));
  }
  assert.match(reporter, /production_mutation_authorized:\s*false/);
  assert.match(reporter, /NO_GO/);
  assert.match(reporter, /BLOCKED/);
  assert.match(reporter, /GO/);
});

test('evidence receives cryptographic digests', () => {
  assert.match(reporter, /sha256/);
  assert.match(reporter, /createHash\('sha256'\)/);
});
