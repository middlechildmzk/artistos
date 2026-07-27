#!/usr/bin/env node
/**
 * Compares supabase/migrations/*.sql against a checked-in snapshot of
 * supabase_migrations.schema_migrations and fails while they diverge.
 *
 * Usage:
 *   node scripts/check-migration-reconciliation.mjs --ledger REMOTE_MIGRATION_HISTORY.json
 *   node scripts/check-migration-reconciliation.mjs --live
 *   node scripts/check-migration-reconciliation.mjs --live --emit REMOTE_MIGRATION_HISTORY.json
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const MIGRATIONS_DIR = "supabase/migrations";
const FILENAME_RE = /^(\d{14})_(.+)\.sql$/;
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

function normalizeSql(sql) {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

async function readLocalMigrations() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch {
    console.error(`FAIL: ${MIGRATIONS_DIR} does not exist.`);
    process.exit(2);
  }

  const local = [];
  const malformed = [];
  for (const name of entries.filter((entry) => entry.endsWith(".sql"))) {
    const match = name.match(FILENAME_RE);
    if (!match) {
      malformed.push(name);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
    local.push({
      version: match[1],
      name: match[2],
      file: name,
      hash: sha256(normalizeSql(sql)),
    });
  }

  return {
    local: local.sort((a, b) => a.version.localeCompare(b.version)),
    malformed,
  };
}

async function readLedgerFromFile(filePath) {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8"));
    return raw
      .map((row) => ({
        version: String(row.version),
        name: row.name ?? "",
        hash: row.statements
          ? sha256(normalizeSql(Array.isArray(row.statements) ? row.statements.join("\n") : String(row.statements)))
          : null,
      }))
      .sort((a, b) => a.version.localeCompare(b.version));
  } catch (error) {
    console.error(`FAIL: could not read ledger snapshot ${filePath}: ${error.message}`);
    process.exit(2);
  }
}

async function readLedgerLive() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("FAIL: --live requires SUPABASE_DB_URL. Never hardcode it.");
    process.exit(2);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error('FAIL: --live requires the "pg" package. Prefer --ledger in CI.');
    process.exit(2);
  }

  const client = new pg.default.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select version, name, statements from supabase_migrations.schema_migrations order by version",
    );
    return rows.map((row) => ({
      version: String(row.version),
      name: row.name ?? "",
      hash: row.statements
        ? sha256(normalizeSql(Array.isArray(row.statements) ? row.statements.join("\n") : String(row.statements)))
        : null,
    }));
  } finally {
    await client.end();
  }
}

function report(local, ledger, malformed) {
  const localByVersion = new Map(local.map((migration) => [migration.version, migration]));
  const ledgerByVersion = new Map(ledger.map((migration) => [migration.version, migration]));
  const missingFiles = ledger.filter((migration) => !localByVersion.has(migration.version));
  const unapplied = local.filter((migration) => !ledgerByVersion.has(migration.version));
  const nameMismatch = [];
  const hashMismatch = [];

  for (const migration of local) {
    const remote = ledgerByVersion.get(migration.version);
    if (!remote) continue;
    if (remote.name && remote.name !== migration.name) {
      nameMismatch.push({ version: migration.version, file: migration.name, ledger: remote.name });
    }
    if (remote.hash && migration.hash !== remote.hash) {
      hashMismatch.push({ version: migration.version, name: migration.name });
    }
  }

  const line = "─".repeat(68);
  console.log(line);
  console.log("ArtistOS migration reconciliation");
  console.log(line);
  console.log(`ledger entries : ${ledger.length}`);
  console.log(`local files    : ${local.length}`);
  console.log(line);

  if (malformed.length) {
    console.log(`\nMALFORMED FILENAMES (${malformed.length})`);
    malformed.forEach((file) => console.log(`  ${file}`));
  }
  if (missingFiles.length) {
    console.log(`\nAPPLIED BUT NOT IN REPOSITORY (${missingFiles.length}) — production blocker`);
    missingFiles.forEach((migration) => console.log(`  ${migration.version}_${migration.name}`));
  }
  if (unapplied.length) {
    console.log(`\nIN REPOSITORY BUT NOT APPLIED (${unapplied.length})`);
    unapplied.forEach((migration) => console.log(`  ${migration.file}`));
  }
  if (nameMismatch.length) {
    console.log(`\nNAME MISMATCH (${nameMismatch.length})`);
    nameMismatch.forEach((migration) =>
      console.log(`  ${migration.version}: file="${migration.file}" ledger="${migration.ledger}"`),
    );
  }
  if (hashMismatch.length) {
    console.log(`\nCONTENT MISMATCH (${hashMismatch.length})`);
    hashMismatch.forEach((migration) => console.log(`  ${migration.version}_${migration.name}`));
  }

  const blocking = missingFiles.length + nameMismatch.length + hashMismatch.length + malformed.length;
  console.log(`\n${line}`);
  if (blocking === 0 && unapplied.length === 0) {
    console.log("RECONCILED. Repository and ledger agree.");
    return 0;
  }
  if (blocking === 0) {
    console.log(`PENDING ONLY: ${unapplied.length} unapplied migration(s), no historical divergence.`);
    return has("--allow-pending") ? 0 : 1;
  }
  console.log(`DIVERGENT: ${blocking} blocking issue(s). Clean replay cannot be trusted.`);
  return 1;
}

const { local, malformed } = await readLocalMigrations();

if (has("--emit")) {
  const ledger = await readLedgerLive();
  const target = valueOf("--emit") ?? "REMOTE_MIGRATION_HISTORY.json";
  await writeFile(target, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`Wrote ${ledger.length} ledger entries to ${target}. Review this diff.`);
  process.exit(0);
}

const ledger = has("--live")
  ? await readLedgerLive()
  : await readLedgerFromFile(valueOf("--ledger") ?? "REMOTE_MIGRATION_HISTORY.json");

process.exit(report(local, ledger, malformed));
