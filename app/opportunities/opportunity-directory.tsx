"use client";

import { useEffect, useMemo, useState } from "react";
import { requestOpportunityPromotion, reviewOpportunity } from "./actions";

export type DirectoryMatch = {
  id: string;
  entityType: string;
  entityId: string;
  score: number;
  conflicts: string[];
};

export type DirectoryReleaseFit = {
  releaseTitle: string;
  score: number | null;
  knownDimensionCount: number;
  totalDimensionCount: number;
  explanations: string[];
  decision: string | null;
  shortlisted: boolean;
  readinessState: string | null;
  ineligible: boolean;
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
  ownerOrCurator: string | null;
  submissionRouteUrl: string | null;
  submissionRouteType: string | null;
  workflowMode: string | null;
  acceptsReleased: string | null;
  acceptsUnreleased: string | null;
  feeAmount: number | null;
  feeCurrency: string | null;
  eligibilityNotes: string | null;
  verificationClaim: string | null;
  observedAt: string | null;
  sourceFile: string | null;
  activityLabel: string | null;
  matches: DirectoryMatch[];
  reviewNonce: string;
  promotionNonce: string;
  releaseFit?: DirectoryReleaseFit;
};

export type DirectoryCampaign = { id: string; name: string };

type SortKey = "fit" | "popular" | "route" | "recent" | "name";
type ActivityFilter = "all" | "online" | "current" | "unknown";
type ReleaseFitFilter = "all" | "evidenced" | "recommended" | "shortlisted";
type RouteFilter = "all" | "available" | "free" | "paid" | "research";

const typeOptions = [
  ["all", "All"],
  ["playlist", "Playlists"],
  ["youtube_channel", "YouTube"],
  ["creator", "Creators"],
  ["publication", "Press & blogs"],
  ["radio", "Radio"],
  ["podcast", "Podcasts"],
  ["label", "Labels"],
  ["sync", "Sync"],
  ["music_library", "Libraries"],
  ["booking", "Live & booking"],
  ["other", "Industry & other"],
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
  other: "OT",
};

const resultPageSize = 60;

const tagAliases: Record<string, string> = {
  "all edm": "EDM",
  edm: "EDM",
  "electronic dance music": "EDM",
  "future bass": "Future Bass",
  "melodic bass": "Melodic Bass",
  "melodic dubstep": "Melodic Dubstep",
  "chill electronic": "Chill Electronic",
  "indie electronic": "Indie Electronic",
  "chill hip hop": "Chillhop",
  "chill hiphop": "Chillhop",
  "chillhop beats": "Chillhop",
  "chill out": "Chillout",
  "chill-out": "Chillout",
  chillout: "Chillout",
  chillstep: "Chillstep",
  "lo fi": "Lo-Fi",
  "lo-fi": "Lo-Fi",
  lofi: "Lo-Fi",
  dnb: "Drum & Bass",
  "drum and bass": "Drum & Bass",
  "drum & bass": "Drum & Bass",
  "r&b": "R&B",
};

const genericTags = new Set([
  "all",
  "other",
  "website",
  "playlist",
  "youtube",
  "youtube channel",
  "blog",
  "blog media",
  "radio",
  "label",
  "record label",
]);

const internalLabelPattern = /(?:all in one|master|pasted research|reconstruction|malformed|uncertain|\bkimi\b|\bgemini\b|\bgrok\b|\bmeta\b|source log|export code)/i;

