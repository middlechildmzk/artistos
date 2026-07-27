#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${SCHEMA_DRIFT_OUTPUT_DIR:-artifacts/schema-drift}"
DIFF_FILE="${OUTPUT_DIR}/linked-schema-diff.sql"
SUMMARY_FILE="${OUTPUT_DIR}/summary.txt"
MANIFEST="supabase/REMOTE_MIGRATION_MANIFEST.json"
MIGRATIONS_DIR="supabase/migrations"
TEMP_ROOT="$(mktemp -d)"
PENDING_DIR="${TEMP_ROOT}/pending"

cleanup() {
  if compgen -G "${PENDING_DIR}/*.sql" >/dev/null; then
    cp "${PENDING_DIR}"/*.sql "${MIGRATIONS_DIR}/"
  fi
  rm -rf "${TEMP_ROOT}"
}
trap cleanup EXIT

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required." >&2
  exit 2
fi

mkdir -p "${OUTPUT_DIR}" "${PENDING_DIR}"

cat > "${SUMMARY_FILE}" <<'EOF'
ArtistOS linked schema drift verification

Comparison boundary:
- linked production schema
- recovered 28-file historical migration baseline only
- pending runtime, evidence, Brain, and graph migrations are temporarily excluded

Safety:
- no migration history repair
- no production database write
EOF

# Move local migrations that are not present in the reviewed production manifest
# out of the diff input. They are restored by the EXIT trap even if diff fails.
node <<'NODE' "${MANIFEST}" "${MIGRATIONS_DIR}" "${PENDING_DIR}"
const fs = require('node:fs');
const path = require('node:path');
const [manifestPath, migrationsDir, pendingDir] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const applied = new Set(manifest.map((row) => String(row.version)));
for (const file of fs.readdirSync(migrationsDir)) {
  const match = file.match(/^(\d{14})_.+\.sql$/);
  if (!match || applied.has(match[1])) continue;
  fs.renameSync(path.join(migrationsDir, file), path.join(pendingDir, file));
  console.log(`Temporarily excluded pending migration: ${file}`);
}
NODE

echo "Generating linked schema diff against recovered historical baseline..."
supabase db diff --linked --schema public,storage > "${DIFF_FILE}"

SIGNIFICANT_CONTENT="$(sed -E '/^[[:space:]]*--/d; /^[[:space:]]*$/d' "${DIFF_FILE}")"

if [[ -n "${SIGNIFICANT_CONTENT}" ]]; then
  {
    echo
    echo "RESULT: UNEXPLAINED HISTORICAL DRIFT DETECTED"
    echo "Review ${DIFF_FILE}. Do not repair migration history or deploy pending migrations."
  } | tee -a "${SUMMARY_FILE}" >&2
  exit 1
fi

{
  echo
  echo "RESULT: NO LINKED HISTORICAL SCHEMA DRIFT DETECTED"
} | tee -a "${SUMMARY_FILE}"
