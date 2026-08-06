import type { MusicActivityFeedItem } from "@/lib/music-activity/feed";

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(parsed);
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ");
}

function freshnessClass(value: MusicActivityFeedItem["freshness"]) {
  return value === "current" ? "pill" : "pill blocked";
}

export function MusicActivityFeed({ items }: { items: MusicActivityFeedItem[] }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">Unified observation stream</div>
          <h2>Music activity</h2>
          <p className="muted">Placements, source updates, first-party actions and Proof receipts in one source-visible timeline.</p>
        </div>
        <span className="pill">{items.length} observations</span>
      </div>

      {items.length ? items.slice(0, 30).map((item) => (
        <article className="row" key={item.key} style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <strong>{item.title}</strong>
            <p className="muted">{item.detail}</p>
            <div className="tag-row">
              <span className="pill">{humanize(item.kind)}</span>
              <span className="pill">{humanize(item.sourceClass)}</span>
              <span className={freshnessClass(item.freshness)}>{item.freshness}</span>
              <span className={`pill ${item.identityState === "strong_recording_identity" ? "" : "blocked"}`}>
                {item.identityState === "strong_recording_identity" ? `ISRC ${item.isrc}` : humanize(item.identityState)}
              </span>
              <span className={`pill ${["verified", "recorded", "source observed"].includes(item.verificationStatus) ? "" : "blocked"}`}>
                {humanize(item.verificationStatus)}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <strong>{item.source}</strong>
            <p className="muted">{formatTimestamp(item.eventAt)}</p>
            {item.sourceUrl ? <a className="next-action" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a> : null}
          </div>
        </article>
      )) : <div className="empty">No activity has been observed yet. Connect a source, import a report, or use an ArtistOS release link.</div>}

      {items.length > 30 ? <p className="muted">Showing the 30 most recent observations. Full filtering and pagination are planned for the persistent activity ledger.</p> : null}
    </section>
  );
}
