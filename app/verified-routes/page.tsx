import type { Metadata } from "next";
import Link from "next/link";
import { expandedPublicVerifiedRoutes } from "@/lib/public-verified-routes-expanded";

export const metadata: Metadata = {
  title: "Verified Music Submission Routes for Independent Artists",
  description: "Independently verified music submission routes for radio, press, and sync, with current requirements, official sources, and verification dates.",
  alternates: { canonical: "/verified-routes" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

const laneLinks = [
  ["Radio", "/radio-stations-accepting-music", "College, community, specialty, and independent radio routes."],
  ["Blogs & press", "/music-blogs-accepting-submissions", "Editorial, feature, review, and publication routes."],
  ["Sync", "/sync-licensing-submissions", "Music supervision and licensing submission routes."],
];

export default function VerifiedRoutesPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Verified music submission routes",
    itemListElement: expandedPublicVerifiedRoutes.map((route, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: route.name,
      url: route.source,
    })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Verified routes</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/music-submission-sites">Submission guide</Link><Link className="button ghost compact" href="/research/music-submission-route-verification">Research</Link><Link className="button ghost compact" href="/methodology">Methodology</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 38, marginBottom: 18 }}>
          <p className="eyebrow">Public evidence layer · Updated August 18, 2026</p>
          <h1>Verified music submission routes.</h1>
          <p className="muted" style={{ maxWidth: 850, marginTop: 16, lineHeight: 1.75 }}>These are not copied directory entries. Each public route below was independently checked against current first-party evidence. Requirements are summarized because a valid email or form can still be useless when the artist is ineligible, the format is wrong, or the submission method changed.</p>
          <div className="nav-links" style={{ marginTop: 18 }}><span className="pill">{expandedPublicVerifiedRoutes.length} public verified route records</span><span className="pill">official-source checked</span><span className="pill">dated verification</span></div>
        </section>

        <section className="grid three-col" style={{ marginBottom: 18 }}>
          {laneLinks.map(([title, href, copy]) => <Link className="card" href={href} key={href}><p className="eyebrow">Verified lane</p><h2 style={{ fontSize: "1.3rem", marginTop: 8 }}>{title}</h2><p className="muted">{copy}</p><span className="button ghost compact" style={{ marginTop: 10 }}>Open guide →</span></Link>)}
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Current public cohort</p><h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Routes checked from official public sources</h2></div></div>
          <div className="stack" style={{ marginTop: 12 }}>
            {expandedPublicVerifiedRoutes.map((route) => (
              <article className="directory-row" key={`${route.lane}-${route.name}`}>
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
          <p className="eyebrow">Original research</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>The first 50 checks found 23 clear corrections or downgrades.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>ArtistOS completed a prioritized 50-route verification cohort: 40 routes cleared verification and 10 were withheld as stale or changed. At least 23 required a documented material correction or downgrade. That 46% figure describes this cohort only—it is not presented as an industry-wide rate.</p>
          <Link className="button ghost compact" style={{ marginTop: 12 }} href="/research/music-submission-route-verification">Read the completed 50-route study →</Link>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Important limitation</p><h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Verified does not mean guaranteed acceptance.</h2><p className="muted" style={{ lineHeight: 1.7 }}>Verification means the route and summarized requirements were supported by current public evidence when checked. Editorial taste, capacity, response rate, campaign fit, and future policy changes remain outside that claim.</p></div>
          <div className="card"><p className="eyebrow">Freshness</p><h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Routes can decay after publication.</h2><p className="muted" style={{ lineHeight: 1.7 }}>ArtistOS records verification dates because music-industry submission information changes. Changed, stale, and rechecked routes become research data as the verification cohort grows.</p></div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: 32 }}><h2 style={{ fontSize: "1.6rem" }}>Want the full workflow, not just a list?</h2><p className="muted">ArtistOS connects discovery, fit, evidence, outreach, relationships, and outcomes around each release.</p><div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/login">Open ArtistOS</Link><Link className="button ghost" href="/methodology">Read the verification methodology</Link></div></section>
      </div>
    </main>
  );
}
