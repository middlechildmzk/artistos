import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const tour = read("app/tour/page.tsx");
const login = read("app/login/page.tsx");

test("public product tour is clearly a sample experience", () => {
  assert.match(tour, /Sample release/);
  assert.match(tour, /Never Alone/);
  assert.doesNotMatch(tour, /createSupabaseServerClient|invokeCapability|action=/);
});

test("product tour demonstrates the connected ArtistOS workflow", () => {
  for (const label of ["Start with the release", "Find where it belongs", "Run the campaign", "Record what happened", "Make the next release smarter"]) {
    assert.match(tour, new RegExp(label));
  }
  assert.match(tour, /ArtistOS Network/);
  assert.match(tour, /Best next move/);
});

test("login exposes the product tour without weakening authentication", () => {
  assert.match(login, /href="\/tour"/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /signInWithOtp/);
});
