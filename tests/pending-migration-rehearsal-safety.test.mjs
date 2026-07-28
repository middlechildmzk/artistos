import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = await readFile('scripts/rehearse-pending-migrations.sh', 'utf8');
const assertions = await readFile('tests/db/pending-schema-assertions.sql', 'utf8');

test('pending migration rehearsal remains local-only', () => {
  assert.match(script, /supabase db reset --local/);
  assert.doesNotMatch(script, /supabase\s+db\s+push/);
  assert.doesNotMatch(script, /supabase\s+migration\s+repair/);
  assert.doesNotMatch(script, /supabase\s+db\s+reset\s+--linked/);
  assert.doesNotMatch(script, /apply_migration/i);
});

test('historical baseline is replayed before pending migrations', () => {
  const isolate = script.indexOf('isolated pending migration');
  const baseline = script.indexOf('Replaying recovered historical baseline only');
  const restore = script.lastIndexOf('\nrestore_pending\n');
  const pending = script.indexOf('Replaying historical baseline plus all pending migrations');

  assert.ok(isolate >= 0, 'pending migrations must be isolated');
  assert.ok(baseline > isolate, 'historical replay must follow pending isolation');
  assert.ok(restore > baseline, 'pending files must be restored only after baseline replay');
  assert.ok(pending > restore, 'full replay must follow pending restoration');
});

test('cleanup restores pending files even after failure', () => {
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /restore_pending/);
  assert.match(script, /cp "\$\{PENDING_DIR\}"\/\*\.sql "\$\{MIGRATIONS_DIR\}\/"/);
});

test('schema assertions cover runtime, evidence, Brain, graph, and RLS', () => {
  for (const table of [
    'capability_idempotency',
    'capability_audit_log',
    'capability_approvals',
    'evidence_records',
    'brain_memories',
    'brain_claims',
    'knowledge_entities',
    'opportunity_searches',
    'opportunities',
  ]) {
    assert.match(assertions, new RegExp(table));
  }
  assert.match(assertions, /relrowsecurity/);
  assert.match(assertions, /review_status/);
  assert.match(assertions, /contradiction_state/);
});
