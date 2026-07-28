#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.env.RELEASE_EVIDENCE_ROOT || process.cwd();
const errors = [];
const requireProductionApproval = process.env.RELEASE_EVIDENCE_STAGE !== 'preapproval';

function readJson(relativePath, required = true) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    if (required) errors.push(`${relativePath}: missing`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function requireString(object, key, file) {
  if (!object || typeof object[key] !== 'string' || object[key].trim() === '') {
    errors.push(`${file}: ${key} must be a non-empty string`);
  }
}

function requirePass(object, file) {
  if (!object || String(object.status || object.result).toLowerCase() !== 'pass') {
    errors.push(`${file}: status must be pass`);
  }
}

function requireIsoDate(object, key, file) {
  requireString(object, key, file);
  if (object && object[key] && Number.isNaN(Date.parse(object[key]))) {
    errors.push(`${file}: ${key} must be an ISO-compatible timestamp`);
  }
}

const e2eFile = 'artifacts/authenticated-e2e/summary.json';
const e2e = readJson(e2eFile);
if (e2e) {
  requirePass(e2e, e2eFile);
  requireString(e2e, 'run_id', e2eFile);
  requireString(e2e, 'base_url', e2eFile);
  requireString(e2e, 'source_commit', e2eFile);
  requireIsoDate(e2e, 'completed_at', e2eFile);
  if (e2e.production_mutated !== false) errors.push(`${e2eFile}: production_mutated must equal false`);
  const expectedE2ESha = process.env.RELEASE_GIT_SHA || process.env.GITHUB_SHA;
  if (expectedE2ESha && e2e.source_commit !== expectedE2ESha) errors.push(`${e2eFile}: source_commit does not match the release commit`);
  if (!Array.isArray(e2e.journeys) || e2e.journeys.length === 0) {
    errors.push(`${e2eFile}: journeys must contain executed authenticated journeys`);
  } else {
    const passedJourneyIds = new Set();
    for (const [index, journey] of e2e.journeys.entries()) {
      requireString(journey, 'id', `${e2eFile} journey ${index}`);
      if (String(journey.status).toLowerCase() !== 'pass') {
        errors.push(`${e2eFile}: journey ${journey.id || index} did not pass`);
      } else if (typeof journey.id === 'string') {
        passedJourneyIds.add(journey.id);
      }
    }
    const requiredJourneyIds = [
      'owner_login_and_workspace_provisioning',
      'owner_release_creation',
      'capability_task_execution',
      'artist_brain_memory',
      'ai_manager_request',
      'protected_workspaces_render',
      'viewer_read_only',
      'second_workspace_isolation',
      'durable_control_plane',
    ];
    for (const journeyId of requiredJourneyIds) {
      if (!passedJourneyIds.has(journeyId)) errors.push(`${e2eFile}: required journey ${journeyId} is missing or did not pass`);
    }
  }
}

const brainFile = 'artifacts/brain-reconciliation/summary.json';
const brain = readJson(brainFile);
if (brain) {
  requirePass(brain, brainFile);
  const completedAt = brain.completed_at ?? brain.verified_at_utc;
  if (typeof completedAt !== 'string' || completedAt.trim() === '' || Number.isNaN(Date.parse(completedAt))) {
    errors.push(`${brainFile}: completed_at or verified_at_utc must be an ISO-compatible timestamp`);
  }

  const normalized = {
    source_rows: brain.source_rows ?? brain.source?.rows,
    mapped_rows: brain.mapped_rows ?? brain.reconciliation?.mapped_rows,
    exception_rows: brain.exception_rows ?? brain.reconciliation?.exception_rows,
    duplicate_rows: brain.duplicate_rows ?? brain.reconciliation?.duplicate_rows,
    confidence_promotions: brain.confidence_promotions ?? brain.reconciliation?.confidence_promotions,
  };

  for (const [key, value] of Object.entries(normalized)) {
    if (!Number.isInteger(value) || value < 0) errors.push(`${brainFile}: ${key} must be a non-negative integer`);
  }
  if (Number.isInteger(normalized.source_rows) && Number.isInteger(normalized.mapped_rows) && Number.isInteger(normalized.exception_rows)) {
    if (normalized.mapped_rows + normalized.exception_rows !== normalized.source_rows) {
      errors.push(`${brainFile}: mapped_rows + exception_rows must equal source_rows`);
    }
  }
  if (normalized.confidence_promotions !== 0) errors.push(`${brainFile}: confidence_promotions must equal zero`);
  if (normalized.duplicate_rows !== 0) errors.push(`${brainFile}: duplicate_rows must equal zero`);
}

const approvalFile = 'artifacts/production-rollout/approval.json';
const approval = readJson(approvalFile, requireProductionApproval);
if (approval) {
  requirePass(approval, approvalFile);
  for (const key of ['git_sha', 'migration_manifest_sha256', 'approved_by', 'rollback_owner']) requireString(approval, key, approvalFile);
  requireIsoDate(approval, 'approved_at', approvalFile);
  const expectedSha = process.env.RELEASE_GIT_SHA || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  if (expectedSha && approval.git_sha !== expectedSha) errors.push(`${approvalFile}: git_sha does not match the release commit`);
  const manifestPath = path.join(root, 'supabase/REMOTE_MIGRATION_MANIFEST.json');
  if (fs.existsSync(manifestPath)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
    if (approval.migration_manifest_sha256 !== actual) errors.push(`${approvalFile}: migration manifest digest does not match`);
  }
}

if (errors.length > 0) {
  console.error('ArtistOS release evidence validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('ArtistOS release evidence contracts are valid.');
