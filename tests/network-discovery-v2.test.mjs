import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

async function loadTypeScriptModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, strict: true },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const identity = await loadTypeScriptModule("lib/network-intelligence/source-runtime/identity.ts");
const radio = await loadTypeScriptModule("lib/network-intelligence/source-runtime/radio-browser-helpers.ts");
const wikidata = await loadTypeScriptModule("lib/network-intelligence/source-runtime/wikidata-helpers.ts");
const policy = await loadTypeScriptModule("lib/network-intelligence/source-runtime/policy.ts");
const read = (file) => fs.readFileSync(file, "utf8");
const core = read("lib/network-intelligence/source-runtime/core.ts");
const executor = read("lib/capabilities/opportunity-handlers/execute-search.ts");
const migration = read("supabase/migrations/20260805150000_network_discovery_v2.sql");
const page = read("app/opportunities/page.tsx");

function claimString(value) {
  return { mainsnak: { datavalue: { value } } };
}

function claimEntity(id) {
  return { mainsnak: { datavalue: { value: { id } } } };
}

function candidate(sourceSlug, externalId, url, title = "Example Radio") {
  const observation = {
    sourceSlug,
    sourcePolicyDisposition: "accept_verified_source",
    externalId,
    canonicalUrl: sourceSlug === "wikidata" ? `https://www.wikidata.org/wiki/${externalId}` : `https://de1.api.radio-browser.info/json/stations/byuuid?uuids=${externalId}`,
    observedAt: "2026-08-05T12:00:00.000Z",
    identityUrls: [url],
    externalIdentifiers: sourceSlug === "wikidata" ? { wikidata_id: externalId } : { radio_browser_station_uuid: externalId },
    rawPayload: {},
    normalizedPayload: {},
  };
  const base = {
    sourceSlug,
    sourcePolicyDisposition: "accept_verified_source",
    externalId,
    canonicalUrl: url,
    title,
    summary: null,
    candidateKind: "property",
    opportunityType: "radio",
    observedAt: observation.observedAt,
    freshnessStatus: "unknown",
    confidence: "weak",
    legitimacyStatus: "unreviewed",
    audienceSignal: null,
    fitScore: 50,
    legitimacyScore: null,
    reachQualityScore: null,
    accessibilityScore: null,
    relationshipScore: null,
    riskScore: null,
    riskFlags: ["submission_route_unverified"],
    eligibility: { actionable_route: false },
    scoreFeatures: [],
    rawPayload: {},
    normalizedPayload: {},
    identityUrls: [url],
    externalIdentifiers: observation.externalIdentifiers,
    discoveryClusterKey: "",
    corroboratingSources: [sourceSlug],
    sourceObservations: [observation],
  };
  return { ...base, discoveryClusterKey: identity.identityClusterKey(base) };
}

test("Radio Browser query planning prefers call signs and otherwise uses a bounded context tag", () => {
  const callSign = radio.radioBrowserSearchParams("Pitch Never Alone to KEXP radio", "melodic bass");
  assert.equal(callSign.get("name"), "KEXP");
  assert.equal(callSign.get("tag"), null);
  const edm = radio.radioBrowserSearchParams("EDM radio stations", "melodic bass");
  assert.equal(edm.get("name"), null);
  assert.equal(edm.get("tag"), "edm");
  const tag = radio.radioBrowserSearchParams("active radio stations accepting released music", "melodic bass electronic");
  assert.equal(tag.get("tag"), "melodic");
  assert.equal(tag.get("hidebroken"), "true");
});

test("Radio Browser freshness is source-visible and stream-health aware", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");
  assert.equal(radio.radioFreshness("2026-08-04T12:00:00.000Z", true, now), "current");
  assert.equal(radio.radioFreshness("2026-07-20T12:00:00.000Z", true, now), "aging");
  assert.equal(radio.radioFreshness("2026-06-01T12:00:00.000Z", true, now), "stale");
  assert.equal(radio.radioFreshness("2026-08-04T12:00:00.000Z", false, now), "stale");
});

test("Wikidata enrichment extracts official websites, external IDs, and entity class", () => {
  const entity = { claims: {
    P31: [claimEntity("Q14350")],
    P856: [claimString("https://station.example/")],
    P434: [claimString("artist-mbid")],
    P2397: [claimString("UC123")],
  } };
  assert.deepEqual(wikidata.wikidataClaimStrings(entity, "P856"), ["https://station.example/"]);
  assert.equal(wikidata.wikidataCandidateKind(entity, "radio"), "property");
  assert.deepEqual(wikidata.wikidataExternalIdentifiers(entity, "Q123"), {
    wikidata_id: "Q123",
    musicbrainz_artist_id: "artist-mbid",
    youtube_channel_id: "UC123",
  });
});

test("approved sources sharing an official identity URL become one corroborated candidate", () => {
  const clustered = identity.mergeCandidateClusters([
    candidate("wikidata", "Q123", "https://station.example/"),
    candidate("radio_browser", "station-uuid", "https://www.station.example"),
  ]);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].confidence, "supported");
  assert.deepEqual(clustered[0].corroboratingSources.sort(), ["radio_browser", "wikidata"]);
  assert.equal(clustered[0].sourceObservations.length, 2);
  assert.match(clustered[0].discoveryClusterKey, /^url:station\.example/);
  assert.equal(clustered[0].scoreFeatures.at(-1).key, "cross_source_corroboration");
});

test("different official URLs stay separate even when names are identical", () => {
  const clustered = identity.mergeCandidateClusters([
    candidate("wikidata", "Q123", "https://one.example/", "Shared Name"),
    candidate("radio_browser", "station-uuid", "https://two.example/", "Shared Name"),
  ]);
  assert.equal(clustered.length, 2);
});

test("Radio Browser is executable while X, MusicBrainz, Podcast Index, and YouTube remain policy blocked", () => {
  assert.equal(policy.policyAllowsExecution(policy.SOURCE_POLICIES.radio_browser), true);
  assert.equal(policy.policySupportsLane(policy.SOURCE_POLICIES.radio_browser, "radio"), true);
  assert.equal(policy.policySupportsLane(policy.SOURCE_POLICIES.radio_browser, "podcast"), false);
  for (const slug of ["x", "musicbrainz", "podcast_index", "youtube"]) {
    assert.equal(policy.policyAllowsExecution(policy.SOURCE_POLICIES[slug]), false);
  }
});

test("V2 plans and runs expose request cost, source compatibility, and clustered evidence", () => {
  assert.match(core, /planVersion: "network-source-runtime-v2"/);
  assert.match(core, /queryVariants/);
  assert.match(core, /estimatedRequestCount/);
  assert.match(core, /policySupportsLane/);
  assert.match(core, /mergeCandidateClusters/);
  assert.match(executor, /candidate\.sourceObservations/);
  assert.match(executor, /candidateEvidenceIds/);
  assert.match(executor, /discovery_cluster_key/);
  assert.match(executor, /actual_request_count/);
});

test("V2 schema preserves identity clusters, source observations, and request transparency", () => {
  for (const field of ["estimated_request_count", "actual_request_count", "source_cost_summary", "discovery_cluster_key", "corroborating_sources", "corroboration_count", "identity_urls", "external_identifiers"]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /opportunities_discovery_cluster_idx/);
  assert.match(page, /Cross-source matches/);
  assert.match(page, /Est\. \{plan\?\.estimatedRequestCount/);
  assert.match(page, /sources corroborate identity/);
});
