import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const exporter = read("scripts/export-remote-migrations.mjs");
const recovery = read("scripts/recover-remote-migrations.sh");
const manifestCheck = read("scripts/check-remote-migration-manifest.mjs");
const workflow = read(".github/workflows/ci.yml");

test("remote exporter is read-only and verifies reviewed hashes", () => {
  assert.match(exporter, /select coalesce\(/i);
  assert.match(exporter, /supabase_migrations\.schema_migrations/);
  assert.match(exporter, /normalized_sha256/);
  assert.match(exporter, /Hash mismatch/);
  assert.doesNotMatch(exporter, /\b(insert|update|delete|alter|drop|truncate)\b[\s\S]*schema_migrations/i);
  assert.doesNotMatch(exporter, /migration repair/i);
});

test("recovery preserves pending migrations and resets only local Supabase", () => {
  assert.match(recovery, /Preserved pending migration/);
  assert.match(recovery, /Restoring preserved pending migrations/);
  assert.match(recovery, /supabase db reset --local/);
  assert.doesNotMatch(recovery, /supabase db reset --linked/);
  assert.doesNotMatch(recovery, /supabase migration repair/);
  assert.doesNotMatch(recovery, /supabase db push/);
});

test("manifest gate blocks historical absence, renames, and content drift", () => {
  assert.match(manifestCheck, /Missing historical migrations/);
  assert.match(manifestCheck, /Name mismatches/);
  assert.match(manifestCheck, /Hash mismatches/);
  assert.match(manifestCheck, /Length mismatches/);
  assert.match(manifestCheck, /process\.exit\(1\)/);
});

test("CI reconciles migration history before installing dependencies", () => {
  const reconcile = workflow.indexOf("Reconcile migration history");
  const install = workflow.indexOf("Install dependencies");
  assert.ok(reconcile >= 0, "reconciliation step missing");
  assert.ok(install >= 0, "install step missing");
  assert.ok(reconcile < install, "reconciliation must run before dependency installation");
});
