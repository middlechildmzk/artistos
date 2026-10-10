import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// P0 regression: the current contactable_fans SQL view suppresses addresses,
// but does NOT prove consent or contact ownership. Never label its rows
// send-ready until a separate authenticated consent service is implemented.
const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("app/audience/page.tsx");

test("audience labels SQL suppression filtering honestly", () => {
  assert.match(source, /\.from\("contactable_fans"\)/);
  assert.match(source, /Unsuppressed loaded/);
  assert.match(source, /Recent unsuppressed records/);
  assert.match(source, /Suppression-filtered only/);
  assert.doesNotMatch(source, /Contactable loaded|Recent contactable fans|No contactable fans/);
});

test("the audience page never equates imported status or deliverability with consent", () => {
  assert.match(source, /Marketing permission is not confirmed/);
  assert.match(source, /Imported consent label:/);
  assert.match(source, /Data verification:/);
  assert.match(source, /per-fan consent evidence, confirmed contact ownership, and suppression checks/);
  assert.doesNotMatch(source, /Verified loaded/);
});

test("audience page remains read-only and cannot initiate outreach", () => {
  assert.doesNotMatch(source, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(/);
  assert.doesNotMatch(source, /sendMarketing|sendEmail|sendSms|triggerCampaignSend/);
});
