// Shared helpers for the cross-repo migration manifest.
//
// Canonical SQL (canonicalization version 2) is LITERAL-AWARE. A single-pass
// PostgreSQL lexer walks the text and:
//   * copies every literal byte-for-byte: '...' strings ('' escapes),
//     E'...' strings (backslash escapes), $tag$...$tag$ dollar-quoted strings
//     and function bodies, and "..." quoted identifiers ("" escapes);
//   * outside literals only: drops -- and (nested) /* */ comments, collapses
//     whitespace runs to one space (none just inside parentheses or around a
//     comma), and splits statements at top-level
//     semicolons, dropping empty statements;
//   * joins the trimmed statements with ";\n".
// So comments, formatting whitespace and separator formatting outside literals
// never change the hash, while ANY change inside a literal does (version 1
// stripped ';', '--' and '/*' even inside strings, which let semantic edits
// collide). Unterminated literals or comments throw: the gate fails closed.
//
// The live side is hashed by the same function over the statements exported
// from supabase_migrations.schema_migrations
// (scripts/sql/live-migration-ledger-statements.sql), so there is exactly one
// implementation of the normalization.

import { createHash } from "node:crypto";

export const MIGRATION_FILENAME = /^(\d{14})_(.+)\.sql$/;
export const CANONICALIZATION_VERSION = 2;

const isIdentChar = (ch) => ch !== undefined && /[A-Za-z0-9_$\u0080-\uffff]/.test(ch);
const DOLLAR_TAG = /^\$(?:[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/;

export function canonicalSql(sql) {
  const statements = [];
  let current = "";
  let pendingSpace = false;
  // Whitespace is dropped directly inside parentheses and around commas (never
  // semantically significant in SQL); everywhere else a run becomes one space.
  // Spacing around operators is deliberately NOT normalized.
  const emit = (text) => {
    if (pendingSpace && current.length && !current.endsWith("(") && !current.endsWith(",") && text !== ")" && text !== ",") current += " ";
    pendingSpace = false;
    current += text;
  };
  const endStatement = () => {
    const trimmed = current.trim();
    if (trimmed) statements.push(trimmed);
    current = "";
    pendingSpace = false;
  };

  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];

    if (/\s/.test(c)) { pendingSpace = true; i += 1; continue; }

    if (c === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i += 1;
      pendingSpace = true;
      continue;
    }

    if (c === "/" && next === "*") {
      let depth = 0;
      const start = i;
      while (i < n) {
        if (sql[i] === "/" && sql[i + 1] === "*") { depth += 1; i += 2; }
        else if (sql[i] === "*" && sql[i + 1] === "/") { depth -= 1; i += 2; if (depth === 0) break; }
        else i += 1;
      }
      if (depth !== 0) throw new Error(`unterminated block comment at offset ${start}`);
      pendingSpace = true;
      continue;
    }

    if (c === ";") { endStatement(); i += 1; continue; }

    if (c === "$" && !isIdentChar(sql[i - 1])) {
      const match = DOLLAR_TAG.exec(sql.slice(i, i + 256));
      if (match) {
        const tag = match[0];
        const close = sql.indexOf(tag, i + tag.length);
        if (close < 0) throw new Error(`unterminated dollar-quoted string ${tag} at offset ${i}`);
        emit(sql.slice(i, close + tag.length));
        i = close + tag.length;
        continue;
      }
    }

    if (c === "'" || c === '"') {
      const start = i;
      const backslashEscapes = c === "'" && (sql[i - 1] === "E" || sql[i - 1] === "e") && !isIdentChar(sql[i - 2]);
      i += 1;
      let closed = false;
      while (i < n) {
        const ch = sql[i];
        if (backslashEscapes && ch === "\\") { i += 2; continue; }
        if (ch === c) {
          if (sql[i + 1] === c) { i += 2; continue; }
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      if (!closed) throw new Error(`unterminated ${c === "'" ? "string" : "quoted identifier"} at offset ${start}`);
      emit(sql.slice(start, i));
      continue;
    }

    emit(c);
    i += 1;
  }
  endStatement();
  return statements.join(";\n");
}

/** Canonical form of the statements array stored in schema_migrations. */
export function canonicalStatements(statements) {
  return canonicalSql(statements.join("\n"));
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
