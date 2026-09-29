// Verification and replay assembly for supabase/CROSS_REPO_MIGRATION_MANIFEST.json.
// Pure functions over the filesystem; no database access.

import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MIGRATION_FILENAME, canonicalHash, deriveDependencies } from "./migration-canon.mjs";

/**
 * Read a replay prerequisite's SQL. A step either names a file (path) or is
 * embedded as a heredoc in a script (embedded_in + embedded_marker), which is
 * how the pre-ledger fixture is kept out of committed SQL files by policy.
 */
export async function readPrerequisiteSql(step, repoDir) {
  if (step.path) return readSource(repoDir, step.path);
  if (!step.embedded_in) return null;
  const script = await readSource(repoDir, step.embedded_in);
  if (script === null) return null;
  const start = script.indexOf(`${step.embedded_marker}\n`);
  if (start < 0) return null;
  const bodyStart = start + step.embedded_marker.length + 1;
  const end = script.indexOf("\nSQL\n", bodyStart);
  return end < 0 ? null : `${script.slice(bodyStart, end)}\n`;
}

async function readSource(repoDir, repositoryPath) {
  try {
    return await readFile(path.join(repoDir, repositoryPath), "utf8");
  } catch {
    return null;
  }
}

/**
 * Verify a manifest against whichever repository checkouts are available.
 * repoDirs: { [repositoryName]: absoluteOrRelativeDir }. Repositories that are
 * not supplied are checked structurally only and reported as unverified.
 * Returns { errors: string[], warnings: string[], verified: {...} }.
 */
export async function verifyManifest(manifest, repoDirs) {
  const errors = [];
  const warnings = [];
  const verified = { applied_hash_checked: 0, pending_hash_checked: 0, unverified_repositories: [] };
  const known = new Set(Object.keys(manifest.repositories ?? {}));

  for (const repo of known) if (!repoDirs[repo]) verified.unverified_repositories.push(repo);

  const applied = manifest.applied ?? [];
  const pending = manifest.pending ?? [];
  if (!applied.length) errors.push("manifest has no applied migrations");

  let previous = "";
  applied.forEach((entry, index) => {
    const label = `applied ${entry.production_version}_${entry.name}`;
    if (entry.replay_order !== index + 1) errors.push(`${label}: replay_order ${entry.replay_order}, expected ${index + 1}`);
    if (!/^\d{14}$/.test(entry.production_version)) errors.push(`${label}: malformed production_version`);
    if (entry.production_version <= previous) errors.push(`${label}: versions must be strictly ascending`);
    previous = entry.production_version;
    if (entry.canonical_filename !== `${entry.production_version}_${entry.name}.sql`) errors.push(`${label}: canonical_filename mismatch`);
    if (!known.has(entry.owning_repository)) errors.push(`${label}: unknown owning_repository ${entry.owning_repository}`);
    const fileMatch = path.basename(entry.repository_path ?? "").match(MIGRATION_FILENAME);
    if (!fileMatch) errors.push(`${label}: malformed repository_path`);
    else {
      const [, fileVersion, fileName] = fileMatch;
      if (fileName !== entry.name) errors.push(`${label}: repository file name ${fileName} differs`);
      const alias = entry.timestamp_alias;
      if (fileVersion === entry.production_version && alias) errors.push(`${label}: timestamp_alias declared but file version matches`);
      if (fileVersion !== entry.production_version) {
        if (!alias) errors.push(`${label}: file version ${fileVersion} differs from production and no timestamp_alias is declared`);
        else if (alias.source_version !== fileVersion || alias.production_version !== entry.production_version) {
          errors.push(`${label}: timestamp_alias does not match file version ${fileVersion}`);
        }
      }
    }
    for (const dep of entry.depends_on ?? []) {
      if (dep >= entry.production_version) errors.push(`${label}: depends on non-earlier ${dep}`);
    }
  });

  const appliedVersions = new Set(applied.map((e) => e.production_version));
  for (const step of manifest.replay_prerequisites ?? []) {
    const label = `replay prerequisite ${step.step}`;
    for (const bound of [step.applies_after, step.applies_before].filter(Boolean)) {
      if (!appliedVersions.has(bound)) errors.push(`${label}: boundary ${bound} is not an applied migration`);
    }
    if (step.insert_as) {
      const insertVersion = step.insert_as.slice(0, 14);
      if (appliedVersions.has(insertVersion)) errors.push(`${label}: insert_as version ${insertVersion} collides with an applied migration`);
      if (step.applies_after && insertVersion <= step.applies_after) errors.push(`${label}: insert_as must sort after ${step.applies_after}`);
      if (step.applies_before && insertVersion >= step.applies_before) errors.push(`${label}: insert_as must sort before ${step.applies_before}`);
    }
    if (repoDirs[step.owning_repository] && (await readPrerequisiteSql(step, repoDirs[step.owning_repository])) === null) {
      errors.push(`${label}: SQL not found at ${step.owning_repository}:${step.path ?? step.embedded_in}`);
    }
  }

  const maxApplied = applied.at(-1)?.production_version ?? "";
  let previousPending = maxApplied;
  const seen = new Set(applied.map((e) => e.production_version));
  for (const entry of pending) {
    const label = `pending ${entry.proposed_version}_${entry.name}`;
    if (!/^\d{14}$/.test(entry.proposed_version ?? "")) errors.push(`${label}: malformed proposed_version`);
    if (seen.has(entry.proposed_version)) errors.push(`${label}: version collides with another migration`);
    seen.add(entry.proposed_version);
    if (entry.proposed_version <= previousPending) errors.push(`${label}: pending versions must ascend after the last applied version ${maxApplied}`);
    previousPending = entry.proposed_version;
    if (path.basename(entry.repository_path ?? "") !== `${entry.proposed_version}_${entry.name}.sql`) errors.push(`${label}: repository_path must be <proposed_version>_<name>.sql`);
    if (!known.has(entry.owning_repository)) errors.push(`${label}: unknown owning_repository ${entry.owning_repository}`);
    if (!entry.tranche) errors.push(`${label}: tranche is required`);
    if (entry.status !== "not_applied") errors.push(`${label}: status must be not_applied until the ledger is recaptured`);
  }

  const sourcesByKey = new Map();
  for (const entry of [...applied, ...pending]) {
    const dir = repoDirs[entry.owning_repository];
    if (!dir) continue;
    const sql = await readSource(dir, entry.repository_path);
    const label = `${entry.production_version ?? entry.proposed_version}_${entry.name}`;
    if (sql === null) {
      errors.push(`${label}: file missing in ${entry.owning_repository}:${entry.repository_path}`);
      continue;
    }
    const { sha256 } = canonicalHash(sql);
    const expected = entry.live_canonical_sha256 ?? entry.canonical_sha256;
    if (!expected) errors.push(`${label}: no expected hash recorded`);
    else if (sha256 !== expected) errors.push(`${label}: canonical SQL hash ${sha256} does not match recorded ${expected}`);
    else if (entry.live_canonical_sha256) verified.applied_hash_checked += 1;
    else verified.pending_hash_checked += 1;
    sourcesByKey.set(entry.production_version ?? entry.proposed_version, sql);
  }

  for (const [repo, dir] of Object.entries(repoDirs)) {
    const migrationsDir = manifest.repositories?.[repo]?.migrations_dir;
    if (!migrationsDir) continue;
    const declared = new Set([...applied, ...pending].filter((e) => e.owning_repository === repo).map((e) => path.basename(e.repository_path)));
    let files = [];
    try {
      files = (await readdir(path.join(dir, migrationsDir))).filter((f) => f.endsWith(".sql"));
    } catch {
      errors.push(`${repo}: cannot read ${migrationsDir}`);
    }
    for (const file of files) if (!declared.has(file)) errors.push(`${repo}:${file} is not in the manifest (neither applied nor pending)`);
  }

  if (verified.unverified_repositories.length === 0) {
    const ordered = [...applied.map((e) => e.production_version), ...pending.map((e) => e.proposed_version)]
      .filter((key) => sourcesByKey.has(key))
      .map((key) => ({ key, sql: sourcesByKey.get(key) }));
    for (const [key, derived] of deriveDependencies(ordered)) {
      for (const fwd of derived.forward_references) {
        errors.push(`${key}: references ${fwd.object}, which is first created later by ${fwd.created_by}`);
      }
    }
  } else {
    warnings.push(`forward-reference proof skipped: repositories not supplied: ${verified.unverified_repositories.join(", ")}`);
  }

  return { errors, warnings, verified };
}

