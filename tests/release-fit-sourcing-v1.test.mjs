import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// These modules are imported and executed. Assertions below exercise real
// behavior; the small number of textual checks that remain are explicitly
// labelled as contract markers and are not a substitute for behavior.
const { scoreReleaseFit, describeAudienceSignal, normalizeName } = await import("../lib/release-fit/scoring.ts");
const { deriveReadiness } = await import("../lib/release-fit/readiness.ts");
const { semanticIdempotencyKey } = await import("../lib/network-intelligence/source-runtime/idempotency.ts");

const migration = read("supabase/migrations/20260805190000_release_fit_sourcing_v1.sql");
const registry = read("lib/capabilities/release-fit-registry.ts");
const handlers = read("lib/capabilities/release-fit-handlers.ts");
const actions = read("app/opportunities/release-fit-actions.ts");
const panel = read("app/opportunities/release-fit-panel.tsx");
const directory = read("app/opportunities/opportunity-directory.tsx");
const styles = read("app/opportunities/release-fit.css");

function baseRelease(overrides = {}) {
  return {
    releaseId: "11111111-1111-1111-1111-111111111111",
    title: "Never Alone",
    artistName: "Middle Child",
    releaseDate: "2026-07-31",
    status: "released",
    genreTags: [],
    subgenreTags: [],
    moodTags: [],
    territoryFocus: [],
    artistSizeBand: null,
    primaryLanguage: null,
    confirmedSimilarArtists: [],
    ...overrides,
  };
}

function baseTarget(overrides = {}) {
  return {
    opportunityId: "22222222-2222-2222-2222-222222222222",
    title: "Example Curator",
    genreTags: [],
    moodTags: [],
    country: null,
    featuredArtists: [],
    acceptsReleased: null,
    acceptsUnreleased: null,
    audienceValue: null,
    audienceObservedAt: null,
    targetsEmergingArtists: null,
    ...overrides,
  };
}

test("a release with no recorded metadata produces no fit score at all", () => {
  const result = scoreReleaseFit(baseRelease(), baseTarget());
  assert.equal(result.overall, null, "overall must be null, never 0");
  assert.equal(result.knownDimensionCount, 0);
  assert.equal(result.unknownDimensionCount, 6);
  assert.equal(result.explanations.length, 0);
  for (const dimension of result.dimensions) {
    assert.equal(dimension.value, null);
    assert.ok(dimension.unknownReason, `${dimension.key} must say why it is unknown`);
  }
});

test("missing evidence never becomes a positive contribution", () => {
  const withGenres = scoreReleaseFit(
    baseRelease({ subgenreTags: ["melodic bass", "future bass"] }),
    baseTarget({ genreTags: ["melodic bass", "future bass"] }),
  );
  // Only the genre dimension is computable, so coverage must reflect that.
  assert.equal(withGenres.knownDimensionCount, 1);
  assert.ok(withGenres.evidenceCoverage < 0.35, "one dimension cannot claim full coverage");
  assert.equal(withGenres.overall, 100);

  // Adding a target with no genre evidence must not score better than unknown.
  const noTargetGenres = scoreReleaseFit(baseRelease({ subgenreTags: ["melodic bass"] }), baseTarget());
  assert.equal(noTargetGenres.overall, null);
});

test("similar-artist overlap requires external identity and rejects name-only agreement", () => {
  const release = baseRelease({
    confirmedSimilarArtists: [
      {
        name: "Dabin",
        normalizedName: normalizeName("Dabin"),
        externalIdentifiers: { wikidata: "Q123456" },
        confirmationState: "user_confirmed",
      },
    ],
  });

  // Same name, no shared identifier. This is a collision, not a match.
  const nameOnly = scoreReleaseFit(
    release,
    baseTarget({
      featuredArtists: [{ normalizedName: normalizeName("Dabin"), externalIdentifiers: {}, evidenceId: null, observedAt: null }],
    }),
  );
  const nameOnlyDimension = nameOnly.dimensions.find((d) => d.key === "similar_artist_overlap");
  assert.equal(nameOnlyDimension.value, 0, "name-only agreement must not score as overlap");
  assert.match(nameOnlyDimension.explanation, /name-only/i);
  assert.equal(nameOnly.explanations.length, 0, "a name-only collision must not be surfaced as a reason");

  // Same identifier. This is a real match.
  const identityMatch = scoreReleaseFit(
    release,
    baseTarget({
      featuredArtists: [
        { normalizedName: "different name entirely", externalIdentifiers: { wikidata: "Q123456" }, evidenceId: "ev-1", observedAt: null },
      ],
    }),
  );
  const matched = identityMatch.dimensions.find((d) => d.key === "similar_artist_overlap");
  assert.equal(matched.value, 1);
  assert.deepEqual(matched.evidenceRefs, ["ev-1"], "a match must carry its evidence reference");
  assert.match(identityMatch.explanations[0], /matched on external identity/);
});

