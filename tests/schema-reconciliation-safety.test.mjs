import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const replay = read("scripts/verify-local-supabase.sh");
const reconciliation = read("scripts/production-schema-reconciliation.sql");

test("pre-ledger fixtures are generated temporarily and removed", () => {
  assert.match(replay, /local_preledger_fixture\.sql/);
  assert.match(replay, /cat > "\$\{FIXTURE_PATH\}"/);
  assert.match(replay, /rm -f "\$\{FIXTURE_PATH\}"/);
  assert.doesNotMatch(replay, /supabase db (push|reset --linked)/);
  assert.doesNotMatch(replay, /supabase migration repair/);
});

test("canonical production identities are confined to disposable replay", () => {
  assert.match(replay, /7fe2a999-41d0-4ba7-af23-98f1e58a5982/);
  assert.match(replay, /1117df01-6442-4c59-9d94-3ffa7e15612f/);
  assert.match(replay, /Never commit or apply to production/);
});

test("out-of-ledger reconciliation is narrow and local-only", () => {
  assert.match(reconciliation, /Never apply this file to production/);
  assert.match(reconciliation, /drop table if exists public\.industry_contacts/);
  assert.match(reconciliation, /drop table if exists public\.playlists/);
  assert.equal((reconciliation.match(/drop table/gi) ?? []).length, 2);
  assert.doesNotMatch(reconciliation, /delete\s+from|truncate|alter\s+table|update\s+/i);
});

test("historical fingerprint runs before pending migrations are restored", () => {
  const compare = replay.indexOf("compare-schema-fingerprints.mjs");
  const restore = replay.indexOf("restore_pending", compare);
  const fullReplay = replay.indexOf("Replaying every tracked historical and pending migration", restore);
  assert.ok(compare > 0 && restore > compare && fullReplay > restore);
});
