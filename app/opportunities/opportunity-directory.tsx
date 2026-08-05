"use client";

import { useMemo, useState } from "react";
import { requestOpportunityPromotion, reviewOpportunity } from "./actions";

export type DirectoryMatch = {
  id: string;
  entityType: string;
  entityId: string;
  score: number;
  conflicts: string[];
};

export type DirectoryItem = {
  id: string;
  title: string;
  summary: string | null;
  type: string;
  source: string | null;
  sourceUrl: string | null;
  externalId: string | null;
  candidateKind: string | null;
  reviewStatus: string | null;
  reviewDisposition: string | null;
  reviewNote: string | null;
  confidence: string;
  freshness: string;
  fitScore: number | null;
  legitimacyScore: number | null;
  riskScore: number | null;
  corroborationCount: number;
  corroboratingSources: string[];
  identityUrls: string[];
  identifiers: Record<string, string>;
  riskFlags: string[];
  tags: string[];
  country: string | null;
  state: string | null;
  language: string | null;
  popularityValue: number | null;
  popularityLabel: string | null;
  activityLabel: string | null;
  matches: DirectoryMatch[];
  reviewNonce: string;
  promotionNonce: string;
};

export type DirectoryCampaign = { id: string; name: string };

type SortKey = "popular" | "fit" | "recent" | "name";
type ActivityFilter = "all" | "online" | "current" | "unknown";

