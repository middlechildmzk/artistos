#!/usr/bin/env bash
set -euo pipefail

MODE="${ARTISTOS_READINESS_MODE:-static}"
OUTPUT_DIR="${RELEASE_READINESS_OUTPUT_DIR:-artifacts/release-readiness}"
RUN_RECOVERY="${ARTISTOS_RUN_RECOVERY:-0}"
RUN_REHEARSAL="${ARTISTOS_RUN_PENDING_REHEARSAL:-0}"
RUN_E2E_ENV_CHECK="${ARTISTOS_RUN_E2E_ENV_CHECK:-1}"

usage() {
  cat <<'EOF'
Usage: bash scripts/artistos-release-readiness.sh [--static|--full-local]

Modes:
  --static      Run source, safety, manifest, type, test, and build checks only.
  --full-local  Also run historical recovery and pending migration rehearsal.

Environment:
  ARTISTOS_RUN_RECOVERY=1             Explicitly enable historical recovery.
  ARTISTOS_RUN_PENDING_REHEARSAL=1    Explicitly enable pending rehearsal.
  ARTISTOS_RUN_E2E_ENV_CHECK=0        Skip authenticated E2E environment validation.
  RELEASE_READINESS_OUTPUT_DIR=...    Override evidence output directory.

This command never applies production migrations and never authorizes deployment.
EOF
}

for argument in "$@"; do
  case "${argument}" in
    --static) MODE="static" ;;
    --full-local)
      MODE="full-local"
      RUN_RECOVERY=1
      RUN_REHEARSAL=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: ${argument}" >&2
      usage >&2
      exit 2
      ;;
  esac
done

mkdir -p "${OUTPUT_DIR}"
EVENTS="${OUTPUT_DIR}/events.ndjson"
: > "${EVENTS}"

record() {
  local gate="$1"
  local status="$2"
  local detail="$3"
  node -e 'const [gate,status,detail]=process.argv.slice(1); console.log(JSON.stringify({at:new Date().toISOString(),gate,status,detail}))' "${gate}" "${status}" "${detail}" >> "${EVENTS}"
}

run_gate() {
  local gate="$1"
  shift
  echo
  echo "=== ${gate} ==="
  if "$@"; then
    record "${gate}" "pass" "Command completed successfully."
  else
    local exit_code=$?
    record "${gate}" "fail" "Command exited with ${exit_code}."
    return "${exit_code}"
  fi
}

record "orchestrator" "start" "Mode: ${MODE}"

run_gate "migration_manifest" node scripts/check-remote-migration-manifest.mjs supabase/REMOTE_MIGRATION_MANIFEST.json
run_gate "architecture_tests" npm test
run_gate "typecheck" npm run typecheck
run_gate "production_build" npm run build

if [[ "${RUN_E2E_ENV_CHECK}" == "1" ]]; then
  if node scripts/check-e2e-environment.mjs; then
    record "e2e_environment" "pass" "Authenticated E2E environment is complete."
  else
    record "e2e_environment" "blocked" "Authenticated E2E credentials or fixture values are incomplete."
  fi
fi

if [[ "${RUN_RECOVERY}" == "1" ]]; then
  run_gate "historical_recovery" bash scripts/recover-remote-migrations.sh
else
  record "historical_recovery" "blocked" "Not executed. Use --full-local in an authenticated environment."
fi

if [[ "${RUN_REHEARSAL}" == "1" ]]; then
  run_gate "pending_rehearsal" bash scripts/rehearse-pending-migrations.sh
else
  record "pending_rehearsal" "blocked" "Not executed. Use --full-local after historical recovery."
fi

node scripts/generate-release-readiness-report.mjs
record "orchestrator" "complete" "Readiness report generated."

echo
cat "${OUTPUT_DIR}/report.md"
