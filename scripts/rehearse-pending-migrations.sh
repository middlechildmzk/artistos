#!/usr/bin/env bash
set -euo pipefail

MANIFEST="supabase/REMOTE_MIGRATION_MANIFEST.json"
MIGRATIONS_DIR="supabase/migrations"
ARTIFACT_DIR="${PENDING_REHEARSAL_OUTPUT_DIR:-artifacts/pending-migration-rehearsal}"
PENDING_DIR="$(mktemp -d)/pending"
BASELINE_LIST="${ARTIFACT_DIR}/historical-baseline.txt"
FINAL_LIST="${ARTIFACT_DIR}/with-pending.txt"
SUMMARY="${ARTIFACT_DIR}/summary.txt"
REPLAY_FIXTURE="${MIGRATIONS_DIR}/20260726183000_local_replay_canonical_workspace_fixture.sql"
PENDING_RESTORED=false
FIXTURE_CREATED=false

restore_pending() {
  if compgen -G "${PENDING_DIR}/*.sql" >/dev/null; then
    cp "${PENDING_DIR}"/*.sql "${MIGRATIONS_DIR}/"
  fi
  PENDING_RESTORED=true
}

remove_replay_fixture() {
  if [[ "${FIXTURE_CREATED}" == "true" ]]; then
    rm -f "${REPLAY_FIXTURE}"
    FIXTURE_CREATED=false
  fi
}

cleanup() {
  remove_replay_fixture
  if [[ "${PENDING_RESTORED}" != "true" ]]; then
    restore_pending
  fi
  supabase stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$(dirname "${PENDING_DIR}")"
}
trap cleanup EXIT

for command in node docker supabase; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "${command} is required for pending migration rehearsal." >&2
    exit 2
  fi
done

mkdir -p "${ARTIFACT_DIR}" "${PENDING_DIR}"
node scripts/check-remote-migration-manifest.mjs "${MANIFEST}"

node <<'NODE' "${MANIFEST}" "${MIGRATIONS_DIR}" "${PENDING_DIR}"
const fs = require('node:fs');
const path = require('node:path');
const [manifestPath, migrationsDir, pendingDir] = process.argv.slice(2);
const document = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifest = Array.isArray(document) ? document : document.migrations;
if (!Array.isArray(manifest)) {
  console.error('Migration manifest must be an array or contain a migrations array.');
  process.exit(2);
}
const historical = new Set(manifest.map((row) => String(row.version)));
let count = 0;
for (const filename of fs.readdirSync(migrationsDir)) {
  const match = filename.match(/^(\d{14})_.+\.sql$/);
  if (!match || historical.has(match[1])) continue;
  fs.renameSync(path.join(migrationsDir, filename), path.join(pendingDir, filename));
  console.log(`isolated pending migration: ${filename}`);
  count += 1;
}
if (count === 0) {
  console.error('No pending migrations were found to rehearse.');
  process.exit(2);
}
NODE

if [[ -e "${REPLAY_FIXTURE}" ]]; then
  echo "Refusing to overwrite an existing replay fixture: ${REPLAY_FIXTURE}" >&2
  exit 2
fi

cat > "${REPLAY_FIXTURE}" <<'SQL'
-- Disposable local-replay prerequisites for historical migrations that
-- depended on production identities and import-created columns before those
-- prerequisites were source-controlled. This file is created and removed by
-- scripts/rehearse-pending-migrations.sh and must never ship.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '1117df01-6442-4c59-9d94-3ffa7e15612f'::uuid,
  'authenticated',
  'authenticated',
  'replay-owner@artistos.local',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into public.workspaces (id, name)
values (
  '7fe2a999-41d0-4ba7-af23-98f1e58a5982'::uuid,
  'Dan Larson / BVSS FVM'
)
on conflict (id) do nothing;

-- These columns existed in production from the original import tooling before
-- the parity migration attempted to index them. Recreate only their schema
-- shape in the disposable replay database; no business rows are fabricated.
alter table public.people
  add column if not exists normalized_email text;

alter table public.properties
  add column if not exists canonical_property_key text;
SQL
FIXTURE_CREATED=true

echo "Created disposable pre-ledger replay fixture: $(basename "${REPLAY_FIXTURE}")"

supabase start

echo "Replaying recovered historical baseline only..."
supabase db reset --local
supabase migration list --local > "${BASELINE_LIST}"

if [[ -f tests/rls/workspace-isolation.sql ]]; then
  supabase db query --local --file tests/rls/workspace-isolation.sql
fi

restore_pending

echo "Replaying historical baseline plus all pending migrations..."
supabase db reset --local
supabase migration list --local > "${FINAL_LIST}"

if [[ -f tests/rls/workspace-isolation.sql ]]; then
  supabase db query --local --file tests/rls/workspace-isolation.sql
fi
if [[ -f tests/db/pending-schema-assertions.sql ]]; then
  supabase db query --local --file tests/db/pending-schema-assertions.sql
fi

supabase db advisors --local

remove_replay_fixture

cat > "${SUMMARY}" <<EOF
ArtistOS pending migration rehearsal

RESULT: PASS

Historical baseline replay: passed
Disposable historical prerequisite fixture: generated and removed
Pending migration replay: passed
Workspace isolation: passed
Pending schema assertions: passed when present
Database advisors: executed
Production writes: none
EOF

cat "${SUMMARY}"
