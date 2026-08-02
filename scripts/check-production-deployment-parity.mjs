#!/usr/bin/env node

const required = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "EXPECTED_SHA"];
for (const key of required) {
  if (!process.env[key]?.trim()) throw new Error(`Missing ${key}`);
}

const params = new URLSearchParams({
  projectId: process.env.VERCEL_PROJECT_ID,
  teamId: process.env.VERCEL_TEAM_ID,
  target: "production",
  limit: "20",
});
const response = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
  headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
});
if (!response.ok) throw new Error(`Vercel deployment lookup failed: ${response.status} ${await response.text()}`);
const payload = await response.json();
const deployments = Array.isArray(payload.deployments) ? payload.deployments : [];
const production = deployments.find((deployment) => deployment.target === "production" && ["READY", "BUILDING", "QUEUED"].includes(deployment.state));
if (!production) throw new Error("No production deployment exists for the canonical Vercel project");

const actualSha = production.meta?.githubCommitSha ?? null;
const expectedSha = process.env.EXPECTED_SHA.trim();
const result = {
  project_id: process.env.VERCEL_PROJECT_ID,
  deployment_id: production.uid ?? production.id ?? null,
  deployment_url: production.url ?? null,
  deployment_state: production.state ?? null,
  target: production.target ?? null,
  expected_sha: expectedSha,
  actual_sha: actualSha,
  parity: actualSha === expectedSha,
};
console.log(JSON.stringify(result, null, 2));
if (!result.parity) {
  console.error(`Production SHA ${actualSha ?? "unknown"} does not match approved SHA ${expectedSha}.`);
  process.exit(1);
}
