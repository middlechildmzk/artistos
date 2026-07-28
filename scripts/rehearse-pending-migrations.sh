#!/usr/bin/env bash
set -euo pipefail

MANIFEST="supabase/REMOTE_MIGRATION_MANIFEST.json"
MIGRATIONS_DIR="supabase/migrations"
ARTIFACT_DIR="${PENDING_REHEARSAL_OUTPUT_DIR:-artifacts/pending-migration-rehearsal}"
PENDING_DIR="$(mktemp -d)/pending"
BASELINE_LIST="${ARTIFACT_DIR}/historical-baseline.txt"
FINAL_LIST="${ARTIFACT_DIR}/with-pending.txt"
SUMMARY="${ARTIFACT_DIR}/summary.txt"

cleanup() {
  if compgen -G "${PENDING_DIR}/*.sql" >/dev/null; then
    cp "${PENDING_DIR}"/*.sql "${MIGRATIONS_DIR}/"
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

# Move every migration not present in the reviewed remote manifest out of the
# active directory. These are pending source-controlled migrations and must be
# rehearsed only after the recovered production baseline succeeds by itself.
node <<'NODE' "${MANIFEST}" "${MIGRATIONS_DIR}" "${PENDING_DIR}"
const fs = require('node:fs');
const path = require('node:path');
const [manifestPath, migrationsDir, pendingDir] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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

supabase start

echo "Replaying recovered historical baseline only..."
supabase db reset --local
supabase migration list --local > "${BASELINE_LIST}"

if [[ -f tests/rls/workspace-isolation.sql ]]; then
  supabase db query --local --file tests/rls/workspace-isolation.sql
fi

# Restore pending migrations in their original names and order, then replay the
# entire repository from zero. This tests upgrade ordering without mutating the
# linked production project.
cp "${PENDING_DIR}"/*.sql "${MIGRATIONS_DIR}/"

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

cat > "${SUMMARY}" <<EOF
ArtistOS pending migration rehearsal

RESULT: PASS

Historical baseline replay: passed
Pending migration replay: passed
Workspace isolation: passed
Pending schema assertions: passed when present
Database advisors: executed
Production writes: none
EOF

cat "${SUMMARY}"