function cleanLabel(value: string | null | undefined, fallback = "Unknown") {
  const cleaned = value?.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeTag(value: string) {
  const cleaned = value.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  const lowered = cleaned.toLowerCase();
  if (!cleaned || genericTags.has(lowered) || internalLabelPattern.test(cleaned)) return null;
  return tagAliases[lowered] ?? titleCase(cleaned.toLowerCase());
}

function publicTags(item: DirectoryItem) {
  return unique(item.tags.map(normalizeTag)).slice(0, 12);
}

function normalizeLanguage(value: string | null) {
  if (!value) return null;
  const parts = value.toLowerCase().split(/[,;/]+/).map((part) => part.trim()).filter(Boolean);
  const mapped = unique(parts.map((part) => {
    if (["en", "eng", "english", "english uk", "en-us", "en-gb"].includes(part)) return "English";
    if (["es", "spa", "spanish"].includes(part)) return "Spanish";
    if (["ru", "rus", "russian"].includes(part)) return "Russian";
    if (["zh", "cn", "china", "chinese", "mandarin"].includes(part)) return "Chinese";
    if (["fr", "fra", "french"].includes(part)) return "French";
    if (["de", "deu", "german"].includes(part)) return "German";
    if (["pt", "por", "portuguese"].includes(part)) return "Portuguese";
    return titleCase(part);
  }));
  return mapped.length > 1 ? "Multilingual" : mapped[0] ?? null;
}

function normalizeCountry(value: string | null) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = {
    us: "United States",
    usa: "United States",
    "united states of america": "United States",
    uk: "United Kingdom",
    gb: "United Kingdom",
    au: "Australia",
    ca: "Canada",
  };
  return aliases[cleaned.toLowerCase()] ?? titleCase(cleaned.toLowerCase());
}

function score(value: number | null) {
  return value == null ? "—" : Math.round(value).toString();
}

