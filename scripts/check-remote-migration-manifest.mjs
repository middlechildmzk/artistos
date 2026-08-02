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
if (manifest.project_ref !== "myrtdfyjoxvtubusrrmf") {
  console.error(`FAIL: ${manifestPath} is not bound to the canonical ArtistOS Supabase project.`);
  process.exit(2);
}

const manifestVersions = manifest.migrations.map((item) => String(item.version));
const duplicateManifestVersions = manifestVersions.filter((version, index) => manifestVersions.indexOf(version) !== index);
const entries = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql"));
const localByVersion = new Map();
const malformed = [];
const duplicateLocalVersions = [];

for (const filename of entries) {
  const match = filename.match(filenamePattern);
  if (!match) {
    malformed.push(filename);
    continue;
  }
  const sql = await readFile(path.join(migrationsDir, filename), "utf8");
  if (localByVersion.has(match[1])) duplicateLocalVersions.push(match[1]);
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
  if (!expected.sha256 || local.sha256 !== expected.sha256) hashMismatch.push({ expected, local });
  if (!Number.isInteger(expected.sql_chars) || local.sqlChars !== expected.sql_chars) sizeMismatch.push({ expected, local });
}

const expectedVersions = new Set(manifestVersions);
const pending = [...localByVersion.values()].filter((item) => !expectedVersions.has(item.version));
const line = "─".repeat(72);

console.log(line);
console.log("ArtistOS authoritative migration-manifest gate");
console.log(line);
console.log(`manifest history : ${manifest.migrations.length}`);
console.log(`local migrations : ${localByVersion.size}`);
console.log(`unreconciled local migrations: ${pending.length}`);

const sections = [
  ["MALFORMED FILENAMES", malformed, (item) => item],
  ["DUPLICATE MANIFEST VERSIONS", [...new Set(duplicateManifestVersions)], (item) => item],
  ["DUPLICATE LOCAL VERSIONS", [...new Set(duplicateLocalVersions)], (item) => item],
  ["HISTORICAL FILES MISSING", missing, (item) => `${item.version}_${item.name}.sql`],
  ["NAME MISMATCH", nameMismatch, ({ expected, local }) => `${expected.version}: expected ${expected.name}, found ${local.name}`],
  ["BYTE HASH MISMATCH", hashMismatch, ({ expected, local }) => `${expected.version}_${local.name}.sql`],
  ["BYTE LENGTH MISMATCH", sizeMismatch, ({ expected, local }) => `${expected.version}: expected ${expected.sql_chars}, found ${local.sqlChars}`],
  ["UNRECONCILED LOCAL MIGRATIONS", pending, (item) => item.filename],
];

for (const [title, items, render] of sections) {
  if (!items.length) continue;
  console.log(`\n${title} (${items.length})`);
  items.forEach((item) => console.log(`  ${render(item)}`));
}

const blocking = malformed.length
  + duplicateManifestVersions.length
  + duplicateLocalVersions.length
  + missing.length
  + nameMismatch.length
  + hashMismatch.length
  + sizeMismatch.length
  + pending.length;

console.log(`\n${line}`);
if (blocking) {
  console.error(`DIVERGENT: ${blocking} migration reconciliation issue(s).`);
  process.exit(1);
}

console.log("EXACT PARITY: every source-controlled migration matches the live-ledger manifest.");