/**
 * Write every migration into outDir under its production filename, in replay
 * order, so `supabase db reset` against outDir reproduces the shared ledger.
 */
export async function assembleReplay(manifest, repoDirs, outDir, { includePending = false } = {}) {
  const { errors } = await verifyManifest(manifest, repoDirs);
  const missing = Object.keys(manifest.repositories).filter((repo) => !repoDirs[repo]);
  if (missing.length) errors.push(`replay needs every repository; missing: ${missing.join(", ")}`);
  if (errors.length) return { errors, written: [] };

  await mkdir(outDir, { recursive: true });
  const written = [];
  const fixtures = (manifest.replay_prerequisites ?? [])
    .filter((step) => step.insert_as)
    .map((step) => ({ step, owning_repository: step.owning_repository, repository_path: step.path ?? step.embedded_in, filename: step.insert_as, state: `prerequisite:${step.step}` }));
  const entries = [
    ...manifest.applied.map((e) => ({ ...e, filename: e.canonical_filename, state: "applied" })),
    ...fixtures,
    ...(includePending ? manifest.pending.map((e) => ({ ...e, filename: `${e.proposed_version}_${e.name}.sql`, state: "pending" })) : []),
  ].sort((a, b) => a.filename.localeCompare(b.filename));
  for (const entry of entries) {
    if (entry.step) await writeFile(path.join(outDir, entry.filename), await readPrerequisiteSql(entry.step, repoDirs[entry.owning_repository]));
    else await copyFile(path.join(repoDirs[entry.owning_repository], entry.repository_path), path.join(outDir, entry.filename));
    written.push(`${entry.filename}\t${entry.state}\t${entry.owning_repository}:${entry.repository_path}`);
  }
  const postSteps = (manifest.replay_prerequisites ?? []).filter((step) => !step.insert_as && step.path);
  const lines = [...written, ...postSteps.map((step) => `(run after replay)\tprerequisite:${step.step}\t${step.owning_repository}:${step.path}`)];
  await writeFile(path.join(outDir, "REPLAY_ORDER.tsv"), `${lines.join("\n")}\n`);
  return { errors: [], written, post_replay: postSteps.map((step) => path.join(repoDirs[step.owning_repository], step.path)) };
}
