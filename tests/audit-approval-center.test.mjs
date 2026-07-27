import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const invoke = read("lib/capabilities/invoke.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const page = read("app/approvals/page.tsx");

test("runtime writes receipts for all material policy and execution outcomes", () => {
  for (const decision of ["denied", "requires_approval", "allowed", "failed", "succeeded"]) {
    assert.match(invoke, new RegExp(`decision: \\"${decision}\\"`));
  }
  assert.match(invoke, /recordAudit/);
  assert.match(invoke, /inputHash/);
  assert.match(invoke, /evidenceIds/);
});

test("server audit persistence preserves actor, policy, run, step, evidence, and errors", () => {
  assert.match(runtime, /from\("capability_audit_log"\)/);
  for (const field of ["principal_id", "policy_id", "run_id", "step_id", "evidence_ids", "error_code", "error_message"]) {
    assert.match(runtime, new RegExp(field));
  }
});

test("approval center exposes pending work and recent receipts without fake execution controls", () => {
  assert.match(page, /Pending approvals/);
  assert.match(page, /Recent runtime receipts/);
  assert.match(page, /R2, R3, and R4 actions remain human-gated/);
  assert.match(page, /does not offer a misleading button/);
  assert.doesNotMatch(page, />Approve</);
});
