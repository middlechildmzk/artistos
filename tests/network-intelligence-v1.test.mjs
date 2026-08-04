import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/targets/page.tsx", "utf8");

test("Network Intelligence supports recruiter-style music industry sourcing", () => {
  for (const phrase of [
    "Music industry sourcing",
    "Source music-industry targets",
    "Target type",
    "Platform",
    "Public contact route",
    "Activity",
    "Qualified target results",
  ]) assert.match(page, new RegExp(phrase));

  for (const target of ["Playlist or curator", "Creator or influencer", "Radio", "Sync or licensing", "Label"]) {
    assert.match(page, new RegExp(target));
  }

  for (const platform of ["Spotify", "YouTube", "Instagram", "TikTok", "SoundCloud", "Apple Music"]) {
    assert.match(page, new RegExp(platform));
  }
});

test("results combine organizations, properties, people, and submission routes", () => {
  assert.match(page, /from\("organizations"\)/);
  assert.match(page, /from\("properties"\)/);
  assert.match(page, /from\("people"\)/);
  assert.match(page, /from\("submission_endpoints"\)/);
  assert.match(page, /propertiesByOrganization/);
  assert.match(page, /peopleByOrganization/);
  assert.match(page, /endpointsByOrganization/);
  assert.match(page, /followers_estimate/);
  assert.match(page, /genre_tags/);
});

test("contact discovery remains evidence-first and workspace private", () => {
  assert.match(page, /eq\("workspace_id", workspaceId\)/);
  assert.match(page, /public or manually confirmed/);
  assert.match(page, /remain private to the workspace/);
  assert.match(page, /No contact route/);
  assert.doesNotMatch(page, /scrape|autonomous outreach|send automatically/i);
});
