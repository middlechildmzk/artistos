#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [productionPath, localPath, outputDirectory = "artifacts/schema-drift"] = process.argv.slice(2);
if (!productionPath || !localPath) {
  console.error("Usage: compare-schema-fingerprints.mjs <production.json> <local.json> [output-directory]");
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const production = readJson(productionPath);
const local = readJson(localPath);
const categoryNames = [...new Set([
  ...Object.keys(production.categories ?? {}),
  ...Object.keys(local.categories ?? {}),
])].sort();

const categoryComparisons = categoryNames.map((category) => {
  const expected = production.categories?.[category] ?? null;
  const actual = local.categories?.[category] ?? null;
  return {
    category,
    status: expected?.object_count === actual?.object_count && expected?.sha256 === actual?.sha256 ? "PASS" : "FAIL",
    expected,
    actual,
  };
});

const overallMatch = production.object_count === local.object_count && production.sha256 === local.sha256;
const mismatches = categoryComparisons.filter((item) => item.status === "FAIL");
const result = overallMatch && mismatches.length === 0 ? "PASS" : "FAIL";

fs.mkdirSync(outputDirectory, { recursive: true });
const report = {
  schema_version: 1,
  result,
  production: {
    project_ref: production.project_ref ?? null,
    verified_at_utc: production.verified_at_utc ?? null,
    object_count: production.object_count,
    sha256: production.sha256,
  },
  local: {
    source_commit: process.env.GITHUB_SHA ?? null,
    object_count: local.object_count,
    sha256: local.sha256,
  },
  categories: categoryComparisons,
  unexpected_drift_categories: mismatches.map((item) => item.category),
  production_mutated: false,
};

fs.writeFileSync(path.join(outputDirectory, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
const lines = result === "PASS"
  ? [
      "NO LINKED SCHEMA DRIFT DETECTED",
      `Application schema objects: ${local.object_count}`,
      `SHA-256: ${local.sha256}`,
      `Compared with production fingerprint captured at ${production.verified_at_utc ?? "unknown time"}.`,
      "Production mutated: false",
    ]
  : [
      "RESULT: FAIL",
      "UNEXPECTED LINKED SCHEMA DRIFT DETECTED",
      `Production objects/hash: ${production.object_count} / ${production.sha256}`,
      `Local historical objects/hash: ${local.object_count} / ${local.sha256}`,
      `Mismatched categories: ${mismatches.map((item) => item.category).join(", ") || "overall only"}`,
      "Production mutated: false",
    ];

fs.writeFileSync(path.join(outputDirectory, "summary.txt"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
if (result !== "PASS") process.exitCode = 1;
