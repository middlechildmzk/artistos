import type { Metadata } from "next";
import Link from "next/link";
import { routesByLane } from "@/lib/public-verified-routes";

export const metadata: Metadata = {
  title: "Sync Licensing Submissions for Independent Artists | Verified Routes",
  description: "A verified guide to sync and music-supervision submission routes for independent artists, with current official-source requirements, eligibility notes, and verification dates.",
  alternates: { canonical: "/sync-licensing-submissions" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "Sync Licensing Submissions | ArtistOS Network",
    description: "Verified sync and music-supervision submission routes for independent artists.",
    url: "/sync-licensing-submissions",
    type: "article",
  },
};

const routes = routesByLane("sync");

const checks = [
  ["Are you eligible?", "Some supervision routes only want commercially released artists, represented catalogs, specific genres, or other qualifying material."],
  ["Do you control the rights?", "Before pitching for sync, know who controls the master and composition and whether any samples, collaborators, publishers, or splits require clearance."],
  ["What files are requested?", "A supervision route may ask for downloadable MP3s, a small curated set, metadata, instrumentals, stems, or other assets rather than a generic streaming link."],
  ["Which inbox is correct?", "Supervision, publishing, placement, licensing, and general-contact routes can be separated inside the same company."],
];

export default function SyncLicensingSubmissionsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Sync Licensing Submissions for Independent Artists",
        description: metadata.description,
        datePublished: "2026-08-16",
        dateModified: "2026-08-16",
        author: { "@type": "Organization", name: "ArtistOS Network" },
      },
      {
        "@type": "ItemList",
        name: "Verified sync licensing submission routes",
        itemListElement: routes.map((route, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: route.name,
          url: route.source,
        })),
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Sync opportunity intelligence</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/music-submission-sites">Submission guide</Link><Link className="button ghost compact" href="/verified-routes">All verified routes</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 40, marginBottom: 18 }}>
          <p className="eyebrow">Verified sync submissions</p>
          <h1>Sync licensing submissions for independent artists.</h1>
          <p className="muted" style={{ maxWidth: 880, marginTop: 16, lineHeight: 1.75 }}>Sync pitching has a higher information bar than sending a song to a playlist. The route can depend on release status, catalog eligibility, rights control, file format, and whether the company is accepting supervision submissions at all. ArtistOS records those constraints beside the route.</p>
          <div className="nav-links" style={{ marginTop: 20 }}><span className="pill">{routes.length} verified sync route{routes.length === 1 ? "" : "s"}</span><Link className="button ghost" href="/methodology">Verification methodology</Link></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Quick answer</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>How should independent artists submit music for sync?</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>Start with the music supervisor, licensing company, publisher, or sync agency's current official submission instructions. Confirm that unsolicited submissions are accepted, that your release meets eligibility rules, and that you can accurately represent the rights before sending music.</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Current verified cohort</p><h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Sync routes checked against official public sources</h2></div></div>
          <div className="stack" style={{ marginTop: 12 }}>
            {routes.map((route) => (
              <article className="directory-row" key={route.name}>
                <div className="directory-main">
                  <div className="tag-row"><strong>{route.name}</strong><span className="pill">{route.type}</span><span className="pill">{route.status}</span></div>
                  <p className="muted"><strong style={{ color: "var(--text)" }}>{route.route}.</strong> {route.requirements}</p>
                  <div className="tag-row"><span className="pill">Verified {route.checked}</span><a className="button ghost compact" href={route.source} target="_blank" rel="noreferrer">Official source ↗</a></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Before you pitch</p>
          <h2 style={{ fontSize: "1.5rem", marginTop: 8 }}>Sync readiness is part of route eligibility.</h2>
          <div className="grid two-col" style={{ marginTop: 14 }}>{checks.map(([title, copy]) => <div className="pipeline-card" key={title}><strong>{title}</strong><span className="muted">{copy}</span></div>)}</div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Current example</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>ThinkSync separates submission jobs.</h2><p className="muted" style={{ lineHeight: 1.7 }}>Its current public instructions distinguish supervision submissions from placement or publishing submissions and include eligibility guidance for the material being sent. That context is more useful than publishing one generic email address.</p></div>
          <div className="card"><p className="eyebrow">Rights note</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>A valid submission route does not clear your music.</h2><p className="muted" style={{ lineHeight: 1.7 }}>ArtistOS can record route requirements and rights notes, but artists remain responsible for accurately understanding ownership, samples, splits, publishing, and other permissions before licensing.</p></div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: 32 }}><h2 style={{ fontSize: "1.6rem" }}>Keep sync opportunities connected to rights, contacts, briefs, pitches, and outcomes.</h2><p className="muted">ArtistOS is designed to make that history reusable across releases instead of rebuilding it from email every time.</p><div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/login">Open ArtistOS</Link><Link className="button ghost" href="/music-submission-sites">Browse submission lanes</Link></div></section>
      </div>
    </main>
  );
}