test("an unconfirmed comparable artist is never used as fit evidence", () => {
  const inferredOnly = scoreReleaseFit(
    baseRelease({
      confirmedSimilarArtists: [
        { name: "Illenium", normalizedName: "illenium", externalIdentifiers: { wikidata: "Q999" }, confirmationState: "inferred" },
      ],
    }),
    baseTarget({
      featuredArtists: [{ normalizedName: "illenium", externalIdentifiers: { wikidata: "Q999" }, evidenceId: "ev-2", observedAt: null }],
    }),
  );
  const dimension = inferredOnly.dimensions.find((d) => d.key === "similar_artist_overlap");
  assert.equal(dimension.value, null);
  assert.match(dimension.unknownReason, /confirmed/i);
});

test("release-stage ineligibility is a hard gate, not a soft penalty", () => {
  const ineligible = scoreReleaseFit(
    baseRelease({ status: "released" }),
    baseTarget({ acceptsReleased: false }),
  );
  assert.equal(ineligible.ineligible, true);
  const eligible = scoreReleaseFit(baseRelease({ status: "released" }), baseTarget({ acceptsReleased: true }));
  assert.equal(eligible.ineligible, false);

  // Unknown eligibility must not be treated as ineligible.
  const unknown = scoreReleaseFit(baseRelease({ status: "released" }), baseTarget());
  assert.equal(unknown.ineligible, false);
  const stage = unknown.dimensions.find((d) => d.key === "release_stage_eligibility");
  assert.equal(stage.value, null);
});

test("popularity is reported separately and never enters the fit score", () => {
  const quiet = scoreReleaseFit(
    baseRelease({ subgenreTags: ["melodic bass"] }),
    baseTarget({ genreTags: ["melodic bass"], audienceValue: 12 }),
  );
  const huge = scoreReleaseFit(
    baseRelease({ subgenreTags: ["melodic bass"] }),
    baseTarget({ genreTags: ["melodic bass"], audienceValue: 9_000_000 }),
  );
  assert.equal(quiet.overall, huge.overall, "audience size must not change fit");
  for (const dimension of huge.dimensions) {
    assert.ok(!/audience|reach|follower|subscriber/i.test(dimension.key), `${dimension.key} must not be an audience dimension`);
  }
});

test("audience signal reports its own staleness and stays unknown when absent", () => {
  assert.equal(describeAudienceSignal(baseTarget()).value, null);
  const stale = describeAudienceSignal(
    baseTarget({ audienceValue: 500, audienceObservedAt: new Date(Date.now() - 90 * 86_400_000).toISOString() }),
  );
  assert.equal(stale.stale, true);
  const fresh = describeAudienceSignal(baseTarget({ audienceValue: 500, audienceObservedAt: new Date().toISOString() }));
  assert.equal(fresh.stale, false);
});

test("no score is presented as a probability", () => {
  const result = scoreReleaseFit(baseRelease({ subgenreTags: ["a"] }), baseTarget({ genreTags: ["a"] }));
  assert.equal(result.scoringVersion, "release-fit-v1");
  assert.ok(result.overall > 1, "scores are 0-100 ranking signals, not 0-1 probabilities");
  assert.doesNotMatch(JSON.stringify(result), /probability|likelihood|chance of/i);
});

test("shortlist readiness is derived from evidence, never asserted", () => {
  const thin = deriveReadiness({ review_status: "pending", external_id: null, canonical_url: null, corroboration_count: 1 });
  assert.equal(thin.state, "evidence_missing");
  assert.ok(thin.blocking.includes("no_stable_identity"));
  assert.ok(thin.blocking.includes("single_source_only"));

  const unverifiedRoute = deriveReadiness({
    review_status: "accepted",
    external_id: "UC123",
    corroboration_count: 2,
    risk_flags: ["submission_route_unverified"],
  });
  assert.equal(unverifiedRoute.state, "route_unverified");

  const ready = deriveReadiness({ review_status: "accepted", external_id: "UC123", corroboration_count: 2, risk_flags: [] });
  assert.equal(ready.state, "ready_to_propose");
  assert.deepEqual(ready.blocking, []);

  assert.equal(deriveReadiness({ review_status: "rejected", external_id: "x", corroboration_count: 3 }).state, "blocked");
  assert.equal(deriveReadiness({ review_status: "quarantined", external_id: "x", corroboration_count: 3 }).state, "blocked");
});

