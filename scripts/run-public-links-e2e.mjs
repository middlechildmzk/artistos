#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ARTISTOS_APP_URL"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const appUrl = process.env.ARTISTOS_APP_URL.replace(/\/$/, "");
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const outputDir = path.resolve("artifacts/public-links-e2e");
fs.mkdirSync(outputDir, { recursive: true });
const slug = "artistos-e2e-release";
const fanEmail = "public-links-e2e@artistos.invalid";
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let browser;
const journeys = [];
const record = (id, detail) => journeys.push({ id, status: "PASS", detail });

try {
  const { data: link, error: linkError } = await service
    .from("smart_links")
    .select("id,workspace_id,release_id,slug,mode,is_active,capture_email")
    .eq("slug", slug)
    .single();
  if (linkError) throw linkError;
  assert(link.is_active && link.mode !== "private" && link.capture_email, "E2E public link is not active and capture-enabled");

  const { data: destination, error: destinationError } = await service
    .from("smart_link_destinations")
    .select("id,service,url")
    .eq("workspace_id", link.workspace_id)
    .eq("smart_link_id", link.id)
    .eq("is_active", true)
    .order("position", { ascending: true })
    .limit(1)
    .single();
  if (destinationError) throw destinationError;

  const privateResponse = await fetch(`${appUrl}/dashboard`, { redirect: "manual" });
  assert([302, 303, 307, 308].includes(privateResponse.status), `Expected private dashboard redirect, received ${privateResponse.status}`);
  const privateLocation = privateResponse.headers.get("location") ?? "";
  assert(privateLocation.includes("/login"), `Private dashboard did not redirect to login: ${privateLocation}`);
  record("private_route_guard", "Anonymous visitors are redirected away from the private dashboard while public release links remain reachable.");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${appUrl}/l/${slug}?utm_source=e2e&utm_medium=verification&utm_campaign=roadmap`, { waitUntil: "networkidle" });
  await page.getByText("ArtistOS E2E Release", { exact: false }).first().waitFor({ timeout: 20_000 });
  await page.getByText("Privacy-minimized attribution", { exact: true }).waitFor();
  const publicBody = await page.locator("body").innerText();
  assert(!publicBody.includes(link.workspace_id), "Public page exposed the workspace identifier");
  assert(!publicBody.includes("service_role"), "Public page exposed a privileged implementation detail");
  record("public_release_page", "Anonymous visitor rendered the active release link without private workspace fields.");

  await sleep(1_000);
  const redirectResponse = await fetch(
    `${appUrl}/l/${slug}/go/${destination.id}?utm_source=e2e&utm_medium=verification&utm_campaign=roadmap`,
    { redirect: "manual" },
  );
  assert(redirectResponse.status === 307, `Expected controlled 307 redirect, received ${redirectResponse.status}`);
  assert(redirectResponse.headers.get("location") === destination.url, "Redirect did not resolve to the stored active destination");
  record("controlled_destination_redirect", "Destination click used the database-bound redirect and preserved a 307 response.");

  await page.locator('input[name="firstName"]').fill("Roadmap");
  await page.locator('input[name="email"]').fill(fanEmail);
  await page.locator('input[name="emailConsent"]').check();
  await page.locator('input[name="privacyAcknowledged"]').check();
  await page.getByRole("button", { name: "Join the list" }).click();
  await page.waitForURL(/signup=success/, { timeout: 20_000 });
  await page.getByText("You're on the list", { exact: false }).waitFor();
  record("explicit_fan_consent", "Anonymous visitor submitted both required consent choices and received the success state.");
  await page.screenshot({ path: path.join(outputDir, "public-link-success.png"), fullPage: true });

  const { data: fan, error: fanError } = await service
    .from("fans")
    .select("id,workspace_id,email,verification_status,source_smart_link_id")
    .eq("workspace_id", link.workspace_id)
    .ilike("email", fanEmail)
    .single();
  if (fanError) throw fanError;
  assert(fan.source_smart_link_id === link.id, "Fan was not attributed to the public smart link");
  assert(fan.verification_status === "unverified", "Fan was incorrectly promoted to verified before confirmation");

  const [{ count: consentCount, error: consentError }, { data: events, error: eventsError }, { count: auditCount, error: auditError }, { count: idempotencyCount, error: idempotencyError }] = await Promise.all([
    service.from("fan_consents").select("id", { count: "exact", head: true }).eq("workspace_id", link.workspace_id).eq("fan_id", fan.id).eq("smart_link_id", link.id),
    service.from("link_events").select("event_type,destination_service,metadata").eq("workspace_id", link.workspace_id).eq("smart_link_id", link.id),
    service.from("capability_audit_log").select("id", { count: "exact", head: true }).eq("workspace_id", link.workspace_id).eq("capability_name", "public_links.capture_fan"),
    service.from("capability_idempotency").select("id", { count: "exact", head: true }).eq("workspace_id", link.workspace_id).eq("capability_name", "public_links.capture_fan"),
  ]);
  if (consentError) throw consentError;
  if (eventsError) throw eventsError;
  if (auditError) throw auditError;
  if (idempotencyError) throw idempotencyError;
  assert((consentCount ?? 0) >= 2, "Append-only email and privacy consent records were not persisted");
  assert((events ?? []).some((event) => event.event_type === "page_view"), "Page-view event was not recorded");
  assert((events ?? []).some((event) => event.event_type === "destination_click"), "Destination-click event was not recorded");
  assert((events ?? []).some((event) => event.event_type === "fan_signup"), "Fan-signup event was not recorded");
  assert((auditCount ?? 0) >= 2, "Public fan capability audit decisions were not persisted");
  assert((idempotencyCount ?? 0) >= 1, "Public fan capability idempotency receipt was not persisted");
  record("durable_public_link_evidence", "Fan attribution, append-only consent, link events, audit receipts, and idempotency receipts were persisted.");

  await context.close();
  await browser.close();
  browser = null;

  const report = {
    schema_version: 1,
    status: "PASS",
    summary: "Anonymous public link, controlled redirect, attribution, and explicit fan-consent journeys passed against disposable ArtistOS.",
    source_commit: process.env.GITHUB_SHA ?? null,
    completed_at: new Date().toISOString(),
    run_id: process.env.GITHUB_RUN_ID ?? "local",
    base_url: appUrl,
    journeys,
    counts: {
      consent_records: consentCount ?? 0,
      link_events: events?.length ?? 0,
      capability_audit_records: auditCount ?? 0,
      capability_idempotency_records: idempotencyCount ?? 0,
    },
    screenshots: ["public-link-success.png"],
    production_mutated: false,
  };
  fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (browser) await browser.close().catch(() => undefined);
  const report = {
    schema_version: 1,
    status: "FAIL",
    summary: error instanceof Error ? error.message : JSON.stringify(error),
    source_commit: process.env.GITHUB_SHA ?? null,
    completed_at: new Date().toISOString(),
    run_id: process.env.GITHUB_RUN_ID ?? "local",
    base_url: appUrl,
    journeys,
    production_mutated: false,
  };
  fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.error(error);
  process.exit(1);
}
