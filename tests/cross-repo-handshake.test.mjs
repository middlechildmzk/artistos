// Cross-repo migration handshake: the authority manifest (this repository) may
// declare a pending migration owned by a sibling repository before that file
// reaches the sibling's main branch. Reproduces the merge sequence the review
// flagged (ArtistOS PR checked against BVSS main) and the invariants that must
// never weaken.

import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalHash } from "../scripts/lib/migration-canon.mjs";
import { verifyManifest } from "../scripts/lib/cross-repo-manifest.mjs";
import { ARTISTOS_ROOT, loadManifest } from "./support/pglite-replay.mjs";

const APPLIED_AUTH = "create table public.a (id int);\n";
const APPLIED_SIB = "create table public.b (id int);\n";
const PENDING_SIB = "alter table public.b add column note text default 'x;y';\n";

async function makeRepo(root, files) {
  await mkdir(path.join(root, "supabase/migrations"), { recursive: true });
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(root, "supabase/migrations", name), sql);
  return root;
}

function manifestFor({ pendingSql = PENDING_SIB } = {}) {
  const applied = (version, name, repo, sql, order) => ({
    replay_order: order,
    production_version: version,
    name,
    canonical_filename: `${version}_${name}.sql`,
    owning_repository: repo,
    repository_path: `supabase/migrations/${version}_${name}.sql`,
    timestamp_alias: null,
    live_canonical_sha256: canonicalHash(sql).sha256,
    depends_on: [],
    cross_repo_depends_on: [],
  });
  return {
    repositories: {
      authority: { migrations_dir: "supabase/migrations" },
      sibling: { migrations_dir: "supabase/migrations" },
    },
    replay_prerequisites: [],
    applied: [
      applied("20260101000000", "auth_base", "authority", APPLIED_AUTH, 1),
      applied("20260102000000", "sib_base", "sibling", APPLIED_SIB, 2),
    ],
    pending: [{
      proposed_version: "20260201000000",
      name: "sib_next",
      owning_repository: "sibling",
      repository_path: "supabase/migrations/20260201000000_sib_next.sql",
      tranche: "TX",
      status: "not_applied",
      canonical_sha256: canonicalHash(pendingSql).sha256,
    }],
  };
}

async function withRepos(siblingFiles, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "handshake-"));
  try {
    const authority = await makeRepo(path.join(dir, "authority"), { "20260101000000_auth_base.sql": APPLIED_AUTH });
    const sibling = await makeRepo(path.join(dir, "sibling"), { "20260102000000_sib_base.sql": APPLIED_SIB, ...siblingFiles });
    await fn({ authority, sibling });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("State A: authority declares a sibling pending migration not yet on sibling main -> PASS, reported not landed", async () => {
  await withRepos({}, async (dirs) => {
    const { errors, warnings, verified } = await verifyManifest(manifestFor(), dirs);
    assert.deepEqual(errors, []);
    assert.deepEqual(verified.pending_not_landed, ["sibling:supabase/migrations/20260201000000_sib_next.sql"]);
    assert.ok(warnings.some((w) => w.includes("declared pending, not yet landed in sibling")));
  });
});

test("State A strict: --require-pending-landed makes a not-landed pending migration fatal", async () => {
  await withRepos({}, async (dirs) => {
    const { errors } = await verifyManifest(manifestFor(), dirs, { requirePendingLanded: true });
    assert.ok(errors.some((e) => e.includes("20260201000000_sib_next: file missing")));
  });
});

test("State B: sibling branch adds the file with the declared hash -> PASS and hash verified", async () => {
  await withRepos({ "20260201000000_sib_next.sql": `-- landed\n${PENDING_SIB}` }, async (dirs) => {
    const { errors, verified } = await verifyManifest(manifestFor(), dirs);
    assert.deepEqual(errors, []);
    assert.equal(verified.pending_hash_checked, 1);
    assert.deepEqual(verified.pending_not_landed, []);
  });
});

test("State C: sibling migration exists but is not declared -> FAIL", async () => {
  await withRepos({ "20260301000000_undeclared.sql": "create table public.c (id int);\n" }, async (dirs) => {
    const { errors } = await verifyManifest(manifestFor(), dirs);
    assert.ok(errors.some((e) => e.includes("sibling:20260301000000_undeclared.sql is not in the manifest")));
  });
});

test("State D: sibling migration exists and is declared but its hash differs -> FAIL", async () => {
  const tampered = "alter table public.b add column note text default 'xy';\n"; // literal changed: 'x;y' -> 'xy'
  await withRepos({ "20260201000000_sib_next.sql": tampered }, async (dirs) => {
    const { errors } = await verifyManifest(manifestFor(), dirs);
    assert.ok(errors.some((e) => e.includes("20260201000000_sib_next: canonical SQL hash") && e.includes("does not match")));
  });
});

test("applied migrations must always exist in their owning repository", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "handshake-"));
  try {
    const authority = await makeRepo(path.join(dir, "authority"), { "20260101000000_auth_base.sql": APPLIED_AUTH });
    const sibling = await makeRepo(path.join(dir, "sibling"), {});
    const { errors } = await verifyManifest(manifestFor(), { authority, sibling });
    assert.ok(errors.some((e) => e.includes("20260102000000_sib_base: file missing")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an unparseable landed migration fails closed", async () => {
  await withRepos({ "20260201000000_sib_next.sql": "select 'unterminated;\n" }, async (dirs) => {
    const { errors } = await verifyManifest(manifestFor(), dirs);
    assert.ok(errors.some((e) => e.includes("cannot canonicalize")));
  });
});

test("real manifest against a BVSS checkout without the pending BVSS files (ArtistOS-first merge)", { skip: !process.env.BVSS_REPO_DIR && "set BVSS_REPO_DIR" }, async () => {
  const manifest = await loadManifest();
  const dir = await mkdtemp(path.join(os.tmpdir(), "bvss-main-"));
  try {
    await cp(path.join(process.env.BVSS_REPO_DIR, "supabase/migrations"), path.join(dir, "supabase/migrations"), { recursive: true });
    const bvssPending = manifest.pending.filter((p) => p.owning_repository === "middle-child-experience");
    for (const p of bvssPending) await rm(path.join(dir, p.repository_path), { force: true });
    const { errors, verified } = await verifyManifest(manifest, { artistos: ARTISTOS_ROOT, "middle-child-experience": dir });
    assert.deepEqual(errors, []);
    assert.equal(verified.pending_not_landed.length, bvssPending.length);
    // With nothing pending (all live migrations reconciled) this still proves the
    // real manifest verifies cleanly against the BVSS checkout.
    for (const p of bvssPending) assert.ok(!existsSync(path.join(dir, p.repository_path)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
