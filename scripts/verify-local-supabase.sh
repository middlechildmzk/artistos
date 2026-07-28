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

cleanup() {
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

echo "Starting isolated local Supabase..."
supabase start

echo "Replaying every tracked migration from a clean database..."
supabase db reset --local --yes

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
