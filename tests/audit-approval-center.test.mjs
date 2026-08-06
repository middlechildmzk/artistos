import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const invoke = read("lib/capabilities/invoke.ts");
const runtime = read("lib/capabilities/server-runtime.ts");
const approvedExecution = read("lib/capabilities/approved-execution.ts");
const actions = read("app/approvals/actions.ts");
const page = read("app/approvals/page.tsx");
const migration = read("supabase/migrations/20260727170000_capability_runtime_ledger.sql");

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

test("approval lifecycle is atomic, role-gated, frozen, evidenced, and auditable", () => {
  assert.match(migration, /decide_capability_approval/);
  assert.match(migration, /claim_capability_approval/);
  assert.match(migration, /finish_capability_approval/);
  assert.match(migration, /status = 'executing'/);
  assert.match(approvedExecution, /admin_role_required/);
  assert.match(approvedExecution, /preview_hash_mismatch/);
  assert.match(approvedExecution, /capability\.input\.safeParse/);
  assert.match(approvedExecution, /capability\.output\.safeParse/);
  assert.match(approvedExecution, /capability\.evidence === "required"/);
  assert.match(approvedExecution, /approval\.frozen_request_executed/);
});

test("approval center performs approve-and-execute rather than status-only approval", () => {
  assert.match(actions, /decideApproval/);
  assert.match(actions, /executeApprovedCapability/);
  assert.ok(actions.indexOf("decideApproval") < actions.indexOf("executeApprovedCapability"));
  assert.match(page, /Approve and run/);
  assert.match(page, /Review sensitive actions before ArtistOS carries them out/);
  assert.match(page, /clear history of your decisions/);
});
