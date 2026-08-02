import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/integrations/page.tsx", "utf8");

test("Integration Hub preserves truthful provider states", () => {
  for (const state of ["Provider verified", "Authorized", "Configured", "Identity verified", "Export workflow", "Partner access", "Human-approved", "Needs owner action"]) assert.match(page, new RegExp(state));
  assert.match(page, /isCurrentTokenEnvelope/);
  assert.match(page, /last_success_at/);
  assert.match(page, /No safe external identity is stored/);
});

test("Integration Hub covers the artist operating system lanes", () => {
  for (const lane of ["Connected intelligence and owned data", "Licensed and partner integrations", "Submission and pitching desk", "Creator Studio and publishing"]) assert.match(page, new RegExp(lane));
  for (const provider of ["Soundcharts", "Spotontrack", "Chartmetric", "Viberate", "Songstats", "LANDR", "SubmitHub", "Groover", "One Submit", "PlaylistPitch", "Spotify editorial pitch"]) assert.match(page, new RegExp(provider));
});

test("Integration Hub keeps consequential execution human controlled", () => {
  assert.match(page, /Final portal submission stays human-controlled/);
  assert.match(page, /Publishing always requires human approval/);
  assert.match(page, /must not claim these channels connected beforehand/);
  assert.match(page, /One graph, no duplicate products/);
});
