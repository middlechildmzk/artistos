import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const policy = read("lib/policies/evaluate.ts");
const invoke = read("lib/capabilities/invoke.ts");

test("protected risks are evaluated before configured policies", () => {
  const ceiling = policy.indexOf('capability.approval === "always"');
  const matchingPolicies = policy.indexOf("const matching = policies");
  assert.ok(ceiling >= 0 && matchingPolicies >= 0 && ceiling < matchingPolicies);
  assert.match(policy, /R2_internal_destructive/);
  assert.match(policy, /R3_external_effect/);
  assert.match(policy, /R4_governance/);
});

test("promotion requires 25 clean approvals and 14 days", () => {
  assert.match(policy, /approvalsAtCurrentLevel >= 25/);
  assert.match(policy, /rejectionsInWindow === 0/);
  assert.match(policy, /reversalsEver === 0/);
  assert.match(policy, /incidentsInLast90Days === 0/);
  assert.match(policy, /daysAtCurrentLevel >= 14/);
});

test("demotion is immediate and asymmetric", () => {
  assert.match(policy, /event === "incident"\) return "L0"/);
  assert.match(policy, /event === "reversed"\) return "L1"/);
  assert.match(policy, /current === "L3"\) return "L2"/);
});

test("invocation validates before authorization and policy evaluation", () => {
  const validation = invoke.indexOf("capability.input.safeParse");
  const authorization = invoke.indexOf("dependencies.authorize");
  const policyGate = invoke.indexOf("const policy = evaluateCapabilityPolicy");
  assert.ok(validation >= 0 && authorization > validation && policyGate > authorization);
});

test("required evidence is checked after execution", () => {
  assert.match(invoke, /capability.evidence === "required"/);
  assert.match(invoke, /execution.evidenceIds.length === 0/);
  assert.match(invoke, /evidence_missing/);
});
