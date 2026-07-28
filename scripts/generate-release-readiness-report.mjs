#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outputDir = process.env.RELEASE_READINESS_OUTPUT_DIR || 'artifacts/release-readiness';
const absoluteOutput = path.join(root, outputDir);
fs.mkdirSync(absoluteOutput, { recursive: true });

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
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const migrationDir = path.join(root, 'supabase/migrations');
      const files = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir) : [];
      const missing = manifest.filter((entry) => !files.some((file) => file.startsWith(`${entry.version}_`) && file.endsWith('.sql')));
      return missing.length === 0
        ? { status: 'pass', detail: `${manifest.length} historical migrations are present.` }
        : { status: 'blocked', detail: `${missing.length} historical migrations are still missing.`, missing: missing.map((row) => row.version) };
    },
  },
  {
    id: 'historical_replay',
    title: 'Historical recovery and replay',
    required: true,
    files: ['artifacts/schema-drift/summary.txt'],
    successPattern: /NO LINKED SCHEMA DRIFT DETECTED/i,
  },
  {
    id: 'pending_rehearsal',
    title: 'Pending migration rehearsal',
    required: true,
    files: ['artifacts/pending-migration-rehearsal/summary.txt'],
    successPattern: /RESULT:\s*PASS/i,
  },
  {
    id: 'authenticated_e2e',
    title: 'Authenticated end-to-end verification',
    required: true,
    files: ['artifacts/authenticated-e2e/summary.json'],
    jsonStatus: true,
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

function digest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

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
    detail = `Evidence exists but does not contain the required success marker.`;
  }
  return { ...definition, status, detail, evidence: found, sha256: digest(absolute) };
}

const gates = definitions.map(evaluate);
const failed = gates.filter((gate) => gate.required && gate.status === 'fail');
const blocked = gates.filter((gate) => gate.required && gate.status === 'blocked');
const overall = failed.length > 0 ? 'NO_GO' : blocked.length > 0 ? 'BLOCKED' : 'GO';
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  git_sha: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
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
const lines = [
  '# ArtistOS release readiness',
  '',
  `**Decision: ${overall}**`,
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
