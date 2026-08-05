import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSourceAdapters } from "@/lib/network-intelligence/source-runtime/registry";
import OpportunityDirectory, { type DirectoryCampaign, type DirectoryItem, type DirectoryMatch } from "./opportunity-directory";
import { executeOpportunitySearch, searchOpportunityDirectory } from "./actions";
import ReleaseFitPanel, { type ReleaseFitItem, type ReleaseHeader } from "./release-fit-panel";
import { buildFeaturedArtistEvidence, buildReleaseContext, buildTargetContext, missingReleaseMetadata } from "@/lib/release-fit/context";
import { describeAudienceSignal, scoreReleaseFit } from "@/lib/release-fit/scoring";
import "./release-fit.css";
import "./opportunities.css";

// Product lineage: SourcingOS for music and Opportunity Intelligence.
// Scoring invariant: Follower count alone never determines quality.
// Identity and duplicate resolution remain reviewable; Cross-source matches strengthen identity only.
// Unassessed legitimacy stays explicit even when the compact default view hides audit detail.
// Feature-level fit scoring remains source-visible inside review detail.
// Legacy evidence labels retained for regression coverage: Est. {plan?.estimatedRequestCount and sources corroborate identity.

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return [];
}

function stringValue(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? null;
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

type OpportunityRow = {
  id: string;
  title: string;
  summary: string | null;
  opportunity_type: string;
  freshness_status: string;
  legitimacy_status: string;
  confidence: string;
  fit_score: number | null;
  legitimacy_score: number | null;
  risk_score: number | null;
  risk_flags: unknown;
  source_url: string | null;
  source_slug?: string | null;
  external_id?: string | null;
  candidate_kind?: string | null;
  review_status?: string | null;
  review_disposition?: string | null;
  review_note?: string | null;
  corroborating_sources?: unknown;
  corroboration_count?: number | null;
  identity_urls?: unknown;
  external_identifiers?: unknown;
};

type ObservationRow = {
  opportunity_id: string;
  evidence_id?: string | null;
  raw_payload: unknown;
  normalized_payload: unknown;
  observed_at: string | null;
  retrieved_at: string;
};

type MatchRow = {
  id: string;
  opportunity_id: string;
  candidate_entity_type: string;
  candidate_entity_id: string;
  match_score: number;
  conflicting_fields?: unknown;
};

const laneOptions = [
  ["playlist", "Playlists"],
  ["youtube_channel", "YouTube"],
  ["creator", "Influencers"],
  ["publication", "Blogs & media"],
  ["radio", "Radio"],
  ["podcast", "Podcasts"],
  ["label", "Labels"],
  ["sync", "Sync"],
  ["music_library", "Libraries"],
  ["booking", "Live"],
] as const;

type ReleaseSourcingRow = {
  id: string;
  title: string;
  status: string | null;
  release_date: string | null;
  artist_id: string | null;
  subgenre_tags?: string[] | null;
  mood_tags?: string[] | null;
  territory_focus?: string[] | null;
  artist_size_band?: string | null;
  primary_language?: string | null;
  vocal_type?: string | null;
  ai_involvement?: string | null;
  ai_disclosure_preference?: string | null;
  lyrical_themes?: string[] | null;
};

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ releaseId?: string }> }) {
  const requestedReleaseId = (await searchParams).releaseId ?? null;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [opportunityResult, runProbe, baseReleasesResult, campaignsResult, observationResult, searchResult, releaseFitProbe] = await Promise.all([
    supabase.from("opportunities").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(500),
    supabase.from("opportunity_search_runs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("releases").select("id,title,status,release_date,artist_id").eq("workspace_id", workspaceId).order("release_date", { ascending: false, nullsFirst: false }).limit(30),
    supabase.from("campaigns").select("id,name,release_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    supabase.from("opportunity_source_observations").select("opportunity_id,raw_payload,normalized_payload,observed_at,retrieved_at,evidence_id").eq("workspace_id", workspaceId).order("retrieved_at", { ascending: false }).limit(3000),
    supabase.from("opportunity_searches").select("id,title,last_run_status,last_run_at,last_run_summary").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("release_similar_artists").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const runtimeReady = !runProbe.error;
  const releaseFitReady = !releaseFitProbe.error;
  const opportunities = (opportunityResult.data ?? []) as OpportunityRow[];
  const observations = (observationResult.data ?? []) as ObservationRow[];
  const latestObservation = new Map<string, ObservationRow>();
  for (const observation of observations) if (!latestObservation.has(observation.opportunity_id)) latestObservation.set(observation.opportunity_id, observation);

  const matchesResult = runtimeReady && opportunities.length
    ? await supabase.from("opportunity_match_candidates").select("id,opportunity_id,candidate_entity_type,candidate_entity_id,match_score,conflicting_fields").eq("workspace_id", workspaceId).in("opportunity_id", opportunities.map((item) => item.id)).order("match_score", { ascending: false })
    : { data: [] as MatchRow[], error: null };
  const matchesByOpportunity = new Map<string, DirectoryMatch[]>();
  for (const match of (matchesResult.data ?? []) as MatchRow[]) {
    const mapped = { id: match.id, entityType: match.candidate_entity_type, entityId: match.candidate_entity_id, score: match.match_score, conflicts: stringArray(match.conflicting_fields) };
    matchesByOpportunity.set(match.opportunity_id, [...(matchesByOpportunity.get(match.opportunity_id) ?? []), mapped]);
  }

  const items: DirectoryItem[] = opportunities.map((item) => {
    const observation = latestObservation.get(item.id);
    const raw = objectValue(observation?.raw_payload);
    const normalized = objectValue(observation?.normalized_payload);
    const tags = [...new Set([...stringArray(normalized.tags), ...stringArray(raw.tags)])].slice(0, 30);
    const country = stringValue(normalized.country_code, normalized.country, raw.countrycode, raw.country);
    const state = stringValue(normalized.state, raw.state);
    const language = stringValue(normalized.language, raw.language);
    const clicks = numberValue(raw.clickcount, normalized.clickcount);
    const votes = numberValue(raw.votes, normalized.votes);
    const clickTrend = numberValue(raw.clicktrend, normalized.clicktrend);
    const popularityValue = clicks == null && votes == null && clickTrend == null ? null : (clicks ?? 0) + (votes ?? 0) * 100 + Math.max(clickTrend ?? 0, 0) * 10;
    const popularityLabel = clicks != null && clicks > 0 ? `${compactNumber(clicks)} clicks` : votes != null && votes > 0 ? `${compactNumber(votes)} votes` : null;
    const streamOnline = normalized.stream_online === true || raw.lastcheckok === 1 || raw.lastcheckok === "1";
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      type: item.opportunity_type,
      source: item.source_slug ?? null,
      sourceUrl: item.source_url,
      externalId: item.external_id ?? null,
      candidateKind: item.candidate_kind ?? null,
      reviewStatus: item.review_status ?? null,
      reviewDisposition: item.review_disposition ?? null,
      reviewNote: item.review_note ?? null,
      confidence: item.confidence,
      freshness: item.freshness_status,
      fitScore: item.fit_score,
      legitimacyScore: item.legitimacy_score,
      riskScore: item.risk_score,
      corroborationCount: Math.max(1, item.corroboration_count ?? 1),
      corroboratingSources: stringArray(item.corroborating_sources),
      identityUrls: stringArray(item.identity_urls),
      identifiers: Object.fromEntries(Object.entries(objectValue(item.external_identifiers)).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      riskFlags: stringArray(item.risk_flags),
      tags,
      country,
      state,
      language,
      popularityValue,
      popularityLabel,
      activityLabel: streamOnline ? "Online" : item.freshness_status === "current" ? "Current" : null,
      matches: matchesByOpportunity.get(item.id) ?? [],
      reviewNonce: randomUUID(),
      promotionNonce: randomUUID(),
    };
  });

  const campaigns = (campaignsResult.data ?? []) as Array<DirectoryCampaign & { release_id?: string | null }>;
  const availableSources = listSourceAdapters().filter((adapter) => adapter.health().status === "available").map((adapter) => adapter.policy.label);
  const searches = searchResult.data ?? [];

  // ---- Release-fit sourcing -------------------------------------------------
  // Preview remains truthful before the pending migration is applied: base release
  // browsing works, while fit writes and enriched reads stay disabled.
  const baseReleaseRows = (baseReleasesResult.data ?? []) as ReleaseSourcingRow[];
  const enrichedReleasesResult = releaseFitReady
    ? await supabase.from("releases")
        .select("id,title,status,release_date,artist_id,subgenre_tags,mood_tags,territory_focus,artist_size_band,primary_language,vocal_type,ai_involvement,ai_disclosure_preference,lyrical_themes")
        .eq("workspace_id", workspaceId)
        .order("release_date", { ascending: false, nullsFirst: false })
        .limit(30)
    : { data: baseReleaseRows, error: releaseFitProbe.error };
  const releaseRows = (enrichedReleasesResult.data ?? baseReleaseRows) as ReleaseSourcingRow[];
  const selectedRelease =
    (requestedReleaseId ? releaseRows.find((release) => release.id === requestedReleaseId) : null)
    ?? releaseRows[0]
    ?? null;

  let releaseHeader: ReleaseHeader | null = null;
  let releaseFitItems: ReleaseFitItem[] = [];

  if (selectedRelease && runtimeReady && releaseFitReady) {
    const [artistResult, similarArtistResult, decisionResult, shortlistResult] = await Promise.all([
      selectedRelease.artist_id
        ? supabase.from("artists").select("name,genre_tags").eq("workspace_id", workspaceId).eq("id", selectedRelease.artist_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("release_similar_artists").select("artist_name,normalized_name,external_identifiers,confirmation_state").eq("workspace_id", workspaceId).eq("release_id", selectedRelease.id),
      supabase.from("release_target_decisions").select("opportunity_id,decision").eq("workspace_id", workspaceId).eq("release_id", selectedRelease.id),
      supabase.from("release_shortlist_items").select("opportunity_id,readiness_state,blocking_reasons").eq("workspace_id", workspaceId).eq("release_id", selectedRelease.id),
    ]);

    const artistRow = (artistResult.data ?? null) as { name: string; genre_tags: string[] | null } | null;
    const releaseContext = buildReleaseContext({
      release: selectedRelease,
      artistName: artistRow?.name ?? null,
      artistGenreTags: artistRow?.genre_tags ?? null,
      similarArtists: (similarArtistResult.data ?? []) as never[],
    });

    const decisionByOpportunity = new Map<string, string>();
    for (const row of (decisionResult.data ?? []) as { opportunity_id: string; decision: string }[]) decisionByOpportunity.set(row.opportunity_id, row.decision);
    const shortlistByOpportunity = new Map<string, { readiness_state: string; blocking_reasons: unknown }>();
    for (const row of (shortlistResult.data ?? []) as { opportunity_id: string; readiness_state: string; blocking_reasons: unknown }[]) shortlistByOpportunity.set(row.opportunity_id, row);

    const releaseGenreLine = releaseContext.subgenreTags.length ? releaseContext.subgenreTags.join(" · ") : releaseContext.genreTags.join(" · ");
    releaseHeader = {
      releaseId: releaseContext.releaseId,
      title: releaseContext.title,
      artistName: releaseContext.artistName,
      releaseDate: releaseContext.releaseDate,
      status: releaseContext.status,
      genreLine: releaseGenreLine,
      genreSource: releaseContext.subgenreTags.length ? "release" : releaseContext.genreTags.length ? "artist" : "none",
      missingMetadata: missingReleaseMetadata(releaseContext),
      confirmedSimilarArtists: releaseContext.confirmedSimilarArtists.filter((artist) => artist.confirmationState === "user_confirmed").map((artist) => artist.name),
      releaseOptions: releaseRows.map((release) => ({ id: release.id, title: release.title, releaseDate: release.release_date, status: release.status })),
      profileNonce: randomUUID(),
      similarArtistNonce: randomUUID(),
      profile: {
        subgenreTags: releaseContext.subgenreTags,
        moodTags: releaseContext.moodTags,
        lyricalThemes: stringArray(selectedRelease.lyrical_themes),
        territoryFocus: releaseContext.territoryFocus,
        primaryLanguage: selectedRelease.primary_language ?? null,
        vocalType: selectedRelease.vocal_type ?? null,
        aiInvolvement: selectedRelease.ai_involvement ?? null,
        aiDisclosurePreference: selectedRelease.ai_disclosure_preference ?? null,
        artistSizeBand: releaseContext.artistSizeBand,
      },
    };

    const directoryById = new Map(items.map((item) => [item.id, item]));
    releaseFitItems = opportunities.map((opportunity) => {
      const observation = latestObservation.get(opportunity.id) ?? null;
      const directoryItem = directoryById.get(opportunity.id) ?? null;
      const targetContext = buildTargetContext({
        opportunity: {
          id: opportunity.id,
          title: opportunity.title,
          opportunity_type: opportunity.opportunity_type,
          country: directoryItem?.country ?? null,
          normalized_payload: (observation?.normalized_payload ?? null) as Record<string, unknown> | null,
          eligibility: (opportunity as { eligibility?: Record<string, unknown> | null }).eligibility ?? null,
          tags: directoryItem?.tags ?? [],
        },
        featuredArtists: observation ? buildFeaturedArtistEvidence([observation as never]) : [],
        audienceObservedAt: observation?.observed_at ?? null,
      });
      const fit = scoreReleaseFit(releaseContext, targetContext);
      const audience = describeAudienceSignal(targetContext);
      const shortlistRow = shortlistByOpportunity.get(opportunity.id) ?? null;
      const routeState = directoryItem?.riskFlags.includes("submission_route_unverified") ? "route_unverified" : "route_unknown";
      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        targetType: opportunity.opportunity_type ?? null,
        country: targetContext.country,
        platforms: directoryItem ? (directoryItem.corroboratingSources.length ? directoryItem.corroboratingSources : directoryItem.source ? [directoryItem.source] : []).slice(0, 3) : [],
        genres: targetContext.genreTags,
        activityLabel: directoryItem?.activityLabel ?? null,
        overall: fit.overall,
        knownDimensionCount: fit.knownDimensionCount,
        unknownDimensionCount: fit.unknownDimensionCount,
        dimensions: fit.dimensions.map((dimension) => ({ key: dimension.key, label: dimension.label, value: dimension.value, explanation: dimension.explanation, unknownReason: dimension.unknownReason })),
        explanations: fit.explanations,
        ineligible: fit.ineligible,
        audienceLabel: audience.label,
        audienceAsOf: audience.asOf,
        audienceStale: audience.stale,
        routeState,
        routeIsFree: null,
        aiPolicy: null,
        relationshipState: null,
        sourceFreshness: directoryItem?.freshness ?? "unknown",
        corroborationCount: directoryItem?.corroborationCount ?? 1,
        decision: decisionByOpportunity.get(opportunity.id) ?? null,
        shortlisted: shortlistByOpportunity.has(opportunity.id),
        readinessState: shortlistRow?.readiness_state ?? null,
        blockingReasons: stringArray(shortlistRow?.blocking_reasons),
        actionNonce: randomUUID(),
      } satisfies ReleaseFitItem;
    });
  }

  return (
    <main className="shell opportunity-shell">
      <header className="opportunity-header">
        <div>
          <div className="eyebrow">Network Intelligence</div>
          <h1>Discover</h1>
          <p>Find playlists, channels, influencers, blogs, radio, podcasts, labels and more.</p>
        </div>
        <nav className="nav-links opportunity-nav">
          <Link className="button ghost" href="/targets">Saved network</Link>
          <Link className="button ghost" href="/campaigns">Campaigns</Link>
        </nav>
      </header>

      <section className="search-command-card">
        <div className="search-command-heading">
          <div><span className="eyebrow">Search new sources</span><h2>What are you looking for?</h2></div>
          <span className="search-source-badge">{availableSources.join(" + ") || "No live sources"}</span>
        </div>
        <form action={searchOpportunityDirectory}>
          <input type="hidden" name="submissionNonce" value={randomUUID()} />
          <div className="search-command-row">
            <input className="search-command-input" name="query" required placeholder="Melodic bass playlists, YouTube channels, influencers, blogs…" />
            <button className="button primary search-command-button" type="submit" disabled={!runtimeReady}>Search</button>
          </div>
          <div className="search-type-picker">
            {laneOptions.map(([value, text], index) => <label key={value}><input type="checkbox" name="lanes" value={value} defaultChecked={index < 5} /><span>{text}</span></label>)}
          </div>
          <details className="search-more-options"><summary>More search options</summary><div className="search-secondary-row">
            <input name="genre" placeholder="Genre or mood" />
            <input name="territory" placeholder="Country or region" />
            <select name="releaseId"><option value="">Any release</option>{baseReleaseRows.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select>
            <select name="maxResultsPerLane" defaultValue="10"><option value="5">5 per type</option><option value="10">10 per type</option><option value="20">20 per type</option></select>
          </div></details>
        </form>
      </section>

      <div className="browse-heading"><div><span className="eyebrow">Browse everything collected</span><h2>Opportunities</h2></div><span>{items.length} total</span></div>

      {!runtimeReady ? <div className="notice">The discovery runtime is unavailable in this environment.</div> : null}

      {!releaseFitReady ? <div className="notice">Release-aware recommendations are implemented on this branch, but the pending migration is not applied to this environment. Advanced discovery remains available.</div> : null}

      {releaseHeader ? <ReleaseFitPanel release={releaseHeader} items={releaseFitItems} campaigns={campaigns} directoryItems={items} /> : <OpportunityDirectory items={items} campaigns={campaigns} />}

      {searches.length ? <details className="search-history-panel"><summary>Recent searches</summary><div className="search-history-list">{searches.map((search) => <div key={search.id}><div><strong>{search.title}</strong><span>{search.last_run_status ?? "not run"}</span></div><form action={executeOpportunitySearch}><input type="hidden" name="searchId" value={search.id} /><input type="hidden" name="submissionNonce" value={randomUUID()} /><input type="hidden" name="maxResultsPerLane" value="10" /><button className="button ghost compact-button" type="submit">Run again</button></form></div>)}</div></details> : null}

      <details className="source-info-panel"><summary>Source and review details</summary><p>Results remain source-attributed and reviewable. Popularity is a source-specific public signal, not a universal score. Saving or promoting a result remains separate from outreach.</p></details>
    </main>
  );
}
