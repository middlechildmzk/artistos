"use client";

import { useMemo, useState } from "react";
import OpportunityDirectory, { type DirectoryCampaign, type DirectoryItem } from "./opportunity-directory";
import {
  confirmSimilarArtist,
  recordTargetDecision,
  saveReleaseSourcingProfile,
  updateShortlistItem,
} from "./release-fit-actions";

export type FitDimensionView = {
  key: string;
  label: string;
  value: number | null;
  explanation: string;
  unknownReason: string | null;
};

export type ReleaseFitItem = {
  opportunityId: string;
  title: string;
  targetType: string | null;
  country: string | null;
  platforms: string[];
  genres: string[];
  activityLabel: string | null;
  overall: number | null;
  knownDimensionCount: number;
  unknownDimensionCount: number;
  dimensions: FitDimensionView[];
  explanations: string[];
  ineligible: boolean;
  audienceLabel: string;
  audienceAsOf: string | null;
  audienceStale: boolean | null;
  routeState: string;
  routeIsFree: boolean | null;
  aiPolicy: string | null;
  relationshipState: string | null;
  sourceFreshness: string;
  corroborationCount: number;
  decision: string | null;
  shortlisted: boolean;
  readinessState: string | null;
  blockingReasons: string[];
  actionNonce: string;
};

export type ReleaseHeader = {
  releaseId: string;
  title: string;
  artistName: string | null;
  releaseDate: string | null;
  status: string | null;
  genreLine: string;
  genreSource: "release" | "artist" | "none";
  missingMetadata: string[];
  confirmedSimilarArtists: string[];
  releaseOptions: { id: string; title: string; releaseDate: string | null; status: string | null }[];
  profileNonce: string;
  similarArtistNonce: string;
  profile: {
    subgenreTags: string[];
    moodTags: string[];
    lyricalThemes: string[];
    territoryFocus: string[];
    primaryLanguage: string | null;
    vocalType: string | null;
    aiInvolvement: string | null;
    aiDisclosurePreference: string | null;
    artistSizeBand: string | null;
  };
};

type Mode = "recommended" | "advanced";

function fitLabel(item: ReleaseFitItem) {
  return item.overall === null ? "Fit unknown" : `Fit ${item.overall}`;
}

function coverageLabel(item: ReleaseFitItem) {
  const total = item.knownDimensionCount + item.unknownDimensionCount;
  return `${item.knownDimensionCount}/${total} dimensions evidenced`;
}