function effectiveFit(item: DirectoryItem) {
  return item.releaseFit ? item.releaseFit.score : item.fitScore;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function safeRouteUrl(value: string | null) {
  return value && /^(https?:\/\/|mailto:)/i.test(value) ? value : null;
}

function routeKind(item: DirectoryItem): Exclude<RouteFilter, "all"> {
  if (!safeRouteUrl(item.submissionRouteUrl)) return "research";
  if (item.feeAmount === 0) return "free";
  if (item.feeAmount != null && item.feeAmount > 0) return "paid";
  return "available";
}

function routeLabel(item: DirectoryItem) {
  const kind = routeKind(item);
  if (kind === "free") return "Free submission";
  if (kind === "paid") return "Paid submission";
  if (kind === "available") return "Submission route";
  return "Route research needed";
}

function feeLabel(item: DirectoryItem) {
  if (item.feeAmount == null) return safeRouteUrl(item.submissionRouteUrl) ? "Check terms" : "Not listed";
  if (item.feeAmount === 0) return "Free";
  const currency = /^[A-Z]{3}$/.test(item.feeCurrency ?? "") ? item.feeCurrency! : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(item.feeAmount);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function typeLabel(value: string) {
  return typeOptions.find(([key]) => key === value)?.[1] ?? cleanLabel(value);
}

function ResultCard({ item, onOpen }: { item: DirectoryItem; onOpen: () => void }) {
  const location = [normalizeCountry(item.country), item.state].filter(Boolean).join(" · ");
  const subtitle = [typeLabel(item.type), location, normalizeLanguage(item.language)].filter(Boolean).join(" · ");
  const tags = publicTags(item);
  const submissionUrl = safeRouteUrl(item.submissionRouteUrl);
  const fit = effectiveFit(item);

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
            <span className={`status-dot ${item.activityLabel === "Online" || item.freshness === "current" ? "current" : ""}`} title={`Last checked: ${cleanLabel(item.freshness)}`} />
          </span>
          <span className="opportunity-tags">
            <span className={`route-badge route-${routeKind(item)}`}>{routeLabel(item)}</span>
            {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
            {item.corroborationCount > 1 ? <span className="positive">{item.corroborationCount} references</span> : null}
            {item.releaseFit?.shortlisted ? <span className="positive">Shortlisted</span> : null}
            {item.releaseFit && item.releaseFit.knownDimensionCount > 0 ? <span className="release-fit-tag">{item.releaseFit.knownDimensionCount} match signals</span> : null}
          </span>
          {item.summary ? <span className="opportunity-summary">{item.summary}</span> : null}
        </span>
      </button>

      <div className="opportunity-metrics">
        <div><strong>{item.popularityLabel ?? "—"}</strong><span>Audience</span></div>
        <div><strong>{fit == null ? "—" : `${Math.round(fit)}%`}</strong><span>Match</span></div>
        <div><strong>{feeLabel(item)}</strong><span>Cost</span></div>
      </div>

      <div className="opportunity-actions">
        <button className="button ghost compact-button" type="button" onClick={onOpen}>Details</button>
        {submissionUrl ? <a className="button primary compact-button" href={submissionUrl} target={submissionUrl.startsWith("mailto:") ? undefined : "_blank"} rel={submissionUrl.startsWith("mailto:") ? undefined : "noreferrer"}>Submit</a> : null}
      </div>
    </article>
  );
}

function DetailDrawer({ item, campaigns, onClose }: { item: DirectoryItem; campaigns: DirectoryCampaign[]; onClose: () => void }) {
  const accepted = item.reviewStatus === "accepted";
  const location = [normalizeCountry(item.country), item.state].filter(Boolean).join(" · ");
  const tags = publicTags(item);
  const routeUrl = safeRouteUrl(item.submissionRouteUrl);
  const officialUrls = unique([item.sourceUrl, ...item.identityUrls]).filter((url) => /^https?:\/\//i.test(url));
  const fit = effectiveFit(item);

  return (
    <div className="opportunity-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="opportunity-drawer" role="dialog" aria-modal="true" aria-labelledby="opportunity-drawer-title">
        <header className="drawer-header">
          <div className={`opportunity-avatar large type-${item.type}`} aria-hidden="true">{typeMarks[item.type] ?? item.title.slice(0, 2).toUpperCase()}</div>
          <div>
            <span className="eyebrow">{typeLabel(item.type)}</span>
            <h2 id="opportunity-drawer-title">{item.title}</h2>
            <p>{[location, normalizeLanguage(item.language)].filter(Boolean).join(" · ") || "Opportunity details"}</p>
          </div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="Close details" autoFocus>×</button>
        </header>

        <div className="drawer-body">
          <section className="drawer-score-grid">
            <div><strong>{item.popularityLabel ?? "—"}</strong><span>Audience</span></div>
            <div><strong>{fit == null ? "—" : `${Math.round(fit)}%`}</strong><span>Match</span></div>
            <div><strong>{feeLabel(item)}</strong><span>Cost</span></div>
            <div><strong>{item.activityLabel ?? cleanLabel(item.freshness)}</strong><span>Last checked</span></div>
          </section>

          {item.summary ? <section className="drawer-section"><h3>About</h3><p>{item.summary}</p></section> : null}

          {item.releaseFit ? (
            <section className="drawer-section drawer-release-fit">
              <h3>Fit for {item.releaseFit.releaseTitle}</h3>
              <p><strong>{score(item.releaseFit.score)}% match</strong> based on {item.releaseFit.knownDimensionCount} available release signals</p>
              {item.releaseFit.explanations.length ? <ul>{item.releaseFit.explanations.slice(0, 4).map((explanation) => <li key={explanation}>{explanation}</li>)}</ul> : <p>Add more release details to improve this recommendation.</p>}
              <div className="opportunity-tags">
                {item.releaseFit.shortlisted ? <span className="positive">Shortlisted</span> : null}
                {item.releaseFit.ineligible ? <span className="warning-tag">May not be eligible</span> : null}
              </div>
            </section>
          ) : null}

          <section className="drawer-section">
            <h3>Genres and fit</h3>
            <div className="opportunity-tags">
              {tags.length ? tags.map((tag) => <span key={tag}>{tag}</span>) : <span>Genres not listed</span>}
              {item.corroborationCount > 1 ? <span className="positive">{item.corroborationCount} supporting references</span> : null}
            </div>
          </section>

          <section className="drawer-section route-section">
            <div className="route-heading"><h3>How to submit</h3><span className={`route-state route-${routeKind(item)}`}>{routeLabel(item)}</span></div>
            <p className="route-caution">Submission details can change. Confirm the destination, eligibility and current terms before sending your music.</p>
            <div className="route-grid">
              <div><span>Method</span><strong>{cleanLabel(item.submissionRouteType, routeUrl ? "Direct link" : "Not listed")}</strong></div>
              <div><span>Fee</span><strong>{feeLabel(item)}</strong></div>
              <div><span>Released music</span><strong>{cleanLabel(item.acceptsReleased)}</strong></div>
              <div><span>Unreleased music</span><strong>{cleanLabel(item.acceptsUnreleased)}</strong></div>
            </div>
            {item.ownerOrCurator ? <p><strong>Owner or curator:</strong> {item.ownerOrCurator}</p> : null}
            {item.eligibilityNotes ? <p>{item.eligibilityNotes}</p> : null}
            {routeUrl ? <a className="button primary compact-button route-link" href={routeUrl} target={routeUrl.startsWith("mailto:") ? undefined : "_blank"} rel={routeUrl.startsWith("mailto:") ? undefined : "noreferrer"}>Open submission route</a> : <p className="muted">A direct submission route has not been confirmed yet.</p>}
          </section>

          <details className="drawer-section drawer-research-details">
            <summary>Research details</summary>
            <div className="drawer-research-body">
              {officialUrls.length ? officialUrls.map((url) => <a className="detail-link" href={url} target="_blank" rel="noreferrer" key={url}>{url}</a>) : <p className="muted">No official page is available yet.</p>}
              <p className="identity-meta">{item.observedAt ? `Last researched ${item.observedAt.slice(0, 10)}` : "Research date unavailable"}</p>
            </div>
          </details>

          <details className="drawer-section drawer-record-management">
            <summary>Manage record</summary>
            {item.matches.length ? <div className="drawer-match-review"><strong>Possible existing matches</strong>{item.matches.map((match) => <div className="match-row" key={match.id}><span>{cleanLabel(match.entityType)} · {Math.round(match.score * 100)}%</span>{match.conflicts.length ? <small>{match.conflicts.map((conflict) => cleanLabel(conflict)).join(", ")}</small> : null}</div>)}</div> : null}
            <form action={reviewOpportunity} className="drawer-review-form">
              <input type="hidden" name="opportunityId" value={item.id} />
              <input type="hidden" name="submissionNonce" value={item.reviewNonce} />
              <label><span>Decision</span><select className="input" name="disposition" defaultValue={item.reviewDisposition ?? "verify_more"}><option value="verify_more">Verify more</option><option value="create_new">Accept as new</option><option value="enrich_existing">Enrich existing</option><option value="merge_existing">Possible merge</option><option value="quarantine">Quarantine</option><option value="reject">Reject</option></select></label>
              <label><span>Existing match</span><select className="input" name="match" defaultValue=""><option value="">None selected</option>{item.matches.map((match) => <option key={match.id} value={`${match.id}:${match.entityType}:${match.entityId}`}>{cleanLabel(match.entityType)} · {Math.round(match.score * 100)}%</option>)}</select></label>
              <label><span>Note</span><textarea className="input" name="note" defaultValue={item.reviewNote ?? ""} rows={3} placeholder="What did you verify?" /></label>
              <button className="button primary" type="submit">Save review</button>
            </form>
          </details>

          {accepted ? <section className="drawer-section"><h3>Save to your network</h3><form action={requestOpportunityPromotion} className="drawer-promotion-form">
            <input type="hidden" name="opportunityId" value={item.id} />
            <input type="hidden" name="submissionNonce" value={item.promotionNonce} />
            <select className="input" name="campaignId"><option value="">Add to Network only</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
            <button className="button primary" type="submit">Save opportunity</button>
          </form></section> : null}
        </div>

        <footer className="drawer-footer">
          {officialUrls[0] ? <a className="button ghost" href={officialUrls[0]} target="_blank" rel="noreferrer">View website</a> : null}
          {routeUrl ? <a className="button primary" href={routeUrl} target={routeUrl.startsWith("mailto:") ? undefined : "_blank"} rel={routeUrl.startsWith("mailto:") ? undefined : "noreferrer"}>Submit music</a> : null}
          <button className="button" type="button" onClick={onClose}>Close</button>
        </footer>
      </aside>
    </div>
  );
}

export default function OpportunityDirectory({ items, campaigns }: { items: DirectoryItem[]; campaigns: DirectoryCampaign[] }) {
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [route, setRoute] = useState<RouteFilter>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [releaseFit, setReleaseFit] = useState<ReleaseFitFilter>("all");
  const [minimumPopularity, setMinimumPopularity] = useState(0);
  const [sort, setSort] = useState<SortKey>("fit");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(resultPageSize);

  const browsableItems = useMemo(
    () => items.filter((item) => !["quarantined", "rejected"].includes(item.reviewStatus ?? "")),
    [items],
  );
  const genres = useMemo(
    () => unique(browsableItems.flatMap(publicTags)).sort((a, b) => a.localeCompare(b)),
    [browsableItems],
  );
  const countries = useMemo(
    () => unique(browsableItems.map((item) => normalizeCountry(item.country))).sort((a, b) => a.localeCompare(b)),
    [browsableItems],
  );
  const languages = useMemo(
    () => unique(browsableItems.map((item) => normalizeLanguage(item.language))).sort((a, b) => a.localeCompare(b)),
    [browsableItems],
  );
  const hasReleaseFit = browsableItems.some((item) => item.releaseFit);
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of browsableItems) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    return counts;
  }, [browsableItems]);
  const activeTypes = typeOptions.filter(([value]) => value === "all" || (typeCounts.get(value) ?? 0) > 0);
  const routeCount = useMemo(() => browsableItems.filter((item) => Boolean(safeRouteUrl(item.submissionRouteUrl))).length, [browsableItems]);
  const freeCount = useMemo(() => browsableItems.filter((item) => routeKind(item) === "free").length, [browsableItems]);
  const audienceCount = useMemo(() => browsableItems.filter((item) => item.popularityValue != null).length, [browsableItems]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return browsableItems
      .filter((item) => type === "all" || item.type === type)
      .filter((item) => !genre || publicTags(item).some((tag) => tag.toLowerCase().includes(genre.trim().toLowerCase())))
      .filter((item) => !country || normalizeCountry(item.country) === country)
      .filter((item) => !language || normalizeLanguage(item.language) === language)
      .filter((item) => {
        if (route === "all") return true;
        if (route === "available") return Boolean(safeRouteUrl(item.submissionRouteUrl));
        return routeKind(item) === route;
      })
      .filter((item) => {
        if (releaseFit === "all") return true;
        if (releaseFit === "shortlisted") return item.releaseFit?.shortlisted === true;
        if (releaseFit === "evidenced") return (item.releaseFit?.knownDimensionCount ?? 0) > 0;
        return Boolean(item.releaseFit && !item.releaseFit.ineligible && item.releaseFit.explanations.length > 0);
      })
      .filter((item) => minimumPopularity === 0 || (item.popularityValue ?? -1) >= minimumPopularity)
      .filter((item) => {
        if (activity === "all") return true;
        if (activity === "online") return item.activityLabel === "Online";
        if (activity === "current") return item.freshness === "current";
        return !item.activityLabel && item.freshness === "unknown";
      })
      .filter((item) => !normalizedQuery || [
        item.title,
        item.summary,
        item.ownerOrCurator,
        normalizeCountry(item.country),
        item.state,
        normalizeLanguage(item.language),
        ...publicTags(item),
      ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === "name") return a.title.localeCompare(b.title);
        if (sort === "fit") return (effectiveFit(b) ?? -1) - (effectiveFit(a) ?? -1) || (b.popularityValue ?? -1) - (a.popularityValue ?? -1);
        if (sort === "route") {
          const rank: Record<Exclude<RouteFilter, "all">, number> = { free: 4, available: 3, paid: 2, research: 1 };
          return rank[routeKind(b)] - rank[routeKind(a)] || (effectiveFit(b) ?? -1) - (effectiveFit(a) ?? -1);
        }
        if (sort === "recent") {
          const observedDelta = Date.parse(b.observedAt ?? "") - Date.parse(a.observedAt ?? "");
          if (Number.isFinite(observedDelta) && observedDelta !== 0) return observedDelta;
          const freshnessRank = { current: 3, aging: 2, unknown: 1, stale: 0 } as Record<string, number>;
          return (freshnessRank[b.freshness] ?? 0) - (freshnessRank[a.freshness] ?? 0);
        }
        return (b.popularityValue ?? -1) - (a.popularityValue ?? -1) || (effectiveFit(b) ?? -1) - (effectiveFit(a) ?? -1);
      });
  }, [activity, browsableItems, country, genre, language, minimumPopularity, query, releaseFit, route, sort, type]);

  const selected = browsableItems.find((item) => item.id === selectedId) ?? null;
  const visible = filtered.slice(0, visibleCount);
  const activeFilterCount = [genre, country, language, route !== "all", activity !== "all", releaseFit !== "all", minimumPopularity > 0].filter(Boolean).length;

  const activeFilters = [
    genre ? { label: genre, clear: () => setGenre("") } : null,
    country ? { label: country, clear: () => setCountry("") } : null,
    language ? { label: language, clear: () => setLanguage("") } : null,
    route !== "all" ? { label: route === "available" ? "Submission route available" : route === "free" ? "Free submission" : route === "paid" ? "Paid submission" : "Route research needed", clear: () => setRoute("all") } : null,
    releaseFit !== "all" ? { label: releaseFit === "recommended" ? "Recommended" : releaseFit === "evidenced" ? "Match evidence" : "Shortlisted", clear: () => setReleaseFit("all") } : null,
    activity !== "all" ? { label: activity === "online" ? "Online now" : activity === "current" ? "Recently checked" : "Unknown activity", clear: () => setActivity("all") } : null,
    minimumPopularity > 0 ? { label: `${formatCount(minimumPopularity)}+ audience`, clear: () => setMinimumPopularity(0) } : null,
  ].filter((filter): filter is { label: string; clear: () => void } => Boolean(filter));

  function clearFilters() {
    setType("all");
    setQuery("");
    setGenre("");
    setCountry("");
    setLanguage("");
    setRoute("all");
    setActivity("all");
    setReleaseFit("all");
    setMinimumPopularity(0);
  }

  useEffect(() => {
    setVisibleCount(resultPageSize);
  }, [activity, country, genre, language, minimumPopularity, query, releaseFit, route, sort, type]);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  return (
    <section className="directory-workbench">
      <div className="directory-overview">
        <div className="directory-overview-copy">
          <span className="eyebrow">Opportunity directory</span>
          <strong>{formatCount(browsableItems.length)} places to pitch, promote and license your music</strong>
          <p>Compare fit, audience and submission details before you send.</p>
        </div>
        <div className="directory-quick-stats" aria-label="Quick filters">
          <button type="button" aria-pressed={route === "available"} className={route === "available" ? "active" : ""} onClick={() => setRoute(route === "available" ? "all" : "available")}><strong>{formatCount(routeCount)}</strong><span>Submission routes</span></button>
          <button type="button" aria-pressed={route === "free"} className={route === "free" ? "active" : ""} onClick={() => setRoute(route === "free" ? "all" : "free")}><strong>{formatCount(freeCount)}</strong><span>Free to submit</span></button>
          <button type="button" aria-pressed={minimumPopularity === 1} className={minimumPopularity === 1 ? "active" : ""} onClick={() => setMinimumPopularity(minimumPopularity === 1 ? 0 : 1)}><strong>{formatCount(audienceCount)}</strong><span>Audience listed</span></button>
        </div>
      </div>

      <div className="category-tabs" role="tablist" aria-label="Opportunity type">
        {activeTypes.map(([value, label]) => {
          const count = value === "all" ? browsableItems.length : typeCounts.get(value) ?? 0;
          return <button key={value} type="button" role="tab" aria-selected={type === value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{label}<span>{formatCount(count)}</span></button>;
        })}
      </div>

      <div className="directory-layout">
        <aside className={`directory-sidebar ${filtersOpen ? "open" : ""}`}>
          <div className="sidebar-heading"><div><strong>Refine results</strong><small>{activeFilterCount ? `${activeFilterCount} applied` : "Choose what matters"}</small></div>{activeFilterCount ? <button type="button" onClick={clearFilters}>Reset all</button> : null}</div>

          <label className="filter-group"><span>Genre or mood</span><input list="opportunity-genres" value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="All genres" autoComplete="off" /><datalist id="opportunity-genres">{genres.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label className="filter-group"><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">All countries</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="filter-group"><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">All languages</option>{languages.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="filter-group"><span>Submission route</span><select value={route} onChange={(event) => setRoute(event.target.value as RouteFilter)}><option value="all">Any route</option><option value="available">Route available</option><option value="free">Free to submit</option><option value="paid">Paid submission</option><option value="research">Route needs research</option></select></label>

          {hasReleaseFit ? <label className="filter-group"><span>Release match</span><select value={releaseFit} onChange={(event) => setReleaseFit(event.target.value as ReleaseFitFilter)}><option value="all">Any match</option><option value="recommended">Recommended for this release</option><option value="evidenced">Has match evidence</option><option value="shortlisted">Shortlisted</option></select></label> : null}

          <label className="filter-group"><span>Last checked</span><select value={activity} onChange={(event) => setActivity(event.target.value as ActivityFilter)}><option value="all">Any time</option><option value="online">Online now</option><option value="current">Recently checked</option><option value="unknown">Unknown</option></select></label>

          <label className="filter-group"><span>Minimum audience</span><select value={minimumPopularity} onChange={(event) => setMinimumPopularity(Number(event.target.value))}><option value={0}>Any size</option><option value={1}>Audience listed</option><option value={100}>100+</option><option value={1000}>1K+</option><option value={10000}>10K+</option><option value={100000}>100K+</option></select></label>

          <button className="button mobile-filter-done" type="button" onClick={() => setFiltersOpen(false)}>Show {filtered.length} results</button>
        </aside>

        <div className="directory-results">
          <div className="directory-toolbar">
            <label className="directory-search"><span className="sr-only">Search opportunities</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, genre, curator or country" /></label>
            <button className="button ghost mobile-filter-button" type="button" onClick={() => setFiltersOpen(true)}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</button>
            <label className="directory-sort"><span>Sort</span><select aria-label="Sort opportunities" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="fit">Best match</option><option value="route">Submission-ready</option><option value="popular">Largest audience</option><option value="recent">Recently checked</option><option value="name">A–Z</option></select></label>
          </div>

          {activeFilters.length ? <div className="active-filter-chips" aria-label="Applied filters">{activeFilters.map((filter) => <button key={filter.label} type="button" onClick={filter.clear}>{filter.label}<span aria-hidden="true">×</span></button>)}</div> : null}

          <div className="directory-summary-row">
            <p><strong>{formatCount(filtered.length)}</strong> result{filtered.length === 1 ? "" : "s"}{visible.length < filtered.length ? ` · showing ${formatCount(visible.length)}` : ""}</p>
            <p>{type === "all" ? "All opportunities" : typeLabel(type)}</p>
          </div>

          <div className="opportunity-list">
            {filtered.length ? visible.map((item) => <ResultCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />) : <div className="empty-state"><strong>No opportunities match those filters</strong><p>Try a broader genre, audience size or submission-route setting.</p><button className="button ghost" type="button" onClick={clearFilters}>Reset filters</button></div>}
            {visible.length < filtered.length ? <div className="load-more-row"><button className="button ghost" type="button" onClick={() => setVisibleCount((count) => count + resultPageSize)}>Show {Math.min(resultPageSize, filtered.length - visible.length)} more</button><span>{formatCount(filtered.length - visible.length)} remaining</span></div> : null}
          </div>
        </div>
      </div>

      {filtersOpen ? <button className="filter-backdrop" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} /> : null}
      {selected ? <DetailDrawer item={selected} campaigns={campaigns} onClose={() => setSelectedId(null)} /> : null}
    </section>
  );
}