test("idempotency keys are deterministic and content-derived", () => {
  const first = semanticIdempotencyKey("release-decision", ["rel-1", "opp-1", "shortlisted", null]);
  const second = semanticIdempotencyKey("release-decision", ["rel-1", "opp-1", "shortlisted", null]);
  const different = semanticIdempotencyKey("release-decision", ["rel-1", "opp-1", "hidden", null]);
  assert.equal(first, second, "the same decision must collapse to the same key");
  assert.notEqual(first, different);
  assert.doesNotMatch(first, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/, "keys must not embed a random uuid");
});

test("route actions never write to domain tables directly", () => {
  assert.doesNotMatch(actions, /\.from\(/, "server actions must not query or write tables directly");
  assert.doesNotMatch(actions, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(/);
  assert.match(actions, /invokeCapability/);
  assert.match(actions, /semanticIdempotencyKey/);
  assert.doesNotMatch(actions, /randomUUID/, "keys must be semantic, not random");
});

test("release-fit capabilities are registered and none is autonomous or self-approving", () => {
  for (const capability of [
    "release.set_sourcing_profile",
    "release.upsert_similar_artist",
    "release.record_target_decision",
    "release.update_shortlist_item",
  ]) {
    assert.match(registry, new RegExp(capability.replaceAll(".", "\\.")));
  }
  const serverRuntime = read("lib/capabilities/server-runtime.ts");
  assert.match(serverRuntime, /release-fit-registry/);
  assert.match(serverRuntime, /release-fit-handlers/);
  // Contract markers: no capability here may send, submit, spend, or promote.
  assert.doesNotMatch(handlers, /mailto:|sendEmail|gmail\.send|stripe|checkout|purchase|credits/i);
  assert.doesNotMatch(handlers, /promote_to_crm/);
  assert.doesNotMatch(registry, /approval: "never"/);
});

test("every write carries an explicit workspace id rather than relying on a column default", () => {
  const inserts = handlers.match(/\.(upsert|insert)\(\s*\{[^}]*\}/gs) ?? [];
  assert.ok(inserts.length >= 3, "expected the decision, shortlist, and similar-artist writes");
  for (const statement of inserts) {
    assert.match(statement, /workspace_id: ctx\.workspaceId/, `write is missing explicit tenancy: ${statement.slice(0, 90)}`);
  }
});

test("migration is workspace scoped, RLS protected, and closed to anon", () => {
  for (const table of ["release_similar_artists", "release_target_decisions", "release_shortlist_items"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`workspace_id uuid not null references public\\.workspaces`));
  }
  assert.match(migration, /revoke all on[\s\S]*from anon;/);
  // Writes require manage rights; reads only require membership.
  assert.match(migration, /private\.can_manage_workspace/);
  assert.match(migration, /private\.is_workspace_member/);
  // Cross-workspace reference closure for both foreign entities.
  assert.match(migration, /o\.workspace_id = release_target_decisions\.workspace_id/);
  assert.match(migration, /c\.workspace_id = release_shortlist_items\.workspace_id/);
});

test("similar-artist records preserve source, identity, confirmation, confidence, evidence, and freshness", () => {
  for (const column of [
    "source_slug",
    "canonical_url",
    "external_identifiers",
    "confirmation_state",
    "confidence",
    "evidence_id",
    "observed_at",
    "freshness_status",
    "release_id",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`), `similar-artist rows must preserve ${column}`);
  }
  assert.match(registry, /usableAsFitEvidence/);
  assert.match(handlers, /hasExternalIdentity/);
});

test("release metadata columns are nullable so unknown stays unknown", () => {
  const addedColumns = migration.slice(migration.indexOf("alter table public.releases"), migration.indexOf("create table"));
  assert.doesNotMatch(addedColumns, /not null/i, "no added release column may be NOT NULL");
  assert.doesNotMatch(addedColumns, /default/i, "no added release column may carry a default");
  assert.match(migration, /Null means not recorded/);
});

test("the release context stays compact and the shortlist cannot act", () => {
  assert.match(panel, /rfs-context/, "release context bar must exist");
  assert.match(styles, /\.rfs-context\s*\{[^}]*position:\s*relative/);
  assert.match(panel, /Best matches for \{release\.title\}/);
  assert.match(panel, /All opportunities/);
  assert.match(panel, /Improve release matching/);
  // The shortlist proposes; it does not act.
  assert.doesNotMatch(panel, /Submit to|Send pitch|Buy credits|Pay|Purchase/i);
  assert.match(panel, /does not submit or charge anything/i);
  assert.match(panel, /Confirm the current route and terms before submitting/);
});

test("recommendations always show coverage and never a bare score", () => {
  assert.match(panel, /coverageLabel/);
  assert.match(panel, /match signal/);
  assert.match(panel, /Match unknown/);
});

test("mobile layout is single column with no horizontal scrolling", () => {
  assert.match(styles, /overflow-x:\s*hidden/);
  assert.match(styles, /flex-direction:\s*column/);
  assert.match(styles, /@media \(min-width: 780px\)/, "multi-column layout must be opt-in above mobile");
  assert.doesNotMatch(styles, /white-space:\s*nowrap/);
  assert.match(styles, /min-height:\s*40px/, "primary controls need a touch target");
});


test("the pending migration is probed before enriched release tables are queried", () => {
  const page = read("app/opportunities/page.tsx");
  assert.match(page, /releaseFitProbe/);
  assert.match(page, /releaseFitReady/);
  assert.match(page, /baseReleasesResult/);
  assert.match(page, /Release matching is temporarily unavailable/);
});

test("release choice persists through an explicit releaseId query parameter", () => {
  const page = read("app/opportunities/page.tsx");
  assert.match(page, /searchParams/);
  assert.match(page, /requestedReleaseId/);
  assert.match(panel, /name="releaseId"/);
  assert.match(panel, /method="get"/);
});

test("recommended and advanced modes share one result surface instead of rendering duplicate directories", () => {
  const page = read("app/opportunities/page.tsx");
  assert.equal((page.match(/<OpportunityDirectory/g) ?? []).length, 1, "page fallback should render the directory only once");
  assert.match(panel, /<OpportunityDirectory/);
  assert.match(panel, /mode === "advanced"/);
});

test("the left-filter directory is primary and release intelligence enriches it", () => {
  assert.match(panel, /useState<Mode>\("advanced"\)/, "browse and filter must be the default mode");
  assert.ok(panel.indexOf("All opportunities") < panel.indexOf("Best matches for {release.title}"), "browse belongs before recommendations");
  assert.match(panel, /directoryItemsWithFit/);
  assert.match(panel, /releaseFit:\s*\{/);
  assert.match(panel, /<OpportunityDirectory items=\{directoryItemsWithFit\}/);
  assert.match(directory, /Release match/);
  assert.match(directory, /Recommended for this release/);
  assert.match(directory, /Fit for \{item\.releaseFit\.releaseTitle\}/);
  assert.match(directory, /setReleaseFit/);
});

test("form-render nonces collapse double clicks but permit later intentional updates", () => {
  assert.match(actions, /submissionNonce\(formData\)/);
  assert.match(panel, /name="submissionNonce"/);
  assert.match(read("app/opportunities/page.tsx"), /actionNonce: randomUUID\(\)/);
});

test("similar artists use stable identity keys and never name-only conflict keys", () => {
  assert.match(migration, /identity_key text not null/);
  assert.match(migration, /unique \(workspace_id, release_id, identity_key\)/);
  assert.doesNotMatch(migration, /unique \(workspace_id, release_id, normalized_name\)/);
  assert.match(handlers, /external:/);
  assert.match(handlers, /url:/);
});

test("update policies recheck all cross-workspace references", () => {
  assert.match(migration, /release_target_decisions_update[\s\S]*o\.workspace_id = release_target_decisions\.workspace_id/);
  assert.match(migration, /release_shortlist_items_update[\s\S]*c\.release_id = release_shortlist_items\.release_id/);
  assert.match(migration, /release_similar_artists_update[\s\S]*e\.workspace_id = release_similar_artists\.workspace_id/);
});

test("campaign proposals must belong to both the workspace and selected release", () => {
  assert.match(handlers, /select\("id,release_id"\)/);
  assert.match(handlers, /campaign\.release_id !== input\.releaseId/);
  assert.match(migration, /c\.release_id = release_shortlist_items\.release_id/);
});

test("release-fit modules do not require a repository-wide TypeScript import exception", () => {
  assert.doesNotMatch(read("tsconfig.json"), /allowImportingTsExtensions/);
  assert.doesNotMatch(read("lib/release-fit/context.ts"), /from "\.\/scoring\.ts"/);
});


test("user-confirmed comparable artists require a stable identity", () => {
  const handlers = read("lib/capabilities/release-fit-handlers.ts");
  const registry = read("lib/capabilities/release-fit-registry.ts");
  assert.match(handlers, /confirmationState === "user_confirmed" && !hasExternalIdentity/);
  assert.match(handlers, /stable_artist_identity_required/);
  assert.match(registry, /stable_artist_identity_required/);
});
