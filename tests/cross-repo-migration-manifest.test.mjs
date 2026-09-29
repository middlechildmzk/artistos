import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalHash, canonicalSql } from "../scripts/lib/migration-canon.mjs";
import { readPrerequisiteSql, verifyManifest } from "../scripts/lib/cross-repo-manifest.mjs";
import { ARTISTOS_ROOT, fingerprint, loadManifest, replay } from "./support/pglite-replay.mjs";

const BVSS_DIR = process.env.BVSS_REPO_DIR ? path.resolve(process.env.BVSS_REPO_DIR) : null;
const clone = (value) => JSON.parse(JSON.stringify(value));

test("canonicalization matches the live-ledger SQL normalization", () => {
  const sql = "-- header\ncreate table x (\n  id int /* inline */\n);\n\nselect 1;  \n";
  assert.equal(canonicalSql(sql), "create table x ( id int ) select 1");
  assert.equal(canonicalHash(sql).chars, "create table x ( id int ) select 1".length);
});

test("manifest covers every live migration in strict production order", async () => {
  const manifest = await loadManifest();
  assert.equal(manifest.applied.length, 56);
  manifest.applied.forEach((entry, index) => {
    assert.equal(entry.replay_order, index + 1);
    if (index) assert.ok(entry.production_version > manifest.applied[index - 1].production_version);
  });
  assert.equal(manifest.applied.at(-1).production_version, "20260928163302");
  const owners = new Set(manifest.applied.map((e) => e.owning_repository));
  assert.deepEqual([...owners].sort(), ["artistos", "middle-child-experience"]);
  assert.ok(manifest.applied.every((e) => e.cross_repo_depends_on.length === 0));
});

test("the three timestamp aliases are recorded, not renamed", async () => {
  const manifest = await loadManifest();
  const aliases = manifest.applied.filter((e) => e.timestamp_alias).map((e) => [e.timestamp_alias.source_version, e.production_version]);
  assert.deepEqual(aliases, [
    ["20260804143000", "20260805163134"],
    ["20260804163000", "20260805163230"],
    ["20260805150000", "20260805163254"],
  ]);
});

test("gate passes against this checkout", async () => {
  const manifest = await loadManifest();
  const repoDirs = { artistos: ARTISTOS_ROOT, ...(BVSS_DIR ? { "middle-child-experience": BVSS_DIR } : {}) };
  const { errors, verified } = await verifyManifest(manifest, repoDirs);
  assert.deepEqual(errors, []);
  assert.ok(verified.applied_hash_checked >= 47);
});

test("gate rejects tampering", async (t) => {
  const manifest = await loadManifest();
  const repoDirs = { artistos: ARTISTOS_ROOT };

  await t.test("edited applied SQL", async () => {
    const m = clone(manifest);
    m.applied[0].live_canonical_sha256 = "0".repeat(64);
    const { errors } = await verifyManifest(m, repoDirs);
    assert.ok(errors.some((e) => e.includes("does not match recorded")));
  });

  await t.test("out-of-order versions", async () => {
    const m = clone(manifest);
    [m.applied[3], m.applied[4]] = [m.applied[4], m.applied[3]];
    const { errors } = await verifyManifest(m, repoDirs);
    assert.ok(errors.some((e) => e.includes("strictly ascending")));
  });

  await t.test("alias removed", async () => {
    const m = clone(manifest);
    m.applied.find((e) => e.timestamp_alias).timestamp_alias = null;
    const { errors } = await verifyManifest(m, repoDirs);
    assert.ok(errors.some((e) => e.includes("no timestamp_alias is declared")));
  });

  await t.test("pending migration not ordered after applied history", async () => {
    const m = clone(manifest);
    m.pending = [...m.pending, { proposed_version: "20260101000000", name: "too_early", owning_repository: "artistos", repository_path: "supabase/migrations/20260101000000_too_early.sql", tranche: "T9", status: "not_applied" }];
    const { errors } = await verifyManifest(m, {});
    assert.ok(errors.some((e) => e.includes("must ascend after the last applied version")));
  });

  await t.test("unmanifested migration file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "artistos-manifest-"));
    try {
      await cp(path.join(ARTISTOS_ROOT, "supabase/migrations"), path.join(dir, "supabase/migrations"), { recursive: true });
      await cp(path.join(ARTISTOS_ROOT, "scripts"), path.join(dir, "scripts"), { recursive: true });
      await writeFile(path.join(dir, "supabase/migrations/20261231000000_sneaky.sql"), "select 1;\n");
      const { errors } = await verifyManifest(manifest, { artistos: dir });
      assert.ok(errors.some((e) => e.includes("20261231000000_sneaky.sql is not in the manifest")));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test("pre-ledger fixture is read from the replay script, never a committed SQL file", async () => {
  const manifest = await loadManifest();
  const step = manifest.replay_prerequisites.find((s) => s.step === "preledger_fixture");
  assert.equal(step.path, undefined);
  assert.equal(step.embedded_in, "scripts/verify-local-supabase.sh");
  const sql = await readPrerequisiteSql(step, ARTISTOS_ROOT);
  assert.match(sql, /insert into public\.workspaces/);
  assert.doesNotMatch(sql, /^SQL$/m);
});

test("every ArtistOS migration file is manifested", async () => {
  const manifest = await loadManifest();
  const declared = new Set([...manifest.applied, ...manifest.pending].filter((e) => e.owning_repository === "artistos").map((e) => path.basename(e.repository_path)));
  const files = (await readdir(path.join(ARTISTOS_ROOT, "supabase/migrations"))).filter((f) => f.endsWith(".sql"));
  assert.deepEqual(files.filter((f) => !declared.has(f)), []);
});

test("ArtistOS-owned history replays into a clean database from the manifest alone", async () => {
  const { db, applied } = await replay();
  assert.equal(applied.length, 47 + 1, "47 ArtistOS migrations plus the pre-ledger fixture");
  const { rows } = await db.query("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name like 'bvss_%'");
  assert.equal(rows[0].n, 0);
  await db.close();
});

test("full cross-repo replay reproduces the production fingerprint", { skip: !BVSS_DIR && "set BVSS_REPO_DIR to the middle-child-experience checkout" }, async () => {
  const manifest = await loadManifest();
  const { db, applied } = await replay({ repoDirs: { artistos: ARTISTOS_ROOT, "middle-child-experience": BVSS_DIR }, manifest });
  assert.equal(applied.length, 56 + 1);
  const actual = await fingerprint(db);
  const expected = manifest.production_fingerprint;
  for (const key of ["public_columns_md5", "public_columns", "public_policies_md5", "public_policies", "public_tables", "public_views"]) {
    assert.equal(actual[key], expected[key], key);
  }
  await db.close();
});

test("applied history plus every pending migration applies cleanly in manifest order", { skip: !BVSS_DIR && "set BVSS_REPO_DIR to the middle-child-experience checkout" }, async () => {
  const manifest = await loadManifest();
  const pending = manifest.pending.map((p) => p.name);
  assert.ok(pending.length >= 3);
  const { db, applied } = await replay({ repoDirs: { artistos: ARTISTOS_ROOT, "middle-child-experience": BVSS_DIR }, pending, manifest });
  assert.equal(applied.length, 56 + 1 + pending.length);
  const { rows } = await db.query("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'bvss_playlist_source_status'");
  assert.equal(rows[0].n, 1);
  await db.close();
});
