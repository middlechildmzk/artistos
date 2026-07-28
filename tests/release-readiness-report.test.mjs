import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const generator = fs.readFileSync(path.join(root, "scripts/generate-release-readiness-report.mjs"), "utf8");

test("readiness generator supports the reviewed manifest document shape", () => {
  assert.match(generator, /document\.migrations/);
  assert.match(generator, /Array\.isArray\(document\)/);
  assert.match(generator, /Manifest migrations array is invalid/);
});

test("historical migration readiness uses exact reviewed filenames", () => {
  assert.match(generator, /`\$\{entry\.version\}_\$\{entry\.name\}\.sql`/);
  assert.doesNotMatch(generator, /startsWith\(`\$\{entry\.version\}_`\)/);
});

test("isolated database replay is a first-class readiness gate", () => {
  assert.match(generator, /local-db-replay\.json/);
  assert.match(generator, /Isolated clean-database replay/);
  assert.match(generator, /production_mutation_authorized:\s*false/);
});

test("successful clean replay can satisfy pending migration rehearsal", () => {
  assert.match(generator, /The isolated clean-database replay applied the complete tracked historical and pending migration chain/);
  assert.match(generator, /replayPassed\(\)/);
});
