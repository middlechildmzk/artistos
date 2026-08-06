import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { deriveIntegrationSourceState } from "../lib/integrations/source-state.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const now = new Date("2026-08-06T20:00:00Z");

test("Insights is the canonical product route", () => {
  const config = read("next.config.ts");
  const header = read("components/app-header.tsx");
  const page = read("app/insights/page.tsx");
  assert.match(config, /source: "\/analytics"[\s\S]*destination: "\/insights"[\s\S]*permanent: true/);
  assert.match(header, /label: "Insights", href: "\/insights"/);
  assert.match(page, /Evidence-first music intelligence/);
  assert.match(page, /Configured, authorized and provider verified are separate states/);
  assert.match(page, /One snapshot cannot create a trend/);
});

test("source-state logic never collapses identity, authorization, import and verification", () => {
  assert.equal(deriveIntegrationSourceState({ publicIdentityCount: 1, now }).state, "public_identity");
  assert.equal(deriveIntegrationSourceState({ authorized: true, now }).state, "authorized");
  assert.equal(deriveIntegrationSourceState({ snapshotCount: 2, latestSnapshotOn: "2026-08-03", now }).state, "imported");
  assert.equal(deriveIntegrationSourceState({ lastSuccessAt: "2026-08-03T20:00:00Z", now }).state, "verified");
  assert.equal(deriveIntegrationSourceState({ lastSuccessAt: "2026-07-01T20:00:00Z", now }).state, "stale");
  assert.equal(deriveIntegrationSourceState({ lastError: "token_refresh_failed", now }).state, "error");
});

test("public smart links support native sharing without weakening consent or tracked redirects", () => {
  const page = read("app/l/[slug]/page.tsx");
  const share = read("components/public-link-share-actions.tsx");
  assert.match(page, /PublicLinkShareActions/);
  assert.match(page, /trackedDestinationHref/);
  assert.match(page, /emailConsent/);
  assert.match(page, /privacyAcknowledged/);
  assert.match(share, /navigator\.share/);
  assert.match(share, /navigator\.clipboard\.writeText/);
});

test("provider catalog states current access boundaries", () => {
  const catalog = read("lib/integrations/source-catalog.ts");
  assert.match(catalog, /Extended Quota Mode apps are not covered/);
  assert.match(catalog, /YouTube Analytics API/);
  assert.match(catalog, /professional Instagram account/);
  assert.match(catalog, /user\.info\.stats/);
  assert.match(catalog, /OAuth 2\.1 with PKCE/);
  assert.match(catalog, /slug: "audius"/);
  assert.match(catalog, /platform-specific signal/);
});

test("connection mutations revalidate the canonical Insights route", () => {
  const actions = read("app/connections/actions.ts");
  assert.match(actions, /revalidatePath\("\/insights"\)/);
  assert.doesNotMatch(actions, /revalidatePath\("\/analytics"\)/);
});
