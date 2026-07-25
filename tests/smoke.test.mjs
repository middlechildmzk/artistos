import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('materialized readable source has required operating routes', () => {
  for (const file of ['app/(app)/page.tsx','app/(app)/[section]/page.tsx','app/api/gmail/draft/route.ts','app/api/oauth/[provider]/callback/route.ts','lib/data.ts']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});

test('Gmail draft route checks suppressions before the Gmail request', () => {
  const source = read('app/api/gmail/draft/route.ts');
  assert.ok(source.indexOf("from('suppressions')") < source.indexOf('gmail.googleapis.com'));
  assert.match(source, /toLowerCase\(\).*=== to/);
  assert.match(source, /Draft creation was blocked/);
});

test('sending requires explicit SEND confirmation', () => {
  assert.match(read('app/api/gmail/send/route.ts'), /confirmation !== 'SEND'/);
});

test('no service-role secret is referenced by browser source', () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  });
  walk(path.join(root, 'app')); walk(path.join(root, 'components')); walk(path.join(root, 'lib'));
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /SUPABASE_SERVICE_ROLE|service_role/i, file);
});

test('migration is additive and protects OAuth rows with owner RLS', () => {
  const sql = read('supabase/migrations/20260724190000_artistos_integrations.sql').toLowerCase();
  assert.doesNotMatch(sql, /drop table|truncate|delete from/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\).*user_id/s);
});

test('relationship stage writes are server-whitelisted', () => {
  const source = read('lib/actions.ts');
  assert.match(source, /RELATIONSHIP_STAGES/);
  assert.match(source, /Unsupported relationship stage/);
});

test('magic-link origin is derived server-side', () => {
  const source = read('lib/actions.ts');
  assert.match(source, /requestOrigin\(await headers\(\)\)/);
  assert.doesNotMatch(source, /value\(formData, 'origin'\)/);
});
