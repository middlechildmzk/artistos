import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const appRoot = path.join(root, "app");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

const databaseWritePatterns = [
  { label: "insert", regex: /\.from\([\s\S]{0,240}?\)\s*\.insert\s*\(/g },
  { label: "upsert", regex: /\.from\([\s\S]{0,240}?\)\s*\.upsert\s*\(/g },
  { label: "update", regex: /\.from\([\s\S]{0,240}?\)\s*\.update\s*\(/g },
  { label: "delete", regex: /\.from\([\s\S]{0,240}?\)\s*\.delete\s*\(/g },
];

const storageWritePatterns = [
  { label: "storage upload", regex: /\.storage\s*\.from\([\s\S]{0,160}?\)\s*\.upload\s*\(/g },
  { label: "storage update", regex: /\.storage\s*\.from\([\s\S]{0,160}?\)\s*\.update\s*\(/g },
  { label: "storage move", regex: /\.storage\s*\.from\([\s\S]{0,160}?\)\s*\.move\s*\(/g },
  { label: "storage remove", regex: /\.storage\s*\.from\([\s\S]{0,160}?\)\s*\.remove\s*\(/g },
];

test("application routes do not perform consequential database or storage writes directly", () => {
  const violations = [];

  for (const file of walk(appRoot)) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of [...databaseWritePatterns, ...storageWritePatterns]) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(source)) violations.push(`${relative(file)}: ${pattern.label}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      "Consequential writes under app/ must use invokeCapability so policy, authorization,",
      "idempotency, approval, audit, and evidence controls cannot be bypassed.",
      "RLS-scoped read-model queries may continue to use Supabase directly.",
      ...violations.map((item) => `- ${item}`),
    ].join("\n"),
  );
});

test("the write-boundary test preserves the read-versus-command distinction", () => {
  const source = fs.readFileSync(new URL(import.meta.url), "utf8");
  assert.match(source, /RLS-scoped read-model queries/);
  assert.match(source, /invokeCapability/);
  assert.doesNotMatch(source, /\.select\s*\(/);
});
