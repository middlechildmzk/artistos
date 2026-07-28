import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const tour = read("app/tour/page.tsx");
const login = read("app/login/page.tsx");

test("public product tour is explicitly read-only sample data", () => {
  assert.match(tour, /Guided product tour/);
  assert.match(tour, /Representative data only/);
  assert.match(tour, /No live records or actions/);
});

test("product tour demonstrates the connected ArtistOS workflow", () => {
  for (const label of ["Opportunity Intelligence", "Artist Brain", "Campaign Intelligence", "AI Manager"]) {
    assert.match(tour, new RegExp(label));
  }
  assert.match(tour, /Plan → review → execute → measure → learn/);
  assert.match(tour, /Never Alone/);
});

test("login exposes the guided tour without weakening authentication", () => {
  assert.match(login, /href="\/tour"/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /signInWithOtp/);
});
