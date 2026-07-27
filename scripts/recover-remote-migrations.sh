#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-myrtdfyjoxvtubusrrmf}"
MANIFEST="supabase/REMOTE_MIGRATION_MANIFEST.json"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install it, then rerun this script." >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the replay phase." >&2
  exit 2
fi

echo "This workflow is read-only against the linked production project."
echo "It fetches remote migration history, verifies source files, then replays locally."

echo "Linking Supabase project ${PROJECT_REF}..."
supabase link --project-ref "${PROJECT_REF}"

echo "Fetching remote migration history..."
supabase migration fetch --linked

echo "Verifying fetched files against the reviewed manifest..."
node scripts/check-remote-migration-manifest.mjs "${MANIFEST}"

echo "Starting isolated local Supabase..."
supabase start
cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Replaying every migration from a clean database..."
supabase db reset --local

echo "Running workspace-isolation assertions..."
if [[ -f tests/rls/workspace-isolation.sql ]]; then
  if supabase db query --help >/dev/null 2>&1; then
    supabase db query --local --file tests/rls/workspace-isolation.sql
  else
    echo "Supabase CLI does not expose db query; run the RLS SQL through psql or the SQL editor." >&2
    exit 2
  fi
fi

echo "Running database advisors..."
supabase db advisors --local

echo "Recovery and clean local replay succeeded. No production migration was applied."
