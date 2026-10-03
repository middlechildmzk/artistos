// Replay artistos-core migrations into an in-process PostgreSQL (PGlite) using
// supabase/CROSS_REPO_MIGRATION_MANIFEST.json as the only source of ordering.
// Used by tests; never touches a shared database.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { SUPABASE_PLATFORM_STUB } from "./supabase-platform-stub.mjs";
import { readPrerequisiteSql } from "../../scripts/lib/cross-repo-manifest.mjs";

export const ARTISTOS_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export async function loadManifest() {
  return JSON.parse(await readFile(path.join(ARTISTOS_ROOT, "supabase/CROSS_REPO_MIGRATION_MANIFEST.json"), "utf8"));
}

/**
 * repoDirs: which repositories to replay from. Entries owned by a repository
 * that is not supplied are skipped; the manifest proves there are no
 * cross-repository dependencies (cross_repo_depends_on is empty everywhere),
 * so an ArtistOS-only replay is valid on its own.
 * pending: list of pending migration names to apply after the applied history.
 */
export async function replay({ repoDirs = { artistos: ARTISTOS_ROOT }, pending = [], manifest } = {}) {
  manifest ??= await loadManifest();
  const plan = [];
  for (const entry of manifest.applied) {
    if (repoDirs[entry.owning_repository]) plan.push({ key: entry.canonical_filename, repo: entry.owning_repository, file: entry.repository_path });
  }
  for (const step of manifest.replay_prerequisites ?? []) {
    if (step.insert_as && repoDirs[step.owning_repository]) plan.push({ key: step.insert_as, repo: step.owning_repository, step });
  }
  plan.sort((a, b) => a.key.localeCompare(b.key));
  for (const name of pending) {
    const entry = manifest.pending.find((p) => p.name === name);
    if (!entry) throw new Error(`pending migration ${name} is not in the manifest`);
    plan.push({ key: `${entry.proposed_version}_${entry.name}.sql`, repo: entry.owning_repository, file: entry.repository_path });
  }

  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PLATFORM_STUB);
  const applied = [];
  const runPostSteps = async () => {
    for (const step of manifest.replay_prerequisites ?? []) {
      if (!step.insert_as && step.path && repoDirs[step.owning_repository]) {
        await db.exec(await readFile(path.join(repoDirs[step.owning_repository], step.path), "utf8"));
      }
    }
  };
  let postDone = false;
  for (const item of plan) {
    const isPending = item.key.slice(0, 14) > manifest.applied.at(-1).production_version;
    if (isPending && !postDone) { await runPostSteps(); postDone = true; }
    const sql = item.step
      ? await readPrerequisiteSql(item.step, repoDirs[item.repo])
      : await readFile(path.join(repoDirs[item.repo], item.file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      error.message = `replay failed at ${item.key}: ${error.message}`;
      throw error;
    }
    applied.push(item.key);
  }
  if (!postDone) await runPostSteps();
  return { db, applied };
}

export async function fingerprint(db) {
  const sql = await readFile(path.join(ARTISTOS_ROOT, "scripts/sql/replay-parity-fingerprint.sql"), "utf8");
  const result = await db.query(sql.replace(/;\s*$/, ""));
  return result.rows[0];
}
