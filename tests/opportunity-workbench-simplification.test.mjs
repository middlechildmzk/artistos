import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/opportunities/page.tsx", "utf8");
const directory = fs.readFileSync("app/opportunities/opportunity-directory.tsx", "utf8");
const actions = fs.readFileSync("app/opportunities/actions.ts", "utf8");
const css = fs.readFileSync("app/opportunities/opportunities.css", "utf8");

test("discovery workbench uses one-click external search and a compact browse surface", () => {
  assert.match(page, /action=\{searchOpportunityDirectory\}/);
  assert.match(page, /Search new sources/);
  assert.match(page, /Browse everything collected/);
  assert.doesNotMatch(page, /Source advantage/);
  assert.doesNotMatch(page, /Clustered discoveries/);
  assert.match(actions, /opportunity\.create_search/);
  assert.match(actions, /opportunity\.execute_search/);
});

test("directory offers category, genre, geography, language, source, status, activity and popularity filters", () => {
  for (const term of ["All genres", "All countries", "All languages", "All sources", "Most popular", "Best fit", "Most active", "Popularity signal", "Online now"]) assert.match(directory, new RegExp(term));
  assert.match(page, /clickcount/);
  assert.match(page, /votes/);
  assert.match(directory, /minimumPopularity/);
});

test("release-aware builds keep the persistent left filters as the primary browse surface", () => {
  assert.match(directory, /directory-sidebar/);
  assert.match(directory, /Release fit/);
  assert.match(directory, /Explainable matches/);
  assert.match(directory, /releaseFit === "shortlisted"/);
});

test("trust and review detail move into a dedicated slide-over drawer", () => {
  assert.match(directory, /opportunity-drawer/);
  assert.match(directory, /Identity evidence/);
  assert.match(directory, /reviewOpportunity/);
  assert.match(directory, /requestOpportunityPromotion/);
  assert.match(css, /opportunity-drawer-layer/);
  assert.match(css, /directory-sidebar/);
  assert.match(css, /filter-backdrop/);
});
