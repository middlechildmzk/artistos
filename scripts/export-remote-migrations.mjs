#!/usr/bin/env node

/**
 * Export the applied Supabase migration ledger into exact source files.
 *
 * Required environment:
 *   SUPABASE_DB_URL=postgresql://...
 *
 * Required executable:
 *   psql
 *
 * Safety:
 * - Performs one SELECT query only.
 * - Never repairs or mutates migration history.
 * - Preserves local pending migrations not present in the remote ledger.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const migrationsDir = path.resolve("supabase/migrations");
const manifestPath = path.resolve("supabase/REMOTE_MIGRATION_MANIFEST.json");
const filenamePattern = /^(\d{14})_(.+)\.sql$/;

function normalizeSql(sql) {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hash(sql) {
  return createHash("sha256").update(normalizeSql(sql), "utf8").digest("hex");
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required. Do not hardcode production credentials.");
  process.exit(2);
}

try {
  execFileSync("psql", ["--version"], { stdio: "ignore" });
} catch {
  console.error("psql is required to export the remote migration ledger.");
  process.exit(2);
}

await mkdir(migrationsDir, { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestByVersion = new Map(manifest.map((row) => [String(row.version), row]));

const existing = await readdir(migrationsDir);
const pendingFiles = [];
for (const filename of existing.filter((name) => name.endsWith(".sql"))) {
  const match = filename.match(filenamePattern);
  if (!match) continue;
  if (!manifestByVersion.has(match[1])) {
    pendingFiles.push({
      filename,
      content: await readFile(path.join(migrationsDir, filename), "utf8"),
    });
  }
}

const query = `
  select coalesce(
    json_agg(
      json_build_object(
        'version', version,
        'name', name,
        'statements', statements
      ) order by version
    ),
    '[]'::json
  )::text
  from supabase_migrations.schema_migrations;
`;

let rows;
try {
  const output = execFileSync(
    "psql",
    [connectionString, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  ).trim();
  rows = JSON.parse(output || "[]");
} catch (error) {
  console.error(`Failed to read migration ledger: ${error.message}`);
  process.exit(2);
}

if (rows.length !== manifest.length) {
  console.error(`Ledger count mismatch: database=${rows.length}, manifest=${manifest.length}`);
  process.exit(1);
}

for (const row of rows) {
  const version = String(row.version);
  const expected = manifestByVersion.get(version);
  if (!expected) {
    console.error(`Remote ledger contains unreviewed migration ${version}_${row.name}`);
    process.exit(1);
  }
  if (expected.name !== row.name) {
    console.error(`Name mismatch for ${version}: ledger=${row.name}, manifest=${expected.name}`);
    process.exit(1);
  }

  const sql = Array.isArray(row.statements) ? row.statements.join("\n") : String(row.statements ?? "");
  const normalizedHash = hash(sql);
  if (normalizedHash !== expected.normalized_sha256) {
    console.error(`Hash mismatch for ${version}_${row.name}`);
    process.exit(1);
  }

  const filename = `${version}_${row.name}.sql`;
  await writeFile(path.join(migrationsDir, filename), sql.endsWith("\n") ? sql : `${sql}\n`, "utf8");
  console.log(`exported ${filename}`);
}

for (const pending of pendingFiles) {
  await writeFile(path.join(migrationsDir, pending.filename), pending.content, "utf8");
  console.log(`preserved pending ${pending.filename}`);
}

console.log(`Exported and verified ${rows.length} historical migrations.`);
console.log(`Preserved ${pendingFiles.length} pending migration(s).`);
