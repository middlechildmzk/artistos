#!/usr/bin/env node
// Build supabase/CROSS_REPO_MIGRATION_MANIFEST.json from:
//   1. a live ledger capture (JSON array produced by
//      scripts/sql/live-migration-ledger-canonical.sql), and
//   2. checkouts of every repository that owns migrations in artistos-core.
//
// Every live entry must resolve to exactly one source file by canonical SQL
// hash. Nothing is guessed: an unmatched live entry, an unmatched source file
// or a migration that references an object only created later fails the build.
//
// Usage:
//   node scripts/build-cross-repo-migration-manifest.mjs \
//     --ledger /path/to/ledger.json \
//     --repo artistos=. \
//     --repo middle-child-experience=../middle-child-experience \
//     --captured-at 2026-09-29T21:00:00Z
//
// Read-only with respect to every database. Writes only the manifest file.

import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { MIGRATION_FILENAME, canonicalHash, deriveDependencies } from "./lib/migration-canon.mjs";

const MANIFEST_PATH = "supabase/CROSS_REPO_MIGRATION_MANIFEST.json";
const REPOSITORIES = {
  artistos: { github: "middlechildmzk/artistos", migrations_dir: "supabase/migrations" },
  "middle-child-experience": { github: "middlechildmzk/middle-child-experience", migrations_dir: "supabase/migrations" },
};

function parseArgs(argv) {
  const args = { repos: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--ledger") { args.ledger = value; i += 1; }
    else if (flag === "--captured-at") { args.capturedAt = value; i += 1; }
    else if (flag === "--repo") {
      const [name, dir] = value.split("=");
      args.repos[name] = dir;
      i += 1;
    } else throw new Error(`Unknown argument ${flag}`);
  }
  if (!args.ledger || !args.capturedAt) throw new Error("--ledger and --captured-at are required");
  for (const name of Object.keys(REPOSITORIES)) {
    if (!args.repos[name]) throw new Error(`--repo ${name}=<dir> is required`);
  }
  return args;
}

function headCommit(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function loadSources(repos) {
  const byHash = new Map();
  const all = [];
  for (const [repo, dir] of Object.entries(repos)) {
    const migrationsDir = path.join(dir, REPOSITORIES[repo].migrations_dir);
    for (const filename of (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort()) {
      const match = filename.match(MIGRATION_FILENAME);
      if (!match) throw new Error(`Malformed migration filename ${repo}:${filename}`);
      const sql = await readFile(path.join(migrationsDir, filename), "utf8");
      const hash = canonicalHash(sql);
      const source = {
        repo,
        filename,
        source_version: match[1],
        name: match[2],
        repository_path: `${REPOSITORIES[repo].migrations_dir}/${filename}`,
        sql,
        ...hash,
      };
      if (byHash.has(hash.sha256)) {
        const other = byHash.get(hash.sha256);
        throw new Error(`Duplicate canonical SQL: ${other.repo}:${other.filename} and ${repo}:${filename}`);
      }
      byHash.set(hash.sha256, source);
      all.push(source);
    }
  }
  return { byHash, all };
}

const args = parseArgs(process.argv.slice(2));
const ledger = JSON.parse(await readFile(args.ledger, "utf8"))
  .map((row) => ({ ...row, version: String(row.version) }))
  .sort((a, b) => a.version.localeCompare(b.version));
const { byHash, all } = await loadSources(args.repos);

let existingPending = [];
let existingPrerequisites = [];
let existingFingerprint = null;
try {
  const existing = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  existingPending = existing.pending ?? [];
  existingPrerequisites = existing.replay_prerequisites ?? [];
  existingFingerprint = existing.production_fingerprint ?? null;
} catch {
  existingPending = [];
}

const problems = [];
const used = new Set();
const applied = ledger.map((row, index) => {
  const source = byHash.get(row.canonical_sha256);
  if (!source) {
    problems.push(`live ${row.version}_${row.name}: no source file has canonical hash ${row.canonical_sha256}`);
    return null;
  }
  if (source.name !== row.name) problems.push(`live ${row.version}: name ${row.name} but source file is ${source.filename}`);
  used.add(`${source.repo}:${source.filename}`);
  const alias = source.source_version !== row.version
    ? {
        source_version: source.source_version,
        production_version: row.version,
        reason: "Same name and canonically identical SQL; applied to production under a different version timestamp. Applied history is never renamed.",
      }
    : null;
  return {
    replay_order: index + 1,
    production_version: row.version,
    name: row.name,
    canonical_filename: `${row.version}_${row.name}.sql`,
    owning_repository: source.repo,
    repository_path: source.repository_path,
    timestamp_alias: alias,
    live_canonical_sha256: row.canonical_sha256,
    live_canonical_chars: Number(row.canonical_chars),
    depends_on: [],
    _sql: source.sql,
  };
});

const pendingKeys = new Set(existingPending.map((p) => `${p.owning_repository}:${path.basename(p.repository_path)}`));
for (const source of all) {
  const key = `${source.repo}:${source.filename}`;
  if (!used.has(key) && !pendingKeys.has(key)) problems.push(`source ${key} is neither live nor declared pending`);
}

if (!problems.length) {
  const deps = deriveDependencies(applied.map((entry) => ({ key: entry.production_version, sql: entry._sql })));
  for (const entry of applied) {
    const derived = deps.get(entry.production_version);
    entry.depends_on = derived.depends_on;
    for (const fwd of derived.forward_references) {
      problems.push(`live ${entry.production_version} references ${fwd.object}, first created later by ${fwd.created_by}`);
    }
  }
}

if (problems.length) {
  console.error(problems.map((p) => `FAIL: ${p}`).join("\n"));
  process.exit(1);
}

const repoOf = new Map(applied.map((entry) => [entry.production_version, entry.owning_repository]));
const manifest = {
  schema_version: 1,
  project_ref: "myrtdfyjoxvtubusrrmf",
  project_name: "artistos-core",
  captured_at: args.capturedAt,
  source_commits: Object.fromEntries(Object.entries(args.repos).map(([repo, dir]) => [repo, headCommit(dir)])),
  repositories: REPOSITORIES,
  canonicalization: {
    description: "Strip /* */ and -- comments, remove all semicolons, collapse whitespace, trim. SHA-256 of the UTF-8 result.",
    live_capture_sql: "scripts/sql/live-migration-ledger-canonical.sql",
    source_implementation: "scripts/lib/migration-canon.mjs",
  },
  replay_rule: [
    "Replay applied migrations in ascending replay_order, which is ascending production_version across all repositories.",
    "Write each file under canonical_filename (the production version), not the repository filename, so a replayed ledger matches production exactly.",
    "depends_on is a statically derived lower bound used to prove no migration references an object created later; it does not override replay_order.",
    "Pending migrations are replayed after all applied migrations, in ascending proposed_version, only when their tranche is authorized.",
  ],
  replay_prerequisites: existingPrerequisites,
  production_fingerprint: existingFingerprint,
  applied: applied.map(({ _sql, ...entry }) => ({
    ...entry,
    cross_repo_depends_on: entry.depends_on.filter((v) => repoOf.get(v) !== entry.owning_repository),
  })),
  pending: existingPending,
};

await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
if (existingFingerprint) {
  console.warn("NOTE: production_fingerprint was carried over. Recapture it with scripts/sql/replay-parity-fingerprint.sql whenever the ledger changes.");
}
console.log(`Wrote ${MANIFEST_PATH}: ${manifest.applied.length} applied, ${manifest.pending.length} pending.`);
