import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");

test("private dashboard unifies releases, metrics, sources, audience, network, and proof", () => {
  assert.match(dashboard, /Private artist workspace/);
  assert.match(dashboard, /Source health/);
  assert.match(dashboard, /Imported fan records/);
  assert.match(dashboard, /metric_snapshots/);
  assert.match(dashboard, /oauth_connections/);
  assert.match(dashboard, /artist_platform_profiles/);
  assert.match(dashboard, /href="\/releases"/);
  assert.match(dashboard, /href="\/connections"/);
  assert.match(dashboard, /href="\/analytics"/);
  assert.match(dashboard, /href="\/campaigns"/);
  assert.match(dashboard, /href="\/links"/);
  assert.match(dashboard, /href="\/proof"/);
  assert.match(dashboard, /href="\/brain"/);
});

test("dashboard does not overstate imported fans as contactable", () => {
  assert.doesNotMatch(dashboard, /<div className="eyebrow">Contactable fans<\/div>/);
  assert.match(dashboard, /suppression and consent must still be checked before sending/);
});
