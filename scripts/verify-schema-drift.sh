#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${SCHEMA_DRIFT_OUTPUT_DIR:-artifacts/schema-drift}"
DIFF_FILE="${OUTPUT_DIR}/linked-schema-diff.sql"
SUMMARY_FILE="${OUTPUT_DIR}/summary.txt"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required." >&2
  exit 2
fi

mkdir -p "${OUTPUT_DIR}"

cat > "${SUMMARY_FILE}" <<'EOF'
ArtistOS linked schema drift verification

Expected result after historical recovery and local replay:
- no unexplained schema drift
- no migration history repair
- no production write
EOF

# db diff is read-only against the linked project. It compares the linked schema
# to the schema represented by source-controlled migrations.
echo "Generating linked schema diff..."
supabase db diff --linked --schema public,storage > "${DIFF_FILE}"

# Remove whitespace and comments before deciding whether the diff is empty.
SIGNIFICANT_CONTENT="$(sed -E '/^[[:space:]]*--/d; /^[[:space:]]*$/d' "${DIFF_FILE}")"

if [[ -n "${SIGNIFICANT_CONTENT}" ]]; then
  {
    echo
    echo "RESULT: UNEXPLAINED DRIFT DETECTED"
    echo "Review ${DIFF_FILE}. Do not repair migration history or deploy pending migrations."
  } | tee -a "${SUMMARY_FILE}" >&2
  exit 1
fi

{
  echo
  echo "RESULT: NO LINKED SCHEMA DRIFT DETECTED"
} | tee -a "${SUMMARY_FILE}"
