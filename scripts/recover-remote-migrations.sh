#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-myrtdfyjoxvtubusrrmf}"
MANIFEST="supabase/REMOTE_MIGRATION_MANIFEST.json"
MIGRATIONS_DIR="supabase/migrations"
BACKUP_DIR="$(mktemp -d)/pending-migrations"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the replay phase." >&2
  exit 2
fi

mkdir -p "${BACKUP_DIR}"

# Preserve source-controlled migrations that are newer than the remote ledger.
node <<'NODE' "${MANIFEST}" "${MIGRATIONS_DIR}" "${BACKUP_DIR}"
const fs = require('node:fs');
const path = require('node:path');
const [manifestPath, migrationsDir, backupDir] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const applied = new Set(manifest.map((row) => String(row.version)));
for (const file of fs.readdirSync(migrationsDir)) {
  const match = file.match(/^(\d{14})_.+\.sql$/);
  if (!match || applied.has(match[1])) continue;
  fs.copyFileSync(path.join(migrationsDir, file), path.join(backupDir, file));
  console.log(`Preserved pending migration: ${file}`);
}
NODE

echo "This workflow is read-only against the linked production project."
echo "It reconstructs applied migration history, verifies it, then replays locally."

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "Exporting historical migrations directly from schema_migrations..."
  node scripts/export-remote-migrations.mjs
else
  if ! command -v supabase >/dev/null 2>&1; then
    echo "Supabase CLI is required when SUPABASE_DB_URL is not set." >&2
    exit 2
  fi
  echo "Linking Supabase project ${PROJECT_REF}..."
  supabase link --project-ref "${PROJECT_REF}"
  echo "Fetching remote migration history through the Supabase CLI..."
  supabase migration fetch --linked
fi

echo "Restoring preserved pending migrations..."
if compgen -G "${BACKUP_DIR}/*.sql" >/dev/null; then
  cp "${BACKUP_DIR}"/*.sql "${MIGRATIONS_DIR}/"
fi

echo "Verifying recovered files against the reviewed manifest..."
node scripts/check-remote-migration-manifest.mjs "${MANIFEST}"

if command -v supabase >/dev/null 2>&1; then
  echo "Listing local and remote migration status..."
  supabase link --project-ref "${PROJECT_REF}"
  supabase migration list --linked
else
  echo "Supabase CLI unavailable; skipping linked migration list." >&2
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required for local replay." >&2
  exit 2
fi

echo "Starting isolated local Supabase..."
supabase start
cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$(dirname "${BACKUP_DIR}")"
}
trap cleanup EXIT

echo "Replaying every migration from a clean local database..."
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

echo "Verifying linked production schema against the recovered historical baseline..."
bash scripts/verify-schema-drift.sh

echo "Recovery, clean local replay, workspace isolation, advisors, and linked historical drift verification succeeded."
echo "No production migration or migration-history repair was applied."
