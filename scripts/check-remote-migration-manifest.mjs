#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const migrationsDir = "supabase/migrations";
const manifestPath = process.argv[2] ?? "supabase/REMOTE_MIGRATION_MANIFEST.json";
const filenamePattern = /^(\d{14})_(.+)\.sql$/;
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.migrations)) {
  console.error(`FAIL: ${manifestPath} must contain a migrations array.`);
  process.exit(2);
}

const entries = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql"));
const localByVersion = new Map();
const malformed = [];

for (const filename of entries) {
  const match = filename.match(filenamePattern);
  if (!match) {
    malformed.push(filename);
    continue;
  }
  const sql = await readFile(path.join(migrationsDir, filename), "utf8");
  localByVersion.set(match[1], {
    version: match[1],
    name: match[2],
    filename,
    sha256: sha256(sql),
    sqlChars: sql.length,
  });
}

const missing = [];
const nameMismatch = [];
const hashMismatch = [];
const sizeMismatch = [];

for (const expected of manifest.migrations) {
  const local = localByVersion.get(String(expected.version));
  if (!local) {
    missing.push(expected);
    continue;
  }
  if (local.name !== expected.name) nameMismatch.push({ expected, local });
  if (expected.sha256 && local.sha256 !== expected.sha256) hashMismatch.push({ expected, local });
  if (Number.isInteger(expected.sql_chars) && local.sqlChars !== expected.sql_chars) sizeMismatch.push({ expected, local });
}

const expectedVersions = new Set(manifest.migrations.map((item) => String(item.version)));
const pending = [...localByVersion.values()].filter((item) => !expectedVersions.has(item.version));
const line = "─".repeat(72);

console.log(line);
console.log("ArtistOS remote migration manifest gate");
console.log(line);
console.log(`manifest history : ${manifest.migrations.length}`);
console.log(`local migrations : ${localByVersion.size}`);
console.log(`pending migrations: ${pending.length}`);

if (malformed.length) {
  console.log(`\nMALFORMED FILENAMES (${malformed.length})`);
  malformed.forEach((filename) => console.log(`  ${filename}`));
}
if (missing.length) {
  console.log(`\nHISTORICAL FILES MISSING (${missing.length})`);
  missing.forEach((item) => console.log(`  ${item.version}_${item.name}.sql`));
}
if (nameMismatch.length) {
  console.log(`\nNAME MISMATCH (${nameMismatch.length})`);
  nameMismatch.forEach(({ expected, local }) => console.log(`  ${expected.version}: expected ${expected.name}, found ${local.name}`));
}
if (hashMismatch.length) {
  console.log(`\nBYTE HASH MISMATCH (${hashMismatch.length})`);
  hashMismatch.forEach(({ expected, local }) => console.log(`  ${expected.version}_${local.name}.sql`));
}
if (sizeMismatch.length) {
  console.log(`\nBYTE LENGTH MISMATCH (${sizeMismatch.length})`);
  sizeMismatch.forEach(({ expected, local }) => console.log(`  ${expected.version}: expected ${expected.sql_chars}, found ${local.sqlChars}`));
}
if (pending.length) {
  console.log(`\nSOURCE-CONTROLLED PENDING MIGRATIONS (${pending.length})`);
  pending.forEach((item) => console.log(`  ${item.filename}`));
}

const blocking = malformed.length + missing.length + nameMismatch.length + hashMismatch.length + sizeMismatch.length;
console.log(`\n${line}`);
if (blocking) {
  console.error(`DIVERGENT: ${blocking} historical reconciliation issue(s).`);
  process.exit(1);
}

console.log("HISTORICAL LEDGER RECONCILED. Pending migrations are reported separately.");
process.exit(0);
