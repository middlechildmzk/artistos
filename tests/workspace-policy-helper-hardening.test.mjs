import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260728202000_harden_workspace_policy_helpers.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const privilegeRegression = fs.readFileSync('tests/rls/security-definer-privileges.sql', 'utf8');

test('workspace policy helpers move out of the exposed public schema', () => {
  assert.match(migration, /alter function public\.artistos_is_workspace_member\(uuid\) set schema private/i);
  assert.match(migration, /alter function public\.artistos_can_manage_workspace\(uuid\) set schema private/i);
  assert.match(migration, /to_regprocedure\('public\.artistos_is_workspace_member\(uuid\)'\)/i);
  assert.match(migration, /to_regprocedure\('public\.artistos_can_manage_workspace\(uuid\)'\)/i);
});

test('anonymous execution is explicitly revoked and asserted', () => {
  assert.match(migration, /revoke all on schema private from anon/i);
  assert.match(migration, /revoke all on function private\.artistos_is_workspace_member\(uuid\) from anon/i);
  assert.match(migration, /revoke all on function private\.artistos_can_manage_workspace\(uuid\) from anon/i);
  assert.match(migration, /has_function_privilege\('anon'/i);
  assert.match(privilegeRegression, /anon must not execute private\.artistos_is_workspace_member/i);
  assert.match(privilegeRegression, /anon must not execute private\.artistos_can_manage_workspace/i);
});

test('authenticated RLS evaluation retains only the required private access', () => {
  assert.match(migration, /grant usage on schema private to authenticated, service_role/i);
  assert.match(migration, /grant execute on function private\.artistos_is_workspace_member\(uuid\) to authenticated, service_role/i);
  assert.match(migration, /grant execute on function private\.artistos_can_manage_workspace\(uuid\) to authenticated, service_role/i);
  assert.match(migration, /authenticated RLS evaluation cannot execute workspace policy helpers/i);
});
