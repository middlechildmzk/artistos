import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/opportunities/page.tsx", "utf8");
const directory = fs.readFileSync("app/opportunities/opportunity-directory.tsx", "utf8");
const actions = fs.readFileSync("app/opportunities/actions.ts", "utf8");
const css = fs.readFileSync("app/opportunities/opportunities.css", "utf8");

test("discovery workbench uses one-click external search and a compact browse surface", () => {
  assert.match(page, /action=\{searchOpportunityDirectory\}/);
  assert.match(page, /Research more opportunities/);
  assert.match(page, /Browse opportunities/);
  assert.match(page, /<details className="search-command-card">/);
  assert.doesNotMatch(page, /Source advantage/);
  assert.doesNotMatch(page, /Clustered discoveries/);
  assert.match(actions, /opportunity\.create_search/);
  assert.match(actions, /opportunity\.execute_search/);
});

test("directory offers clean artist-facing filters and useful sort choices", () => {
  for (const term of ["Genre or mood", "All countries", "All languages", "Submission route", "Release match", "Last checked", "Minimum audience", "Best match", "Submission-ready", "Largest audience", "Recently checked"]) assert.match(directory, new RegExp(term));
  assert.match(page, /clickcount/);
  assert.match(page, /votes/);
  assert.match(directory, /minimumPopularity/);
  assert.match(directory, /opportunity-genres/);
  assert.doesNotMatch(directory, />All sources</);
  assert.doesNotMatch(directory, />Review status</);
});

test("large research intakes are fully paged, quality-ranked, and follower-aware", () => {
  assert.match(page, /databasePageSize = 1000/);
  assert.match(page, /fetchAllOpportunities/);
  assert.match(page, /fetchAllObservations/);
  assert.match(page, /\.range\(from, from \+ databasePageSize - 1\)/);
  assert.match(page, /quality_rank/);
  assert.match(page, /normalized\.followers/);
  assert.match(page, /compactNumber\(followers\).*followers/);
});

test("the directory summarizes every active category without rendering the entire dataset at once", () => {
  assert.match(directory, /Opportunity directory/);
  assert.match(directory, /Submission routes/);
  assert.match(directory, /activeTypes/);
  assert.match(directory, /resultPageSize = 60/);
  assert.match(directory, /filtered\.slice\(0, visibleCount\)/);
  assert.match(directory, /Show \{Math\.min/);
  assert.doesNotMatch(directory, /Dataset at a glance/);
  assert.doesNotMatch(directory, /Private research workspace/);
});

test("submission routes stay clear without exposing pipeline review language", () => {
  assert.match(directory, /Free submission/);
  assert.match(directory, /Paid submission/);
  assert.match(directory, /submissionRouteUrl/);
  assert.match(directory, /A direct submission route has not been confirmed yet/);
  assert.match(directory, /Submission details can change/);
  assert.doesNotMatch(directory, />Needs verification</);
});

test("release-aware builds keep the persistent left filters as the primary browse surface", () => {
  assert.match(directory, /directory-sidebar/);
  assert.match(directory, /Release match/);
  assert.match(directory, /Recommended for this release/);
  assert.match(directory, /releaseFit === "shortlisted"/);
});

test("details and record management move into a dedicated slide-over drawer", () => {
  assert.match(directory, /opportunity-drawer/);
  assert.match(directory, /Research details/);
  assert.match(directory, /Manage record/);
  assert.match(directory, /event\.key === "Escape"/);
  assert.match(directory, /reviewOpportunity/);
  assert.match(directory, /requestOpportunityPromotion/);
  assert.match(css, /opportunity-drawer-layer/);
  assert.match(css, /directory-sidebar/);
  assert.match(css, /filter-backdrop/);
});

test("messy intake values are normalized before they reach user controls or cards", () => {
  assert.match(directory, /tagAliases/);
  assert.match(directory, /internalLabelPattern/);
  assert.match(directory, /normalizeLanguage/);
  assert.match(directory, /\["en", "eng", "english", "english uk"/);
  assert.match(directory, /return mapped\.length > 1 \? "Multilingual"/);
  assert.match(directory, /browsableItems/);
  assert.doesNotMatch(directory, /source-info-panel/);
});
