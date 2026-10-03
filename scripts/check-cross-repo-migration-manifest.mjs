#!/usr/bin/env node
// Gate: supabase/CROSS_REPO_MIGRATION_MANIFEST.json must describe every live
// artistos-core migration and every source-controlled migration file.
//
//   node scripts/check-cross-repo-migration-manifest.mjs
//   node scripts/check-cross-repo-migration-manifest.mjs --repo middle-child-experience=../middle-child-experience
//
// The ArtistOS checkout (.) is always verified. Supplying the BVSS checkout
// adds byte-level verification of its entries and the forward-reference proof.
// BVSS_REPO_DIR is honored as a shortcut for the second form.
//
// Cross-repo handshake: a pending migration declared here but not yet present
// in its owning checkout is reported as "not landed" and does not fail, so the
// authority can merge first. Pass --require-pending-landed to make it fatal
// (use before applying pending migrations to production). Any migration FILE
// that exists but is undeclared, or whose hash differs, always fails.
//
// Owning repositories run this from their own CI against the authority's main:
//   (cd <artistos checkout> && node scripts/check-cross-repo-migration-manifest.mjs --repo middle-child-experience=<bvss checkout>)

import { readFile } from "node:fs/promises";
import process from "node:process";
import { verifyManifest } from "./lib/cross-repo-manifest.mjs";

const repoDirs = { artistos: "." };
let requirePendingLanded = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--require-pending-landed") requirePendingLanded = true;
  else if (argv[i] === "--repo") {
    const [name, dir] = argv[i + 1].split("=");
    repoDirs[name] = dir;
    i += 1;
  }
}
if (process.env.BVSS_REPO_DIR && !repoDirs["middle-child-experience"]) {
  repoDirs["middle-child-experience"] = process.env.BVSS_REPO_DIR;
}

const manifest = JSON.parse(await readFile("supabase/CROSS_REPO_MIGRATION_MANIFEST.json", "utf8"));
const { errors, warnings, verified } = await verifyManifest(manifest, repoDirs, { requirePendingLanded });
const line = "─".repeat(72);
console.log(line);
console.log("Cross-repo migration manifest gate (artistos-core)");
console.log(line);
console.log(`applied migrations : ${manifest.applied.length}`);
console.log(`pending migrations : ${manifest.pending.length}`);
console.log(`aliases            : ${manifest.applied.filter((e) => e.timestamp_alias).length}`);
console.log(`hash-verified      : ${verified.applied_hash_checked} applied, ${verified.pending_hash_checked} pending`);
console.log(`unverified repos   : ${verified.unverified_repositories.join(", ") || "none"}`);
console.log(`pending not landed: ${verified.pending_not_landed.length ? verified.pending_not_landed.join(", ") : "none"}`);
for (const warning of warnings) console.log(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  console.error(`\n${errors.length} manifest problem(s).`);
  process.exit(1);
}
console.log("\nMANIFEST CONSISTENT.");