const typeOptions = [
  ["all", "All"],
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

const typeMarks: Record<string, string> = {
  playlist: "PL",
  youtube_channel: "YT",
  creator: "CR",
  publication: "MD",
  radio: "RA",
  podcast: "PO",
  label: "LB",
  sync: "SY",
  music_library: "ML",
  booking: "LV",
};

function cleanLabel(value: string | null | undefined, fallback = "Unknown") {
  return value?.replaceAll("_", " ") || fallback;
}

function score(value: number | null) {
  return value == null ? "—" : Math.round(value).toString();
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function ResultCard({ item, onOpen }: { item: DirectoryItem; onOpen: () => void }) {
  const location = [item.country, item.state].filter(Boolean).join(" · ");
  const subtitle = [cleanLabel(item.type), location, item.language].filter(Boolean).join(" · ");
  const sourceNames = item.corroboratingSources.length ? item.corroboratingSources : item.source ? [item.source] : [];

  return (
    <article className="opportunity-card">
      <button className="opportunity-card-main" type="button" onClick={onOpen} aria-label={`Open ${item.title}`}>
        <span className={`opportunity-avatar type-${item.type}`} aria-hidden="true">{typeMarks[item.type] ?? item.title.slice(0, 2).toUpperCase()}</span>
        <span className="opportunity-copy">
          <span className="opportunity-title-row">
            <span>
              <strong>{item.title}</strong>
              <small>{subtitle}</small>
            </span>
            <span className={`status-dot ${item.activityLabel === "Online" || item.freshness === "current" ? "current" : ""}`} title={`Freshness: ${item.freshness}`} />
          </span>
          <span className="opportunity-tags">
            <span className="result-type">{cleanLabel(item.type)}</span>
            {item.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
            {sourceNames.slice(0, 1).map((source) => <span key={source}>{cleanLabel(source)}</span>)}
            {item.corroborationCount > 1 ? <span className="positive">{item.corroborationCount} sources</span> : null}
          </span>
          {item.summary ? <span className="opportunity-summary">{item.summary}</span> : null}
        </span>
      </button>

      <div className="opportunity-metrics">
        <div><strong>{item.popularityLabel ?? "—"}</strong><span>Popularity</span></div>
        <div><strong>{score(item.fitScore)}</strong><span>Fit</span></div>
        <div><strong>{item.activityLabel ?? cleanLabel(item.freshness)}</strong><span>Activity</span></div>
      </div>

      <div className="opportunity-actions">
        {item.sourceUrl ? <a className="button ghost compact-button" href={item.sourceUrl} target="_blank" rel="noreferrer">Visit</a> : null}
        <button className="button primary compact-button" type="button" onClick={onOpen}>View</button>
      </div>
    </article>
  );
}

function DetailDrawer({ item, campaigns, onClose }: { item: DirectoryItem; campaigns: DirectoryCampaign[]; onClose: () => void }) {
  const accepted = item.reviewStatus === "accepted";
  const location = [item.country, item.state].filter(Boolean).join(" · ");
  const sources = item.corroboratingSources.length ? item.corroboratingSources : item.source ? [item.source] : [];

  return (
    <div className="opportunity-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="opportunity-drawer" role="dialog" aria-modal="true" aria-labelledby="opportunity-drawer-title">
        <header className="drawer-header">
          <div className={`opportunity-avatar large type-${item.type}`} aria-hidden="true">{typeMarks[item.type] ?? item.title.slice(0, 2).toUpperCase()}</div>
          <div>
            <span className="eyebrow">{cleanLabel(item.type)}</span>
            <h2 id="opportunity-drawer-title">{item.title}</h2>
            <p>{[location, item.language].filter(Boolean).join(" · ") || cleanLabel(item.source)}</p>
          </div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="Close details">×</button>
        </header>

        <div className="drawer-body">
          <section className="drawer-score-grid">
            <div><strong>{item.popularityLabel ?? "—"}</strong><span>Popularity</span></div>
            <div><strong>{score(item.fitScore)}</strong><span>Fit</span></div>
            <div><strong>{score(item.legitimacyScore)}</strong><span>Legitimacy</span></div>
            <div><strong>{score(item.riskScore)}</strong><span>Risk</span></div>
          </section>

          {item.summary ? <section className="drawer-section"><h3>About</h3><p>{item.summary}</p></section> : null}

          <section className="drawer-section">
            <h3>Genres and signals</h3>
            <div className="opportunity-tags">
              {item.tags.length ? item.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>No genre tags yet</span>}
              {sources.map((source) => <span className="result-type" key={source}>{cleanLabel(source)}</span>)}
              <span>{cleanLabel(item.confidence)}</span>
              <span>{cleanLabel(item.reviewStatus ?? "pending")}</span>
              {item.riskFlags.map((risk) => <span className="warning-tag" key={risk}>{cleanLabel(risk)}</span>)}
            </div>
          </section>

          <section className="drawer-section">
            <h3>Identity evidence</h3>
            {item.identityUrls.length ? item.identityUrls.map((url) => <a className="detail-link" href={url} target="_blank" rel="noreferrer" key={url}>{url}</a>) : <p className="muted">No official identity URL returned.</p>}
            {item.externalId ? <code className="compact-code">{item.externalId}</code> : null}
            {Object.keys(item.identifiers).length ? <div className="identity-table">{Object.entries(item.identifiers).map(([key, value]) => <div key={key}><span>{cleanLabel(key)}</span><strong>{value}</strong></div>)}</div> : null}
          </section>

          {item.matches.length ? <section className="drawer-section"><h3>Possible existing matches</h3><div className="compact-stack">{item.matches.map((match) => <div className="match-row" key={match.id}><span>{cleanLabel(match.entityType)} · {Math.round(match.score * 100)}%</span>{match.conflicts.length ? <small>{match.conflicts.map(cleanLabel).join(", ")}</small> : null}</div>)}</div></section> : null}

          <section className="drawer-section">
            <h3>Review</h3>
            <form action={reviewOpportunity} className="drawer-review-form">
              <input type="hidden" name="opportunityId" value={item.id} />
              <input type="hidden" name="submissionNonce" value={item.reviewNonce} />
              <label><span>Decision</span><select className="input" name="disposition" defaultValue={item.reviewDisposition ?? "verify_more"}><option value="verify_more">Verify more</option><option value="create_new">Accept as new</option><option value="enrich_existing">Enrich existing</option><option value="merge_existing">Possible merge</option><option value="quarantine">Quarantine</option><option value="reject">Reject</option></select></label>
              <label><span>Existing match</span><select className="input" name="match" defaultValue=""><option value="">None selected</option>{item.matches.map((match) => <option key={match.id} value={`${match.id}:${match.entityType}:${match.entityId}`}>{cleanLabel(match.entityType)} · {Math.round(match.score * 100)}%</option>)}</select></label>
              <label><span>Note</span><textarea className="input" name="note" defaultValue={item.reviewNote ?? ""} rows={3} placeholder="What did you verify?" /></label>
              <button className="button primary" type="submit">Save review</button>
            </form>
          </section>

          {accepted ? <section className="drawer-section"><h3>Add to ArtistOS</h3><form action={requestOpportunityPromotion} className="drawer-promotion-form">
            <input type="hidden" name="opportunityId" value={item.id} />
            <input type="hidden" name="submissionNonce" value={item.promotionNonce} />
            <select className="input" name="campaignId"><option value="">Add to Network only</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
            <button className="button primary" type="submit">Request promotion</button>
          </form></section> : null}
        </div>

        <footer className="drawer-footer">
          {item.sourceUrl ? <a className="button ghost" href={item.sourceUrl} target="_blank" rel="noreferrer">Open primary source</a> : null}
          <button className="button" type="button" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </div>
  );
}

export default function OpportunityDirectory({ items, campaigns }: { items: DirectoryItem[]; campaigns: DirectoryCampaign[] }) {
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [country, setCountry] = useState("all");
  const [language, setLanguage] = useState("all");
  const [source, setSource] = useState("all");
  const [review, setReview] = useState("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [minimumPopularity, setMinimumPopularity] = useState(0);
  const [sort, setSort] = useState<SortKey>("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const genres = useMemo(() => unique(items.flatMap((item) => item.tags)).sort((a, b) => a.localeCompare(b)).slice(0, 150), [items]);
  const countries = useMemo(() => unique(items.map((item) => item.country)).sort((a, b) => a.localeCompare(b)), [items]);
  const languages = useMemo(() => unique(items.map((item) => item.language)).sort((a, b) => a.localeCompare(b)), [items]);
  const sources = useMemo(() => unique(items.flatMap((item) => item.corroboratingSources.length ? item.corroboratingSources : [item.source])).sort((a, b) => a.localeCompare(b)), [items]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => type === "all" || item.type === type)
      .filter((item) => genre === "all" || item.tags.includes(genre))
      .filter((item) => country === "all" || item.country === country)
      .filter((item) => language === "all" || item.language === language)
      .filter((item) => source === "all" || item.source === source || item.corroboratingSources.includes(source))
      .filter((item) => review === "all" || (item.reviewStatus ?? "pending") === review)
      .filter((item) => minimumPopularity === 0 || (item.popularityValue ?? -1) >= minimumPopularity)
      .filter((item) => {
        if (activity === "all") return true;
        if (activity === "online") return item.activityLabel === "Online";
        if (activity === "current") return item.freshness === "current";
        return !item.activityLabel && item.freshness === "unknown";
      })
      .filter((item) => !normalizedQuery || [item.title, item.summary, item.country, item.state, item.language, ...item.tags].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === "name") return a.title.localeCompare(b.title);
        if (sort === "fit") return (b.fitScore ?? -1) - (a.fitScore ?? -1);
        if (sort === "recent") {
          const rank = { current: 3, aging: 2, unknown: 1, stale: 0 } as Record<string, number>;
          return (rank[b.freshness] ?? 0) - (rank[a.freshness] ?? 0);
        }
        return (b.popularityValue ?? -1) - (a.popularityValue ?? -1) || (b.fitScore ?? -1) - (a.fitScore ?? -1);
      });
  }, [activity, country, genre, items, language, minimumPopularity, query, review, sort, source, type]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const activeFilterCount = [genre !== "all", country !== "all", language !== "all", source !== "all", review !== "all", activity !== "all", minimumPopularity > 0].filter(Boolean).length;

  function clearFilters() {
    setGenre("all");
    setCountry("all");
    setLanguage("all");
    setSource("all");
    setReview("all");
    setActivity("all");
    setMinimumPopularity(0);
  }

  return (
    <section className="directory-workbench">
      <div className="category-tabs" role="tablist" aria-label="Opportunity type">
        {typeOptions.map(([value, label]) => {
          const count = value === "all" ? items.length : items.filter((item) => item.type === value).length;
          return <button key={value} type="button" className={type === value ? "active" : ""} onClick={() => setType(value)}>{label}<span>{count}</span></button>;
        })}
      </div>

      <div className="directory-layout">
        <aside className={`directory-sidebar ${filtersOpen ? "open" : ""}`}>
          <div className="sidebar-heading"><strong>Filters</strong>{activeFilterCount ? <button type="button" onClick={clearFilters}>Clear {activeFilterCount}</button> : null}</div>

          <label className="filter-group"><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">All genres</option>{genres.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="filter-group"><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option value="all">All countries</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="filter-group"><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="all">All languages</option>{languages.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="filter-group"><span>Source</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sources.map((value) => <option key={value} value={value}>{cleanLabel(value)}</option>)}</select></label>
          <label className="filter-group"><span>Review status</span><select value={review} onChange={(event) => setReview(event.target.value)}><option value="all">Any status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="needs_verification">Needs verification</option><option value="quarantined">Quarantined</option><option value="rejected">Rejected</option><option value="promoted">Promoted</option></select></label>

          <fieldset className="filter-group filter-options"><legend>Activity</legend>
            {([['all', 'Any activity'], ['online', 'Online now'], ['current', 'Recently verified'], ['unknown', 'Unknown']] as const).map(([value, label]) => <label key={value}><input type="radio" name="activity-filter" checked={activity === value} onChange={() => setActivity(value)} /><span>{label}</span></label>)}
          </fieldset>

          <fieldset className="filter-group filter-options"><legend>Popularity signal</legend>
            {([[0, 'Any'], [1, 'Has signal'], [100, '100+'], [1000, '1K+']] as const).map(([value, label]) => <label key={value}><input type="radio" name="popularity-filter" checked={minimumPopularity === value} onChange={() => setMinimumPopularity(value)} /><span>{label}</span></label>)}
          </fieldset>

          <button className="button mobile-filter-done" type="button" onClick={() => setFiltersOpen(false)}>Show {filtered.length} results</button>
        </aside>

        <div className="directory-results">
          <div className="directory-toolbar">
            <label className="directory-search"><span className="sr-only">Search results</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, genre, country or keyword" /></label>
            <button className="button ghost mobile-filter-button" type="button" onClick={() => setFiltersOpen(true)}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</button>
            <select aria-label="Sort results" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="popular">Most popular</option><option value="fit">Best fit</option><option value="recent">Most active</option><option value="name">Name A–Z</option></select>
          </div>

          <div className="directory-summary-row">
            <p><strong>{filtered.length}</strong> result{filtered.length === 1 ? "" : "s"}</p>
            <p>{type === "all" ? "All opportunity types" : cleanLabel(type)}</p>
          </div>

          <div className="opportunity-list">
            {filtered.length ? filtered.map((item) => <ResultCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />) : <div className="empty-state"><strong>No matches</strong><p>Clear a filter or run a broader search.</p></div>}
          </div>
        </div>
      </div>

      {filtersOpen ? <button className="filter-backdrop" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} /> : null}
      {selected ? <DetailDrawer item={selected} campaigns={campaigns} onClose={() => setSelectedId(null)} /> : null}
    </section>
  );
}
