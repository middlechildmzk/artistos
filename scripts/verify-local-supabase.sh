#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install it, then rerun npm run db:verify-local." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the local Supabase stack." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "The PostgreSQL psql client is required for RLS assertions." >&2
  exit 1
fi

FIXTURE_PATH="supabase/migrations/20260726000000_local_replay_fixture.sql"

cleanup() {
  rm -f "${FIXTURE_PATH}"
  if [[ "${KEEP_SUPABASE_RUNNING:-0}" != "1" ]]; then
    supabase stop --no-backup >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Checking Supabase CLI and Docker..."
supabase --version
supabase --help >/dev/null
docker version >/dev/null
psql --version

if [[ ! -f supabase/config.toml ]]; then
  echo "Initializing disposable local Supabase configuration..."
  supabase init --force
fi

if [[ -e "${FIXTURE_PATH}" ]]; then
  echo "Reserved local replay fixture path already exists: ${FIXTURE_PATH}" >&2
  exit 1
fi

cat > "${FIXTURE_PATH}" <<'SQL'
-- Local replay fixture only. Never commit or apply to production.
-- Historical migration 20260726184029 expects the canonical production
-- workspace and its owner identity to exist before tenancy backfill begins.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '1117df01-6442-4c59-9d94-3ffa7e15612f'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'local-replay-owner@artistos.invalid',
  crypt('local-replay-only', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.workspaces (name)
select 'Dan Larson / BVSS FVM'
where not exists (
  select 1 from public.workspaces where name = 'Dan Larson / BVSS FVM'
);
SQL

echo "Starting isolated local Supabase..."
supabase start

echo "Replaying every tracked migration from a clean database..."
supabase db reset --local --yes
rm -f "${FIXTURE_PATH}"

echo "Running workspace-isolation and RLS assertions..."
DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{gsub(/"/, "", $2); print $2}')"
if [[ -z "${DB_URL}" ]]; then
  echo "Could not resolve the local database URL." >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f tests/rls/workspace-isolation.sql

echo "Running database advisors..."
supabase db advisors --local

echo "Local migration replay and RLS verification passed."
