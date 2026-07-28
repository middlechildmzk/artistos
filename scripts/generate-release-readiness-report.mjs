#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outputDir = process.env.RELEASE_READINESS_OUTPUT_DIR || 'artifacts/release-readiness';
const absoluteOutput = path.join(root, outputDir);
const expectedReleaseSha = process.env.RELEASE_GIT_SHA || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null;
fs.mkdirSync(absoluteOutput, { recursive: true });

function readJson(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return null;
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function digest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function evidenceResult(relativePath, validate) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return { status: 'blocked', detail: `Missing evidence: ${relativePath}` };
  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    const failure = validate(parsed);
    return failure
      ? { status: 'fail', detail: failure, evidence: relativePath, sha256: digest(absolute) }
      : {
          status: 'pass',
          detail: parsed.detail || parsed.summary || `Evidence found at ${relativePath}.`,
          evidence: relativePath,
          sha256: digest(absolute),
        };
  } catch (error) {
    return { status: 'fail', detail: `Invalid JSON evidence: ${error.message}`, evidence: relativePath, sha256: digest(absolute) };
  }
}

function replayEvaluation() {
  return evidenceResult('artifacts/release-readiness/local-db-replay.json', (replay) => {
    if (String(replay.result || replay.status || '').toLowerCase() !== 'pass') return 'Database replay evidence is not PASS.';
    if (expectedReleaseSha && replay.source_commit !== expectedReleaseSha) return 'Database replay evidence is stale for the selected release source.';
    if (replay.historical_schema_drift_checked !== true) return 'Historical schema drift was not verified.';
    if (replay.workspace_rls_checked !== true) return 'Workspace RLS was not verified.';
    if (replay.production_mutated !== false) return 'Database replay evidence must confirm production was not mutated.';
    return null;
  });
}

function e2eEvaluation() {
  return evidenceResult('artifacts/authenticated-e2e/summary.json', (e2e) => {
    if (String(e2e.status || e2e.result || '').toLowerCase() !== 'pass') return 'Authenticated E2E evidence is not PASS.';
    if (expectedReleaseSha && e2e.source_commit !== expectedReleaseSha) return 'Authenticated E2E evidence is stale for the selected release source.';
    if (!Array.isArray(e2e.journeys) || e2e.journeys.length === 0) return 'Authenticated E2E evidence does not contain executed journeys.';
    if (e2e.journeys.some((journey) => String(journey.status).toLowerCase() !== 'pass')) return 'At least one authenticated E2E journey did not pass.';
    if (e2e.production_mutated !== false) return 'Authenticated E2E evidence must confirm production was not mutated.';
    return null;
  });
}

function replayPassed() {
  return replayEvaluation().status === 'pass';
}

const definitions = [
  {
    id: 'migration_manifest',
    title: 'Historical migration manifest',
    required: true,
    files: ['supabase/REMOTE_MIGRATION_MANIFEST.json'],
  },
  {
    id: 'historical_sql',
    title: 'Recovered historical SQL files',
    required: true,
    evaluate() {
      const manifestPath = path.join(root, 'supabase/REMOTE_MIGRATION_MANIFEST.json');
      if (!fs.existsSync(manifestPath)) return { status: 'fail', detail: 'Manifest missing.' };
      const document = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const manifest = Array.isArray(document) ? document : document.migrations;
      if (!Array.isArray(manifest)) return { status: 'fail', detail: 'Manifest migrations array is invalid.' };
      const migrationDir = path.join(root, 'supabase/migrations');
      const files = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir) : [];
      const missing = manifest.filter((entry) => !files.some((file) => file === `${entry.version}_${entry.name}.sql`));
      return missing.length === 0
        ? { status: 'pass', detail: `${manifest.length} historical migrations are present with reviewed filenames.` }
        : { status: 'blocked', detail: `${missing.length} historical migrations are still missing.`, missing: missing.map((row) => row.version) };
    },
  },
  {
    id: 'historical_replay',
    title: 'Isolated clean-database replay',
    required: true,
    files: ['artifacts/release-readiness/local-db-replay.json'],
    evaluate: replayEvaluation,
  },
  {
    id: 'linked_schema_drift',
    title: 'Production schema drift review',
    required: true,
    files: ['artifacts/schema-drift/summary.txt'],
    successPattern: /NO LINKED SCHEMA DRIFT DETECTED/i,
  },
  {
    id: 'pending_rehearsal',
    title: 'Pending migration rehearsal',
    required: true,
    evaluate() {
      const summary = path.join(root, 'artifacts/pending-migration-rehearsal/summary.txt');
      if (fs.existsSync(summary)) {
        const raw = fs.readFileSync(summary, 'utf8');
        return /RESULT:\s*PASS/i.test(raw)
          ? { status: 'pass', detail: 'Dedicated pending-migration rehearsal passed.', evidence: 'artifacts/pending-migration-rehearsal/summary.txt', sha256: digest(summary) }
          : { status: 'fail', detail: 'Pending-migration rehearsal evidence does not contain RESULT: PASS.', evidence: 'artifacts/pending-migration-rehearsal/summary.txt', sha256: digest(summary) };
      }
      if (replayPassed()) {
        return { status: 'pass', detail: 'The isolated clean-database replay applied the complete tracked historical and pending migration chain.' };
      }
      return { status: 'blocked', detail: 'Missing successful source-bound isolated replay or dedicated pending-migration rehearsal evidence.' };
    },
  },
  {
    id: 'authenticated_e2e',
    title: 'Authenticated end-to-end verification',
    required: true,
    files: ['artifacts/authenticated-e2e/summary.json'],
    evaluate: e2eEvaluation,
  },
  {
    id: 'brain_reconciliation',
    title: 'Brain v1 to v2 reconciliation',
    required: true,
    files: ['artifacts/brain-reconciliation/summary.json'],
    jsonStatus: true,
  },
  {
    id: 'production_approval',
    title: 'Production rollout approval',
    required: true,
    files: ['artifacts/production-rollout/approval.json'],
    jsonStatus: true,
  },
];

