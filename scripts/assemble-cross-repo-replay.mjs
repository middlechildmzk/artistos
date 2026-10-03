#!/usr/bin/env node
// Assemble one ordered migrations directory for a clean-database replay of
// artistos-core from both owning repositories.
//
//   node scripts/assemble-cross-repo-replay.mjs \
//     --repo middle-child-experience=../middle-child-experience \
//     --out /tmp/artistos-core-replay/supabase/migrations [--include-pending]
//
// Files are written under their PRODUCTION version (aliases resolved), so the
// replayed schema_migrations ledger equals production. Never run against a
// shared database; point the Supabase CLI at a disposable local stack.

import { readFile } from "node:fs/promises";
import process from "node:process";
import { assembleReplay } from "./lib/cross-repo-manifest.mjs";

const repoDirs = { artistos: "." };
let outDir;
let includePending = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--repo") { const [n, d] = argv[i + 1].split("="); repoDirs[n] = d; i += 1; }
  else if (argv[i] === "--out") { outDir = argv[i + 1]; i += 1; }
  else if (argv[i] === "--include-pending") includePending = true;
}
if (!outDir) { console.error("--out <dir> is required"); process.exit(2); }

const manifest = JSON.parse(await readFile("supabase/CROSS_REPO_MIGRATION_MANIFEST.json", "utf8"));
const { errors, written } = await assembleReplay(manifest, repoDirs, outDir, { includePending });
if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  process.exit(1);
}
console.log(`Wrote ${written.length} migrations to ${outDir} in replay order (REPLAY_ORDER.tsv).`);
