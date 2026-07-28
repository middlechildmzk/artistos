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

FIXTURE_PATH="supabase/migrations/20260714110000_local_preledger_fixture.sql"
PENDING_DIR="$(mktemp -d)"

restore_pending() {
  shopt -s nullglob
  for migration in "${PENDING_DIR}"/*.sql; do
    mv "${migration}" supabase/migrations/
  done
  shopt -u nullglob
}

cleanup() {
  restore_pending
  rm -rf "${PENDING_DIR}"
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
-- Models verified state that existed before the tracked migration ledger became
-- complete. Column order is preserved because the schema fingerprint includes
-- PostgreSQL attribute positions.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
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

insert into storage.buckets (id, name, public)
values ('app', 'app', false)
on conflict (id) do nothing;

alter table public.import_batches
  add column if not exists imported_count integer,
  add column if not exists completed_at timestamptz,
  add column if not exists error_message text;

alter table public.people
  add column if not exists normalized_email text,
  add column if not exists contact_type text,
  add column if not exists recommended_segment text,
  add column if not exists consent_status text,
  add column if not exists first_seen text,
  add column if not exists source_category text,
  add column if not exists source_count integer,
  add column if not exists source_files text,
  add column if not exists source_sheets text,
  add column if not exists titles_tracks_playlists text,
  add column if not exists genres text,
  add column if not exists links text,
  add column if not exists engagement_source_notes text,
  add column if not exists relationship_signal text,
  add column if not exists relationship_strength text,
  add column if not exists last_known_interaction text,
  add column if not exists gmail_evidence text,
  add column if not exists source_file text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists source_record_hash text,
  add column if not exists raw_record jsonb,
  add column if not exists imported_at timestamptz default now();

alter table public.properties
  add column if not exists platform_url text,
  add column if not exists spotify_playlist_id text,
  add column if not exists owner_or_operator text,
  add column if not exists genres text,
  add column if not exists followers_legacy text,
  add column if not exists contact_emails text,
  add column if not exists source text,
  add column if not exists source_file text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists original_source_sheet text,
  add column if not exists original_source_row text,
  add column if not exists canonical_property_key text,
  add column if not exists source_record_hash text,
  add column if not exists raw_record jsonb,
  add column if not exists imported_at timestamptz default now();

create unique index if not exists properties_spotify_playlist_id_unique
  on public.properties (spotify_playlist_id)
  where spotify_playlist_id is not null and spotify_playlist_id <> '';
SQL

echo "Starting isolated local Supabase..."
supabase start

LAST_HISTORICAL="$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('supabase/REMOTE_MIGRATION_MANIFEST.json','utf8'));const rows=Array.isArray(d)?d:d.migrations;if(!Array.isArray(rows)||!rows.length)process.exit(2);process.stdout.write(String(rows.at(-1).version));")"

echo "Separating migrations newer than reviewed production history ${LAST_HISTORICAL}..."
shopt -s nullglob
for migration in supabase/migrations/*.sql; do
  filename="$(basename "${migration}")"
  version="${filename%%_*}"
  if [[ "${version}" =~ ^[0-9]{14}$ ]] && [[ "${version}" > "${LAST_HISTORICAL}" ]]; then
    mv "${migration}" "${PENDING_DIR}/"
  fi
done
shopt -u nullglob

echo "Replaying reviewed historical production schema..."
supabase db reset --local --yes
DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{gsub(/"/, "", $2); print $2}')"
if [[ -z "${DB_URL}" ]]; then
  echo "Could not resolve the local database URL." >&2
  exit 1
fi

psql "${DB_URL}" -X -v ON_ERROR_STOP=1 -f scripts/production-schema-reconciliation.sql
mkdir -p artifacts/schema-drift
psql "${DB_URL}" -X -tA -v ON_ERROR_STOP=1 -f scripts/application-schema-fingerprint.sql \
  > artifacts/schema-drift/local-historical-fingerprint.json
psql "${DB_URL}" -X -tA -v ON_ERROR_STOP=1 -f scripts/application-schema-inventory.sql \
  > artifacts/schema-drift/local-historical-inventory.json
node scripts/compare-schema-fingerprints.mjs \
  artifacts/schema-drift/production-fingerprint.json \
  artifacts/schema-drift/local-historical-fingerprint.json \
  artifacts/schema-drift

restore_pending

echo "Replaying every tracked historical and pending migration from a clean database..."
supabase db reset --local --yes
psql "${DB_URL}" -X -v ON_ERROR_STOP=1 -f scripts/production-schema-reconciliation.sql
rm -f "${FIXTURE_PATH}"

echo "Running workspace-isolation and RLS assertions..."
psql "${DB_URL}" -X -v ON_ERROR_STOP=1 -f tests/rls/workspace-isolation.sql

echo "Running database advisors..."
supabase db advisors --local

echo "Historical drift, full migration replay, RLS, and advisor verification passed."