function evaluate(definition) {
  if (definition.evaluate) return { ...definition, ...definition.evaluate() };
  const found = definition.files.find((candidate) => fs.existsSync(path.join(root, candidate)));
  if (!found) return { ...definition, status: 'blocked', detail: `Missing evidence: ${definition.files.join(' or ')}` };
  const absolute = path.join(root, found);
  const raw = fs.readFileSync(absolute, 'utf8');
  let status = 'pass';
  let detail = `Evidence found at ${found}.`;
  if (definition.jsonStatus) {
    try {
      const parsed = JSON.parse(raw);
      status = String(parsed.status || parsed.result || '').toLowerCase() === 'pass' ? 'pass' : 'fail';
      detail = parsed.detail || parsed.summary || detail;
    } catch (error) {
      status = 'fail';
      detail = `Invalid JSON evidence: ${error.message}`;
    }
  } else if (definition.successPattern && !definition.successPattern.test(raw)) {
    status = 'fail';
    detail = 'Evidence exists but does not contain the required success marker.';
  }
  return { ...definition, status, detail, evidence: found, sha256: digest(absolute) };
}

const gates = definitions.map(evaluate);
const failed = gates.filter((gate) => gate.required && gate.status === 'fail');
const blocked = gates.filter((gate) => gate.required && gate.status === 'blocked');
const overall = failed.length > 0 ? 'NO_GO' : blocked.length > 0 ? 'BLOCKED' : 'GO';
const generatedAt = new Date().toISOString();
const report = {
  schema_version: 1,
  generated_at: generatedAt,
  git_sha: expectedReleaseSha,
  overall,
  counts: {
    pass: gates.filter((gate) => gate.status === 'pass').length,
    fail: failed.length,
    blocked: blocked.length,
  },
  gates,
  production_mutation_authorized: false,
};

fs.writeFileSync(path.join(absoluteOutput, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const events = [
  {
    schema_version: 1,
    event_type: 'release_readiness_decision',
    occurred_at: generatedAt,
    git_sha: expectedReleaseSha,
    overall,
    counts: report.counts,
    production_mutation_authorized: false,
  },
  ...gates.map((gate) => ({
    schema_version: 1,
    event_type: 'release_readiness_gate',
    occurred_at: generatedAt,
    git_sha: expectedReleaseSha,
    gate_id: gate.id,
    gate_title: gate.title,
    required: gate.required,
    status: gate.status,
    detail: gate.detail,
    evidence: gate.evidence ?? null,
    evidence_sha256: gate.sha256 ?? null,
    production_mutation_authorized: false,
  })),
];
fs.writeFileSync(path.join(absoluteOutput, 'events.ndjson'), `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);

const lines = [
  '# ArtistOS release readiness',
  '',
  `**Decision: ${overall}**`,
  '',
  `Release source: ${expectedReleaseSha ?? 'unknown'}`,
  '',
  `Generated: ${report.generated_at}`,
  '',
  '| Gate | Status | Evidence |',
  '|---|---:|---|',
  ...gates.map((gate) => `| ${gate.title} | ${gate.status.toUpperCase()} | ${gate.detail.replace(/\|/g, '\\|')} |`),
  '',
  'This report never authorizes production mutation. Production rollout requires separate human approval.',
  '',
];
fs.writeFileSync(path.join(absoluteOutput, 'report.md'), lines.join('\n'));
console.log(lines.join('\n'));
if (overall === 'NO_GO') process.exitCode = 1;
