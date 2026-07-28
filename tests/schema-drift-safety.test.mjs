import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile('scripts/verify-schema-drift.sh', 'utf8');

test('schema drift verification is read-only against linked production', () => {
  assert.match(script, /supabase db diff --linked/);
  assert.doesNotMatch(script, /supabase db push/);
  assert.doesNotMatch(script, /supabase db reset --linked/);
  assert.doesNotMatch(script, /migration repair/);
});

test('pending migrations are excluded and restored around historical diff', () => {
  assert.match(script, /REMOTE_MIGRATION_MANIFEST\.json/);
  assert.match(script, /Temporarily excluded pending migration/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /cp "\$\{PENDING_DIR\}"\/\*\.sql "\$\{MIGRATIONS_DIR\}\/"/);
});

test('unexplained historical drift blocks progression', () => {
  assert.match(script, /UNEXPLAINED HISTORICAL DRIFT DETECTED/);
  assert.match(script, /exit 1/);
});
