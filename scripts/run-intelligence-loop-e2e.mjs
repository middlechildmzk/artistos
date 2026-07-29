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
const outputDir = path.resolve("artifacts/intelligence-loop-e2e");
fs.mkdirSync(outputDir, { recursive: true });

const password = "ArtistOS-intelligence-e2e-2026!";
const users = {
  owner: { email: "intelligence-owner-e2e@artistos.invalid" },
  viewer: { email: "intelligence-viewer-e2e@artistos.invalid" },
  outsider: { email: "intelligence-outsider-e2e@artistos.invalid" },
};
const names = {
  release: "ArtistOS Intelligence E2E Release",
  campaign: "ArtistOS Intelligence E2E Campaign",
  organization: "ArtistOS Intelligence E2E Network Target",
  outreach: "ArtistOS Intelligence E2E Outreach",
  deliverable: "ArtistOS Intelligence E2E Playlist Placement",
  outcome: "playlist_placement",
  evidence: "Verified ArtistOS intelligence-loop placement receipt.",
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
    const { data, error } = await service.from("workspace_members").select("workspace_id,role").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
    await sleep(500);
  }
  throw new Error("workspace_membership_not_provisioned");
}

async function waitForSingle(load, description, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await load();
    if (error) throw error;
    if (data) return data;
    await sleep(400);
  }
  throw new Error(`${description}_not_persisted`);
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

  browser = await chromium.launch({ headless: true });
  const owner = await signInPage(browser, users.owner.email);
  const ownerMembership = await waitForMembership(ownerUser.id);
  assert(ownerMembership.role === "owner", "Provisioned intelligence user is not workspace owner");
  const workspaceId = ownerMembership.workspace_id;
  await owner.page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  await owner.page.getByText("ArtistOS", { exact: true }).first().waitFor({ timeout: 20_000 });
  record("intelligence_owner_onboarding", "Owner authenticated and received an isolated ArtistOS workspace.");

  await owner.page.goto(`${appUrl}/releases`, { waitUntil: "networkidle" });
  await owner.page.locator('select[name="artistId"]').selectOption({ index: 1 });
  await owner.page.locator('input[name="title"]').fill(names.release);
  await owner.page.locator('input[name="releaseDate"]').fill("2026-09-18");
  await owner.page.getByRole("button", { name: "Create release workspace" }).click();
  await owner.page.getByText(names.release, { exact: true }).first().waitFor({ timeout: 20_000 });

  const { data: release, error: releaseError } = await service
    .from("releases")
    .select("id,artist_id")
    .eq("workspace_id", workspaceId)
    .eq("title", names.release)
    .single();
  if (releaseError) throw releaseError;
  record("intelligence_release_created", "Owner created the canonical release record through the authenticated UI.");

  const { data: organization, error: organizationError } = await service
    .from("organizations")
    .insert({
      workspace_id: workspaceId,
      canonical_name: names.organization,
      display_name: names.organization,
      org_type: "publication",
      website: "https://example.com/artistos-network-target",
      activity_status: "active",
      trust_tier: "high",
      risk_tier: "low",
      verification_status: "verified",
      evidence_strength: 5,
      primary_source_url: "https://example.com/artistos-network-evidence",
      relationship_stage: "identified",
      next_action: "Qualify for release campaign",
    })
    .select("id")
    .single();
  if (organizationError) throw organizationError;

  await owner.page.goto(`${appUrl}/targets?q=${encodeURIComponent(names.organization)}`, { waitUntil: "networkidle" });
  await owner.page.getByText(names.organization, { exact: true }).first().waitFor({ timeout: 20_000 });
  record("network_intelligence_search", "Owner found the verified organization through workspace-scoped Network Intelligence search.");

  await owner.page.goto(`${appUrl}/campaigns`, { waitUntil: "networkidle" });
  const createCampaignForm = owner.page.locator("form").filter({ has: owner.page.getByRole("button", { name: "Create campaign" }) });
  await createCampaignForm.locator('select[name="releaseId"]').selectOption(release.id);
  await createCampaignForm.locator('input[name="name"]').fill(names.campaign);
  await createCampaignForm.locator('input[name="startDate"]').fill("2026-08-15");
  await createCampaignForm.locator('input[name="endDate"]').fill("2026-10-02");
  await createCampaignForm.locator('textarea[name="goals"]').fill("Prove the release-to-target-to-proof-to-intelligence golden path.");
  await createCampaignForm.getByRole("button", { name: "Create campaign" }).click();
  await owner.page.getByText(names.campaign, { exact: true }).first().waitFor({ timeout: 20_000 });

  const { data: campaign, error: campaignError } = await service
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", names.campaign)
    .single();
  if (campaignError) throw campaignError;
  record("campaign_intelligence_creation", "Owner created a release-linked campaign through the audited capability runtime.");

  await owner.page.goto(`${appUrl}/targets/${organization.id}`, { waitUntil: "networkidle" });
  const assignmentForm = owner.page.locator("form").filter({ has: owner.page.getByRole("button", { name: "Add to campaign" }) });
  await assignmentForm.locator('select[name="campaignId"]').selectOption(campaign.id);
  await assignmentForm.getByRole("button", { name: "Add to campaign" }).click();
  await owner.page.getByText(names.campaign, { exact: true }).first().waitFor({ timeout: 20_000 });

  const outreachForm = owner.page.locator("form").filter({ has: owner.page.getByRole("button", { name: "Record outreach and schedule follow-up" }) });
  await outreachForm.locator('select[name="campaignId"]').selectOption(campaign.id);
  await outreachForm.locator('select[name="channel"]').selectOption("email");
  await outreachForm.locator('input[name="followUpDue"]').fill("2026-08-22");
  await outreachForm.locator('input[name="subject"]').fill(names.outreach);
  await outreachForm.locator('textarea[name="body"]').fill("Evidence-first pitch recorded for the ArtistOS intelligence-loop test.");
  await outreachForm.locator('input[name="assetLink"]').fill("https://example.com/artistos-e2e-release");
  await outreachForm.getByRole("button", { name: "Record outreach and schedule follow-up" }).click();
  await owner.page.getByText(names.outreach, { exact: true }).first().waitFor({ timeout: 20_000 });

  const { data: campaignTarget, error: targetError } = await service
    .from("campaign_targets")
    .select("id,status")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .eq("target_kind", "organization")
    .eq("target_id", organization.id)
    .single();
  if (targetError) throw targetError;
  assert(campaignTarget.status === "pitched", "Recorded outreach did not move the campaign target to pitched");

  const { data: submission, error: submissionError } = await service
    .from("campaign_submissions")
    .select("id,submission_mode,status")
    .eq("workspace_id", workspaceId)
    .eq("campaign_target_id", campaignTarget.id)
    .single();
  if (submissionError) throw submissionError;
  assert(submission.submission_mode === "outreach", "Outreach receipt did not use canonical submission mode");
  assert(submission.status === "in_review", "Outreach receipt did not use canonical submission status");
  record("campaign_submission_receipt", "Target assignment and recorded outreach created a canonical submission receipt and evidence lineage.");

  await owner.page.goto(`${appUrl}/campaigns`, { waitUntil: "networkidle" });
  let campaignArticle = owner.page.locator("article").filter({ hasText: names.campaign });
  let targetCard = campaignArticle.locator(".pipeline-card").filter({ hasText: names.organization });
  await targetCard.getByText("Add deliverable", { exact: true }).click();
  await targetCard.locator('input[name="deliverableType"]').fill(names.deliverable);
  await targetCard.locator('input[name="channel"]').fill("Spotify");
  await targetCard.locator('textarea[name="description"]').fill("Verified playlist placement deliverable.");
  await targetCard.locator('input[name="dueAt"]').fill("2026-09-19T12:00");
  await targetCard.locator('select[name="status"]').last().selectOption("delivered");
  await targetCard.getByRole("button", { name: "Save deliverable" }).click();
  await owner.page.getByText(names.deliverable, { exact: true }).waitFor({ timeout: 20_000 });

  campaignArticle = owner.page.locator("article").filter({ hasText: names.campaign });
  targetCard = campaignArticle.locator(".pipeline-card").filter({ hasText: names.organization });
  await targetCard.getByText("Record outcome", { exact: true }).click();
  await targetCard.locator('input[name="outcomeType"]').fill(names.outcome);
  await targetCard.locator('input[name="outcomeDate"]').fill("2026-09-19");
  await targetCard.locator('select[name="confidence"]').selectOption("verified");
  await targetCard.locator('input[name="url"]').fill("https://example.com/artistos-verified-placement");
  await targetCard.locator('textarea[name="evidenceSummary"]').fill(names.evidence);
  await targetCard.getByRole("button", { name: "Save outcome and proof" }).click();
  await owner.page.waitForURL(/\/campaigns\?outcome=recorded$/, { timeout: 20_000 });

  const deliverable = await waitForSingle(
    () => service.from("campaign_deliverables").select("id,status").eq("workspace_id", workspaceId).eq("campaign_target_id", campaignTarget.id).maybeSingle(),
    "campaign_deliverable",
  );
  const outcome = await waitForSingle(
    () => service.from("outcomes").select("id,release_id,confidence").eq("workspace_id", workspaceId).eq("campaign_id", campaign.id).eq("outcome_type", names.outcome).maybeSingle(),
    "campaign_outcome",
  );
  const evidence = await waitForSingle(
    () => service.from("evidence_records").select("id,release_id,campaign_id,campaign_target_id,verification_status,contradiction_state").eq("workspace_id", workspaceId).eq("campaign_id", campaign.id).eq("evidence_type", "campaign_outcome").maybeSingle(),
    "campaign_outcome_evidence",
  );

  assert(deliverable.status === "delivered", "Deliverable did not preserve canonical delivered state");
  assert(outcome.release_id === release.id && outcome.confidence === "verified", "Outcome lost release lineage or verification confidence");
  assert(evidence.release_id === release.id && evidence.campaign_target_id === campaignTarget.id, "Evidence lost release or target lineage");
  assert(evidence.verification_status === "verified" && evidence.contradiction_state === "clear", "Evidence verification state is incorrect");
  record("deliverable_outcome_and_proof", "Campaign deliverable, verified outcome, and evidence receipt preserved the full release and target lineage.");

  const { error: metricsError } = await service.from("metric_snapshots").insert([
    { workspace_id: workspaceId, artist_id: release.artist_id, release_id: release.id, platform: "spotify", metric: "monthly_listeners", value: 2500, captured_on: "2026-09-18", source_url: "https://example.com/artistos-metric-source-1" },
    { workspace_id: workspaceId, artist_id: release.artist_id, release_id: release.id, platform: "spotify", metric: "monthly_listeners", value: 3000, captured_on: "2026-09-25", source_url: "https://example.com/artistos-metric-source-2" },
  ]);
  if (metricsError) throw metricsError;

  await owner.page.goto(`${appUrl}/proof`, { waitUntil: "networkidle" });
  await owner.page.getByRole("heading", { name: "ArtistOS Proof" }).waitFor({ timeout: 20_000 });
  await owner.page.getByText(names.evidence, { exact: true }).waitFor({ timeout: 20_000 });
  await owner.page.screenshot({ path: path.join(outputDir, "owner-proof.png"), fullPage: true });

  await owner.page.goto(`${appUrl}/analytics`, { waitUntil: "networkidle" });
  await owner.page.getByRole("heading", { name: "Music Intelligence" }).waitFor({ timeout: 20_000 });
  await owner.page.getByText("Rising", { exact: true }).first().waitFor({ timeout: 20_000 });
  await owner.page.getByText(names.release, { exact: true }).first().waitFor({ timeout: 20_000 });
  await owner.page.screenshot({ path: path.join(outputDir, "owner-music-intelligence.png"), fullPage: true });
  record("proof_and_music_intelligence_render", "Proof and Music Intelligence rendered the verified campaign outcome and rising release signal.");

  const { error: viewerMembershipError } = await service.from("workspace_members").insert({ workspace_id: workspaceId, user_id: viewerUser.id, role: "viewer" });
  if (viewerMembershipError) throw viewerMembershipError;
  const viewer = await signInPage(browser, users.viewer.email);
  for (const [route, text] of [["/campaigns", names.campaign], ["/targets", names.organization], ["/proof", names.evidence], ["/analytics", names.release]]) {
    await viewer.page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
    await viewer.page.getByText(text, { exact: true }).first().waitFor({ timeout: 20_000 });
  }
  const viewerClient = await signInClient(users.viewer.email);
  const { error: viewerCampaignWrite } = await viewerClient.from("campaigns").insert({ workspace_id: workspaceId, release_id: release.id, name: "Viewer write must fail", status: "active" });
  const { error: viewerEvidenceWrite } = await viewerClient.from("evidence_records").insert({ workspace_id: workspaceId, summary: "Viewer evidence write must fail", confidence: "unknown" });
  assert(viewerCampaignWrite, "Viewer campaign write unexpectedly succeeded");
  assert(viewerEvidenceWrite, "Viewer evidence write unexpectedly succeeded");
  record("intelligence_viewer_read_only", "Viewer could read Campaign, Network, Proof, and Music Intelligence but direct writes were denied.");

  const outsider = await signInPage(browser, users.outsider.email);
  for (const [route, hiddenText] of [["/campaigns", names.campaign], ["/targets", names.organization], ["/proof", names.evidence], ["/analytics", names.release]]) {
    await outsider.page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
    assert(!(await outsider.page.locator("body").innerText()).includes(hiddenText), `Outsider saw protected data on ${route}`);
  }
  const outsiderClient = await signInClient(users.outsider.email);
  const protectedTables = ["campaigns", "campaign_targets", "organizations", "campaign_submissions", "campaign_deliverables", "outcomes", "evidence_records", "metric_snapshots"];
  for (const table of protectedTables) {
    const { data, error } = await outsiderClient.from(table).select("id").eq("workspace_id", workspaceId);
    if (error) throw error;
    assert((data ?? []).length === 0, `Outsider queried protected rows from ${table}`);
  }
  record("intelligence_outsider_isolation", "Independent workspace could not render or query the owner intelligence graph.");

  const counts = {
    campaigns: await count("campaigns", workspaceId),
    campaign_targets: await count("campaign_targets", workspaceId),
    campaign_submissions: await count("campaign_submissions", workspaceId),
    campaign_deliverables: await count("campaign_deliverables", workspaceId),
    outcomes: await count("outcomes", workspaceId),
    evidence_records: await count("evidence_records", workspaceId),
    metric_snapshots: await count("metric_snapshots", workspaceId),
    capability_audit_log: await count("capability_audit_log", workspaceId),
    capability_idempotency: await count("capability_idempotency", workspaceId),
  };
  assert(counts.campaigns >= 1, "Campaign was not persisted");
  assert(counts.campaign_targets >= 1, "Campaign target was not persisted");
  assert(counts.campaign_submissions >= 1, "Submission receipt was not persisted");
  assert(counts.campaign_deliverables >= 1, "Campaign deliverable was not persisted");
  assert(counts.outcomes >= 1, "Campaign outcome was not persisted");
  assert(counts.evidence_records >= 2, "Submission and outcome evidence were not persisted");
  assert(counts.metric_snapshots >= 2, "Music Intelligence snapshots were not persisted");
  assert(counts.capability_audit_log >= 5, "Intelligence capability audit receipts were not persisted");
  assert(counts.capability_idempotency >= 5, "Intelligence idempotency receipts were not persisted");
  record("intelligence_durable_control_plane", "The complete intelligence loop persisted business data, evidence, audit, and idempotency records.");

  await Promise.all([owner.context.close(), viewer.context.close(), outsider.context.close()]);
  await browser.close();
  browser = null;

  const report = {
    schema_version: 1,
    status: "PASS",
    summary: "Campaign Intelligence, Network Intelligence, ArtistOS Proof, and Music Intelligence passed authenticated owner, viewer, and outsider journeys against a disposable database.",
    source_commit: process.env.GITHUB_SHA ?? null,
    completed_at: new Date().toISOString(),
    run_id: process.env.GITHUB_RUN_ID ?? "local",
    base_url: appUrl,
    journeys,
    counts,
    screenshots: ["owner-proof.png", "owner-music-intelligence.png"],
    production_mutated: false,
  };
  fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (browser) await browser.close().catch(() => {});
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
