// Shared helpers for the cross-repo migration manifest.
//
// Canonical SQL: comments stripped, semicolons removed, whitespace collapsed.
// This is byte-for-byte the same normalization as
// scripts/sql/live-migration-ledger-canonical.sql, so a hash computed from a
// source file here is directly comparable with the hash Postgres computes over
// supabase_migrations.schema_migrations.statements in production.

import { createHash } from "node:crypto";

export const MIGRATION_FILENAME = /^(\d{14})_(.+)\.sql$/;

export function canonicalSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replaceAll(";", "")
    .replace(/\s+/g, " ")
    .replace(/^ +| +$/g, "");
}

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalHash(sql) {
  const canon = canonicalSql(sql);
  return { sha256: sha256(canon), chars: canon.length };
}

const IDENT = String.raw`(?:public\.)?"?([a-z_][a-z0-9_]*)"?`;

const CREATE_PATTERNS = [
  new RegExp(String.raw`create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view|type)\s+(?:if\s+not\s+exists\s+)?${IDENT}`, "g"),
  new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+${IDENT}\s*\(`, "g"),
];

const REFERENCE_PATTERNS = [
  new RegExp(String.raw`references\s+${IDENT}`, "g"),
  new RegExp(String.raw`alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?${IDENT}`, "g"),
  new RegExp(String.raw`\bon\s+(?:table\s+)?${IDENT}`, "g"),
  new RegExp(String.raw`\b(?:from|join|into|update)\s+${IDENT}`, "g"),
  new RegExp(String.raw`\b${IDENT}\s*\(`, "g"),
];

/**
 * Static object analysis of one migration: which public objects it creates
 * and which it references. Deliberately conservative: it is used to derive a
 * lower bound of dependencies and to prove that no migration references an
 * object first created by a LATER migration. Replay order itself is always the
 * manifest's strict production-version order, never this heuristic.
 */
export function analyzeObjects(sql) {
  const text = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").toLowerCase();
  const created = new Set();
  for (const pattern of CREATE_PATTERNS) for (const m of text.matchAll(pattern)) created.add(m[1]);
  const referenced = new Set();
  for (const pattern of REFERENCE_PATTERNS) for (const m of text.matchAll(pattern)) referenced.add(m[1]);
  for (const name of created) referenced.delete(name);
  return { created: [...created].sort(), referenced: [...referenced].sort() };
}

/**
 * Given migrations in replay order ({ key, sql }), return for each key the set
 * of earlier keys whose created objects it references, plus any reference to
 * an object that is only created LATER (an ordering violation).
 */
export function deriveDependencies(ordered) {
  const creator = new Map();
  const firstCreatorLater = new Map();
  ordered.forEach(({ key, sql }, index) => {
    for (const name of analyzeObjects(sql).created) {
      if (!firstCreatorLater.has(name)) firstCreatorLater.set(name, { key, index });
    }
  });
  const result = new Map();
  ordered.forEach(({ key, sql }, index) => {
    const { created, referenced } = analyzeObjects(sql);
    const dependsOn = new Set();
    const forward = [];
    for (const name of referenced) {
      const earlier = creator.get(name);
      if (earlier) dependsOn.add(earlier);
      else {
        const later = firstCreatorLater.get(name);
        if (later && later.index > index) forward.push({ object: name, created_by: later.key });
      }
    }
    for (const name of created) if (!creator.has(name)) creator.set(name, key);
    result.set(key, { depends_on: [...dependsOn].sort(), forward_references: forward });
  });
  return result;
}
