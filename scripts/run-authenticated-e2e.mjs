#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ARTISTOS_APP_URL"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.ARTISTOS_APP_URL.replace(/\/$/, "");
const outputDir = path.resolve("artifacts/authenticated-e2e");
fs.mkdirSync(outputDir, { recursive: true });

const password = "ArtistOS-local-e2e-2026!";
const users = {
  owner: { email: "owner-e2e@artistos.invalid" },
  viewer: { email: "viewer-e2e@artistos.invalid" },
  outsider: { email: "outsider-e2e@artistos.invalid" },
};
const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(email) {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (!data.user) throw new Error(`User creation returned no user for ${email}`);
  return data.user;
}

async function signInPage(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${appUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  await page.locator("main").waitFor({ state: "visible" });
  return { context, page };
}

async function signInClient(email) {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function waitForMembership(userId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await service
      .from("workspace_members")
      .select("workspace_id,role")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    await sleep(500);
  }
  throw new Error("workspace_membership_not_provisioned");
}

async function count(table, workspaceId) {
  const { count: value, error } = await service.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (error) throw error;
  return value ?? 0;
}

let browser;
const journeys = [];
const record = (id, detail) => journeys.push({ id, status: "PASS", detail });

try {
  const ownerUser = await createUser(users.owner.email);
  const viewerUser = await createUser(users.viewer.email);
  const outsiderUser = await createUser(users.outsider.email);
  users.owner.id = ownerUser.id;
  users.viewer.id = viewerUser.id;
  users.outsider.id = outsiderUser.id;

  browser = await chromium.launch({ headless: true });

  const owner = await signInPage(browser, users.owner.email);
  const ownerMembership = await waitForMembership(ownerUser.id);
  await owner.page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  await owner.page.getByText("Private artist workspace", { exact: true }).waitFor({ timeout: 20_000 });
  assert(ownerMembership.role === "owner", "Provisioned user is not workspace owner");
  const workspaceId = ownerMembership.workspace_id;
  record("owner_login_and_workspace_provisioning", "Owner authenticated through the browser and ArtistOS provisioned the first workspace.");

  await owner.page.goto(`${appUrl}/releases`, { waitUntil: "networkidle" });
  await owner.page.locator('select[name="artistId"]').selectOption({ index: 1 });
  await owner.page.locator('input[name="title"]').fill("ArtistOS E2E Release");
  await owner.page.locator('input[name="releaseDate"]').fill("2026-08-28");
  await owner.page.locator('input[name="distributor"]').fill("Local Test Distributor");
  await owner.page.locator('input[name="label"]').fill("BVSS FVM Test");
  await owner.page.getByRole("button", { name: "Create release workspace" }).click();
  await owner.page.getByText("ArtistOS E2E Release", { exact: true }).first().waitFor({ timeout: 20_000 });
  record("owner_release_creation", "Owner created a release and its starter operational spine through the authenticated UI.");

  const { data: createdRelease, error: createdReleaseError } = await service
    .from("releases")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("title", "ArtistOS E2E Release")
    .single();
  if (createdReleaseError) throw createdReleaseError;

  await owner.page.goto(`${appUrl}/links`, { waitUntil: "networkidle" });
  await owner.page.getByRole("heading", { name: "ArtistOS Links" }).waitFor();
  const linkCard = owner.page.locator("article").filter({ hasText: "ArtistOS E2E Release" });
  await linkCard.locator('input[name="slug"]').fill("artistos-e2e-release");
  await linkCard.getByRole("button", { name: "Create release link" }).click();
  await owner.page.getByText("/l/artistos-e2e-release", { exact: true }).waitFor({ timeout: 20_000 });
  const refreshedLinkCard = owner.page.locator("article").filter({ hasText: "ArtistOS E2E Release" });
  await refreshedLinkCard.getByText("Add or update destination", { exact: true }).click();
  await refreshedLinkCard.locator('select[name="service"]').selectOption("spotify");
  await refreshedLinkCard.locator('input[name="url"]').fill("https://open.spotify.com/track/artistos-e2e");
  await refreshedLinkCard.getByRole("button", { name: "Save destination" }).click();
  await owner.page.getByText("https://open.spotify.com/track/artistos-e2e", { exact: true }).waitFor({ timeout: 20_000 });
  record("owner_artistos_links", "Owner created a release-scoped ArtistOS Link and streaming destination through audited capabilities.");
  await owner.page.screenshot({ path: path.join(outputDir, "owner-links.png"), fullPage: true });

  await owner.page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  const completeButton = owner.page.getByRole("button", { name: "Complete" }).first();
  await completeButton.waitFor({ timeout: 20_000 });
  await completeButton.click();
  await owner.page.waitForLoadState("networkidle");
  record("capability_task_execution", "Owner completed a release task through the capability runtime-backed server action.");

  await owner.page.goto(`${appUrl}/brain`, { waitUntil: "networkidle" });
  await owner.page.locator('input[name="namespace"]').fill("brand.message");
  await owner.page.locator('input[name="title"]').fill("E2E Core Message");
  await owner.page.locator('textarea[name="summary"]').fill("Even in the darkest moments, the listener is not alone.");
  await owner.page.locator('input[name="value"]').fill("never alone");
  await owner.page.getByRole("button", { name: "Save to Artist Brain" }).click();
  await owner.page.getByText("E2E Core Message", { exact: true }).waitFor({ timeout: 20_000 });
  record("artist_brain_memory", "Owner created a source-visible Artist Brain v2 memory through the UI.");

  await owner.page.goto(`${appUrl}/operating`, { waitUntil: "networkidle" });
  const requestText = "Coordinate an evidence-first 30-day promotion plan for ArtistOS E2E Release.";
  await owner.page.locator('textarea[name="requestText"]').fill(requestText);
  await owner.page.getByRole("button", { name: "Create coordinated plan" }).click();
  await owner.page.getByText(requestText, { exact: true }).waitFor({ timeout: 20_000 });
  record("ai_manager_request", "Owner created a deterministic cross-functional AI Manager plan through the UI.");

  await owner.page.goto(`${appUrl}/opportunities`, { waitUntil: "networkidle" });
  await owner.page.getByRole("heading", { name: "Opportunity Intelligence" }).waitFor();
  await owner.page.goto(`${appUrl}/approvals`, { waitUntil: "networkidle" });
  await owner.page.getByRole("heading", { name: "Review what ArtistOS may do, and why" }).waitFor();
  record("protected_workspaces_render", "Opportunity Intelligence and Approval Center rendered for the authenticated owner.");
  await owner.page.screenshot({ path: path.join(outputDir, "owner-approvals.png"), fullPage: true });

  const { error: viewerMembershipError } = await service.from("workspace_members").insert({ workspace_id: workspaceId, user_id: viewerUser.id, role: "viewer" });
  if (viewerMembershipError) throw viewerMembershipError;

  const viewer = await signInPage(browser, users.viewer.email);
  const viewerBody = await viewer.page.locator("body").innerText();
  assert(viewerBody.includes("ArtistOS E2E Release"), "Viewer cannot see the shared workspace release");
  await viewer.page.goto(`${appUrl}/brain`, { waitUntil: "networkidle" });
  await viewer.page.getByText("E2E Core Message", { exact: true }).waitFor();
  await viewer.page.goto(`${appUrl}/links`, { waitUntil: "networkidle" });
  await viewer.page.getByText("ArtistOS E2E Release", { exact: true }).first().waitFor();
  await viewer.page.getByText("/l/artistos-e2e-release", { exact: true }).waitFor();
  const viewerClient = await signInClient(users.viewer.email);
  const { error: viewerWriteError } = await viewerClient.from("tasks").insert({ workspace_id: workspaceId, title: "Viewer write must fail", status: "open" });
  assert(viewerWriteError, "Viewer task write unexpectedly succeeded");
  const { error: viewerLinkWriteError } = await viewerClient.from("smart_links").insert({ workspace_id: workspaceId, owner_id: viewerUser.id, release_id: createdRelease.id, slug: "viewer-write-must-fail", mode: "live" });
  assert(viewerLinkWriteError, "Viewer smart-link write unexpectedly succeeded");
  record("viewer_read_only", "Viewer read shared release, Brain memory, and ArtistOS Link but was denied direct authenticated writes.");
  await viewer.page.screenshot({ path: path.join(outputDir, "viewer-brain.png"), fullPage: true });

  const outsider = await signInPage(browser, users.outsider.email);
  const outsiderBody = await outsider.page.locator("body").innerText();
  assert(!outsiderBody.includes("ArtistOS E2E Release"), "Outsider can see another workspace release");
  const outsiderClient = await signInClient(users.outsider.email);
  const { data: outsiderReleases, error: outsiderReleasesError } = await outsiderClient.from("releases").select("id").eq("workspace_id", workspaceId);
  if (outsiderReleasesError) throw outsiderReleasesError;
  assert((outsiderReleases ?? []).length === 0, "Outsider read another workspace through the client");
  const { data: outsiderLinks, error: outsiderLinksError } = await outsiderClient.from("smart_links").select("id").eq("workspace_id", workspaceId);
  if (outsiderLinksError) throw outsiderLinksError;
  assert((outsiderLinks ?? []).length === 0, "Outsider read another workspace smart link");
  record("outsider_isolation", "Outsider could not read another workspace through the UI or direct authenticated client.");

  const { data: capabilityAudit, error: capabilityAuditError } = await service
    .from("capability_audit_log")
    .select("id,workspace_id,capability_name,decision")
    .eq("workspace_id", workspaceId);
  if (capabilityAuditError) throw capabilityAuditError;
  assert((capabilityAudit ?? []).length >= 5, "Capability audit log did not record the browser-driven writes");
  assert((capabilityAudit ?? []).some((entry) => entry.capability_name === "links.create_smart_link" && entry.decision === "allowed"), "Smart-link capability receipt missing");
  assert((capabilityAudit ?? []).some((entry) => entry.capability_name === "links.upsert_destination" && entry.decision === "allowed"), "Destination capability receipt missing");

  const { data: auditRows, error: auditError } = await service.from("audit_log").select("id,action,entity_type").in("action", ["brain_memory_created", "ai_manager_request_created"]);
  if (auditError) throw auditError;
  assert((auditRows ?? []).some((entry) => entry.action === "brain_memory_created"), "Artist Brain audit receipt missing");
  assert((auditRows ?? []).some((entry) => entry.action === "ai_manager_request_created"), "AI Manager audit receipt missing");

  const counts = {
    artists: await count("artists", workspaceId),
    releases: await count("releases", workspaceId),
    smart_links: await count("smart_links", workspaceId),
    smart_link_destinations: await count("smart_link_destinations", workspaceId),
    tasks: await count("tasks", workspaceId),
    brain_memories: await count("brain_memories", workspaceId),
    ai_manager_requests: await count("manager_requests", workspaceId),
    ai_agent_runs: await count("agent_runs", workspaceId),
    capability_audit_records: await count("capability_audit_log", workspaceId),
  };
  assert(counts.releases >= 1, "No release persisted");
  assert(counts.smart_links >= 1, "No ArtistOS Link persisted");
  assert(counts.smart_link_destinations >= 1, "No streaming destination persisted");
  assert(counts.brain_memories >= 1, "No Artist Brain memory persisted");
  assert(counts.ai_manager_requests >= 1, "No AI Manager request persisted");
  assert(counts.ai_agent_runs >= 6, "Cross-functional AI Manager agent runs were not persisted");

  await owner.context.close();
  await viewer.context.close();
  await outsider.context.close();
  await browser.close();
  browser = null;

  const report = {
    schema_version: 3,
    status: "PASS",
    summary: "Owner, viewer, outsider, capability runtime, ArtistOS Links, Artist Brain, and AI Manager journeys passed against disposable ArtistOS.",
    source_commit: process.env.GITHUB_SHA ?? null,
    completed_at: new Date().toISOString(),
    run_id: process.env.GITHUB_RUN_ID ?? "local",
    base_url: appUrl,
    accounts: {
      owner: { email: users.owner.email, user_id: users.owner.id, role: "owner" },
      viewer: { email: users.viewer.email, user_id: users.viewer.id, role: "viewer" },
      outsider: { email: users.outsider.email, user_id: users.outsider.id, role: "owner_of_separate_workspace" },
    },
    workspace_id: workspaceId,
    journeys,
    counts,
    screenshots: ["owner-links.png", "owner-approvals.png", "viewer-brain.png"],
    production_mutated: false,
  };
  fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (browser) await browser.close().catch(() => undefined);
  const report = {
    schema_version: 3,
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