function ActionFields({ releaseId, item, decision }: { releaseId: string; item: ReleaseFitItem; decision: string }) {
  return (
    <>
      <input type="hidden" name="releaseId" value={releaseId} />
      <input type="hidden" name="opportunityId" value={item.opportunityId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="submissionNonce" value={item.actionNonce} />
    </>
  );
}

export default function ReleaseFitPanel({
  release,
  items,
  campaigns,
  directoryItems,
}: {
  release: ReleaseHeader;
  items: ReleaseFitItem[];
  campaigns: DirectoryCampaign[];
  directoryItems: DirectoryItem[];
}) {
  const [mode, setMode] = useState<Mode>("advanced");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showShortlist, setShowShortlist] = useState(false);
  const [query, setQuery] = useState("");
  const [hideIneligible, setHideIneligible] = useState(true);
  const [onlyEvidenced, setOnlyEvidenced] = useState(true);

  const shortlist = useMemo(
    () => items.filter((item) => item.shortlisted).sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1)),
    [items],
  );

  const visible = useMemo(() => {
    const hiddenDecisions = new Set(["hidden", "not_relevant", "do_not_recommend"]);
    let rows = items.filter((item) => !hiddenDecisions.has(item.decision ?? ""));
    if (hideIneligible) rows = rows.filter((item) => !item.ineligible);
    if (onlyEvidenced) rows = rows.filter((item) => item.knownDimensionCount > 0 && item.explanations.length > 0);
    const needle = query.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((item) =>
        [item.title, item.targetType, item.country, ...item.genres, ...item.platforms]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    return rows.sort((a, b) => {
      if (a.overall === null && b.overall === null) return a.title.localeCompare(b.title);
      if (a.overall === null) return 1;
      if (b.overall === null) return -1;
      return b.overall - a.overall || b.knownDimensionCount - a.knownDimensionCount || a.title.localeCompare(b.title);
    });
  }, [hideIneligible, items, onlyEvidenced, query]);

  const directoryItemsWithFit = useMemo<DirectoryItem[]>(() => {
    const fitByOpportunity = new Map(items.map((item) => [item.opportunityId, item]));
    return directoryItems.map((item) => {
      const fit = fitByOpportunity.get(item.id);
      if (!fit) return item;
      return {
        ...item,
        releaseFit: {
          releaseTitle: release.title,
          score: fit.overall,
          knownDimensionCount: fit.knownDimensionCount,
          totalDimensionCount: fit.knownDimensionCount + fit.unknownDimensionCount,
          explanations: fit.explanations,
          decision: fit.decision,
          shortlisted: fit.shortlisted,
          readinessState: fit.readinessState,
          ineligible: fit.ineligible,
        },
      };
    });
  }, [directoryItems, items, release.title]);

  const evidencedFitCount = items.filter((item) => item.knownDimensionCount > 0 && item.explanations.length > 0 && !item.ineligible).length;

  const openItem = openId ? items.find((item) => item.opportunityId === openId) ?? null : null;
  const shortlistPanel = showShortlist ? (
    <section className="rfs-shortlist" aria-label="Release shortlist">
      <h3>Shortlist for {release.title}</h3>
      {shortlist.length ? <ul className="rfs-shortlist-list">{shortlist.map((item) => (
        <li key={item.opportunityId} className="rfs-shortlist-item">
          <div><strong>{item.title}</strong><span className={`rfs-pill rfs-readiness-${item.readinessState ?? "needs_review"}`}>{(item.readinessState ?? "needs review").replace(/_/g, " ")}</span>{item.blockingReasons.length ? <p className="rfs-blocking">Blocking: {item.blockingReasons.join(", ").replace(/_/g, " ")}</p> : null}</div>
          <form action={updateShortlistItem} className="rfs-shortlist-form">
            <input type="hidden" name="releaseId" value={release.releaseId} />
            <input type="hidden" name="opportunityId" value={item.opportunityId} />
            <input type="hidden" name="submissionNonce" value={item.actionNonce} />
            <label className="rfs-field-inline"><span>Campaign proposal</span><select className="rfs-input" name="proposedCampaignId" defaultValue=""><option value="">Propose later</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
            <button className="rfs-btn" type="submit">Save proposal</button>
          </form>
        </li>
      ))}</ul> : <p className="rfs-empty">Nothing shortlisted yet.</p>}
      <p className="rfs-note">A shortlist proposal records intent only. It does not contact anyone, submit music, spend credits, or create a CRM record.</p>
    </section>
  ) : null;

  return (
    <section className="rfs-root">
      <header className="rfs-context" aria-label="Selected release">
        <div className="rfs-context-main">
          <strong className="rfs-context-title">
            {release.artistName ? `${release.artistName} · ` : ""}{release.title}
          </strong>
          <span className="rfs-context-meta">
            {release.status === "released" && release.releaseDate ? `Released ${release.releaseDate}` : release.status ?? "Status not recorded"}
          </span>
          <span className="rfs-context-genres">
            {release.genreSource === "none" ? <em>No genres recorded</em> : <>{release.genreLine}{release.genreSource === "artist" ? <em className="rfs-hint"> (artist-level)</em> : null}</>}
          </span>
        </div>
        <div className="rfs-context-actions">
          <form method="get" action="/opportunities" className="rfs-release-switcher">
            <label>
              <span className="sr-only">Selected release</span>
              <select name="releaseId" defaultValue={release.releaseId}>
                {release.releaseOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
            </label>
            <button className="rfs-btn" type="submit">Switch</button>
          </form>
          <button type="button" className={`rfs-chip ${showShortlist ? "rfs-chip-on" : ""}`} onClick={() => setShowShortlist((value) => !value)}>
            Shortlist {shortlist.length}
          </button>
        </div>
      </header>

      {release.missingMetadata.length ? (
        <p className="rfs-missing">Recommendations are limited: no {release.missingMetadata.join(", ")} recorded. Unknown fields do not score.</p>
      ) : null}

      <details className="rfs-profile-editor">
        <summary>Improve release matching</summary>
        <form action={saveReleaseSourcingProfile} className="rfs-profile-grid">
          <input type="hidden" name="releaseId" value={release.releaseId} />
          <input type="hidden" name="submissionNonce" value={release.profileNonce} />
          <label><span>Subgenres</span><input className="rfs-input" name="subgenreTags" defaultValue={release.profile.subgenreTags.join(", ")} placeholder="melodic bass, future bass" /></label>
          <label><span>Moods</span><input className="rfs-input" name="moodTags" defaultValue={release.profile.moodTags.join(", ")} placeholder="emotional, hopeful, cinematic" /></label>
          <label><span>Lyrical themes</span><input className="rfs-input" name="lyricalThemes" defaultValue={release.profile.lyricalThemes.join(", ")} /></label>
          <label><span>Territories</span><input className="rfs-input" name="territoryFocus" defaultValue={release.profile.territoryFocus.join(", ")} placeholder="US, UK, Canada" /></label>
          <label><span>Language</span><input className="rfs-input" name="primaryLanguage" defaultValue={release.profile.primaryLanguage ?? ""} /></label>
          <label><span>Vocal type</span><select className="rfs-input" name="vocalType" defaultValue={release.profile.vocalType ?? ""}><option value="">Unknown</option><option value="vocal">Vocal</option><option value="instrumental">Instrumental</option><option value="mixed">Mixed</option></select></label>
          <label><span>Artist stage</span><select className="rfs-input" name="artistSizeBand" defaultValue={release.profile.artistSizeBand ?? ""}><option value="">Unknown</option><option value="emerging">Emerging</option><option value="developing">Developing</option><option value="established">Established</option></select></label>
          <label><span>AI involvement</span><select className="rfs-input" name="aiInvolvement" defaultValue={release.profile.aiInvolvement ?? ""}><option value="">Unknown</option><option value="none">None</option><option value="assisted">Assisted</option><option value="generated">Generated element</option><option value="undisclosed">Prefer not recorded</option></select></label>
          <label><span>AI disclosure</span><select className="rfs-input" name="aiDisclosurePreference" defaultValue={release.profile.aiDisclosurePreference ?? ""}><option value="">Unknown</option><option value="always_disclose">Always disclose</option><option value="disclose_on_request">Disclose on request</option><option value="not_applicable">Not applicable</option></select></label>
          <button className="rfs-btn rfs-btn-primary" type="submit">Save release context</button>
        </form>
        <form action={confirmSimilarArtist} className="rfs-similar-form">
          <input type="hidden" name="releaseId" value={release.releaseId} />
          <input type="hidden" name="submissionNonce" value={release.similarArtistNonce} />
          <input type="hidden" name="confirmationState" value="user_confirmed" />
          <label><span>Comparable artist</span><input className="rfs-input" name="artistName" required placeholder="Dabin" /></label>
          <label><span>Wikidata ID or official URL required</span><input className="rfs-input" name="wikidataId" placeholder="Q123456" /></label>
          <label><span>Official URL</span><input className="rfs-input" name="canonicalUrl" type="url" placeholder="https://..." /></label>
          <button className="rfs-btn" type="submit">Add comparable artist</button>
        </form>
        {release.confirmedSimilarArtists.length ? <p className="rfs-note">Confirmed: {release.confirmedSimilarArtists.join(", ")}</p> : null}
      </details>

      <div className="rfs-modes" role="tablist" aria-label="Sourcing mode">
        <button type="button" role="tab" aria-selected={mode === "advanced"} className={`rfs-mode ${mode === "advanced" ? "rfs-mode-on" : ""}`} onClick={() => setMode("advanced")}>Browse &amp; filter</button>
        <button type="button" role="tab" aria-selected={mode === "recommended"} className={`rfs-mode ${mode === "recommended" ? "rfs-mode-on" : ""}`} onClick={() => setMode("recommended")}>Recommended for {release.title}</button>
      </div>

      {mode === "advanced" ? <>
        <div className="rfs-directory-intelligence">
          <div><strong>Release fit is active for {release.title}</strong><span>{evidencedFitCount} explainable {evidencedFitCount === 1 ? "match" : "matches"} · {shortlist.length} shortlisted</span></div>
          <button type="button" className="rfs-btn" onClick={() => setMode("recommended")}>Review recommendations</button>
        </div>
        {shortlistPanel}
        <OpportunityDirectory items={directoryItemsWithFit} campaigns={campaigns} />
      </> : (
        <>
          <div className="rfs-filter-grid rfs-recommendation-filters">
            <label className="rfs-field"><span>Filter recommendations</span><input className="rfs-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="name, genre, country or platform" /></label>
            <label className="rfs-check"><input type="checkbox" checked={hideIneligible} onChange={() => setHideIneligible((value) => !value)} /><span>Hide evidenced-ineligible targets</span></label>
            <label className="rfs-check"><input type="checkbox" checked={onlyEvidenced} onChange={() => setOnlyEvidenced((value) => !value)} /><span>Only show explainable matches</span></label>
          </div>

          {shortlistPanel}

          <p className="rfs-count">{visible.length} explainable {visible.length === 1 ? "target" : "targets"}</p>
          <ul className="rfs-results">
            {visible.map((item) => (
              <li key={item.opportunityId} className="rfs-card">
                <div className="rfs-card-head"><div className="rfs-card-identity"><strong className="rfs-card-title">{item.title}</strong><span className="rfs-card-sub">{[item.targetType, item.country].filter(Boolean).join(" · ") || "Type not recorded"}</span></div><div className="rfs-card-score"><span className={`rfs-fit ${item.overall === null ? "rfs-fit-unknown" : ""}`}>{fitLabel(item)}</span><span className="rfs-coverage">{coverageLabel(item)}</span></div></div>
                <div className="rfs-tags">{item.platforms.map((platform) => <span key={platform} className="rfs-pill">{platform}</span>)}{item.genres.slice(0, 3).map((genre) => <span key={genre} className="rfs-pill">{genre}</span>)}<span className="rfs-pill">{item.activityLabel ?? "Activity unknown"}</span><span className={`rfs-pill rfs-route-${item.routeState}`}>{item.routeState.replace(/_/g, " ")}</span><span className="rfs-pill">{item.audienceLabel}</span></div>
                {item.explanations.length ? <ul className="rfs-why">{item.explanations.slice(0, 3).map((line) => <li key={line}>{line}</li>)}</ul> : <p className="rfs-why-none">No evidenced reason to recommend this target yet.</p>}
                <div className="rfs-card-actions">
                  <form action={recordTargetDecision}><ActionFields releaseId={release.releaseId} item={item} decision={item.shortlisted ? "cleared" : "shortlisted"} /><button className="rfs-btn rfs-btn-primary" type="submit">{item.shortlisted ? "Remove from shortlist" : "Add to shortlist"}</button></form>
                  <form action={recordTargetDecision}><ActionFields releaseId={release.releaseId} item={item} decision="saved" /><button className="rfs-btn" type="submit">Save</button></form>
                  <form action={recordTargetDecision}><ActionFields releaseId={release.releaseId} item={item} decision="not_relevant" /><button className="rfs-btn" type="submit">Not relevant</button></form>
                  <button type="button" className="rfs-btn" onClick={() => setOpenId(item.opportunityId)} aria-haspopup="dialog">Review evidence</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {openItem ? (
        <div className="rfs-slideover-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenId(null); }}>
          <aside className="rfs-slideover" role="dialog" aria-modal="true" aria-label={`Evidence for ${openItem.title}`}>
            <div className="rfs-slideover-head"><strong>{openItem.title}</strong><button type="button" className="rfs-btn" onClick={() => setOpenId(null)}>Close</button></div>
            <section><h4>Fit</h4><ul className="rfs-dimensions">{openItem.dimensions.map((dimension) => <li key={dimension.key}><span className="rfs-dimension-label">{dimension.label}</span><span className="rfs-dimension-value">{dimension.value === null ? "Unknown" : Math.round(dimension.value * 100)}</span><p className="rfs-dimension-why">{dimension.unknownReason ?? dimension.explanation}</p></li>)}</ul></section>
            <section><h4>Safety and policy</h4><ul className="rfs-policy"><li>Submission route: {openItem.routeState.replace(/_/g, " ")}</li><li>Cost: {openItem.routeIsFree === null ? "unknown" : openItem.routeIsFree ? "free" : "paid"}</li><li>AI policy: {openItem.aiPolicy ?? "unknown"}</li><li>Corroborating sources: {openItem.corroborationCount}</li><li>Source freshness: {openItem.sourceFreshness}</li></ul><p className="rfs-note">Public contact information is evidence, not permission. Nothing here authorizes contacting this target.</p></section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
