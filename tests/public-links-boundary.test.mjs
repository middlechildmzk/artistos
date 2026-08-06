import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const admin = read("lib/supabase/admin.ts");
const loader = read("lib/public-links.ts");
const page = read("app/l/[slug]/page.tsx");
const viewRoute = read("app/api/public-links/[slug]/view/route.ts");
const clickRoute = read("app/l/[slug]/go/[destinationId]/route.ts");
const fanAction = read("app/l/[slug]/actions.ts");
const fanRegistry = read("lib/capabilities/public-links-registry.ts");
const fanHandler = read("lib/capabilities/public-links-handlers.ts");
const publicRuntime = read("lib/capabilities/public-links-runtime.ts");

test("public links use a server-only service-role boundary", () => {
  assert.match(admin, /import "server-only"/);
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdminClient/);
});

test("the public loader exposes an explicit allowlist and rejects private links", () => {
  assert.match(loader, /select\("id,workspace_id,release_id,slug,mode,headline,description,capture_email,consent_copy_version"\)/);
  assert.match(loader, /neq\("mode", "private"\)/);
  assert.match(loader, /eq\("is_active", true\)/);
  assert.doesNotMatch(loader, /meta_pixel_id|tiktok_pixel_id|google_analytics_id|owner_id|notes/);
});

test("destination redirects are database-bound and reject unsafe protocols", () => {
  assert.match(clickRoute, /link\.destinations\.find/);
  assert.match(clickRoute, /destination_not_found/);
  assert.match(clickRoute, /'http:', 'https:'/);
  assert.match(clickRoute, /recordPublicLinkEvent/);
  assert.doesNotMatch(page, /destination\.url/);
});

test("page-view collection is deduplicated without persistent fingerprints", () => {
  assert.match(viewRoute, /maxAge: 60 \* 60 \* 12/);
  assert.match(viewRoute, /httpOnly: true/);
  assert.match(viewRoute, /payload_too_large/);
  assert.doesNotMatch(viewRoute, /x-forwarded-for|user-agent|ip_hash|user_agent_hash/);
  assert.doesNotMatch(loader, /x-forwarded-for|user-agent|ip_hash|user_agent_hash/);
});

test("fan capture is an audited capability rather than a direct application write", () => {
  assert.match(fanAction, /invokeCapability/);
  assert.match(fanAction, /public_links\.capture_fan/);
  assert.doesNotMatch(fanAction, /\.from\("|\.insert\(\{|\.update\(\{|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(fanRegistry, /emailConsent: z\.literal\(true\)/);
  assert.match(fanRegistry, /privacyAcknowledged: z\.literal\(true\)/);
  assert.match(publicRuntime, /public_links\.explicit_fan_consent/);
  assert.match(publicRuntime, /principalId: `public-link:/);
});

test("fan capture appends consent evidence without persistent fingerprints", () => {
  assert.match(fanHandler, /consent_type: "email_marketing"/);
  assert.match(fanHandler, /consent_type: "privacy_terms"/);
  assert.match(fanHandler, /email_confirmation_status: "unverified"/);
  assert.match(fanHandler, /eventType: "fan_signup"/);
  assert.match(fanHandler, /capability_idempotency/);
  assert.doesNotMatch(fanHandler, /ip_hash|user_agent_hash|x-forwarded-for|user-agent/);
});

test("the public page preserves attribution without exposing direct destination URLs", () => {
  assert.match(page, /utm_source/);
  assert.match(page, /utm_medium/);
  assert.match(page, /utm_campaign/);
  assert.match(page, /artist-owned list/);
  assert.match(page, /not sold to advertisers/);
  assert.match(page, /Artist-owned fan connection/);
});
