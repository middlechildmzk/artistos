import type { Metadata } from "next";
import Link from "next/link";
import { routesByLane } from "@/lib/public-verified-routes";

export const metadata: Metadata = {
  title: "Music Blogs Accepting Submissions | Verified Press Routes for Independent Artists",
  description: "Browse independently verified music blog and press submission routes with official sources, current route types, requirements, and verification dates.",
  alternates: { canonical: "/music-blogs-accepting-submissions" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "Music Blogs Accepting Submissions | ArtistOS Network",
    description: "Verified music press and editorial submission routes for independent artists.",
    url: "/music-blogs-accepting-submissions",
    type: "article",
  },
};

const routes = routesByLane("press");

const checks = [
  ["Editorial or demo?", "A publication and its associated label can use different submission routes. Sending the right music to the wrong inbox is still a failed pitch."],
  ["What are you asking for?", "Review, premiere, interview, playlist consideration, social support, and label-demo consideration are different editorial jobs."],
  ["What assets are required?", "Verify whether the outlet asks for a streaming link, private link, download, press copy, artwork, release date, or another asset."],
  ["Is the route current?", "A form or inbox can remain quoted by third-party lists after the publication changes how it handles submissions."],
];

export default function MusicBlogsAcceptingSubmissionsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Music Blogs Accepting Submissions",
        description: metadata.description,
        datePublished: "2026-08-16",
        dateModified: "2026-08-16",
        author: { "@type": "Organization", name: "ArtistOS Network" },
      },
      {
        "@type": "ItemList",
        name: "Verified music blogs and press routes accepting submissions",
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
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Music press submission intelligence</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/music-submission-sites">Submission guide</Link><Link className="button ghost compact" href="/verified-routes">All verified routes</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 40, marginBottom: 18 }}>
          <p className="eyebrow">Verified press submissions</p>
          <h1>Music blogs accepting submissions.</h1>
          <p className="muted" style={{ maxWidth: 880, marginTop: 16, lineHeight: 1.75 }}>A publication appearing on an old “blogs accepting music” list does not prove its current route is open. ArtistOS checks the publication's own current submission or contact source, then records what the route is actually for.</p>
          <div className="nav-links" style={{ marginTop: 20 }}><span className="pill">{routes.length} verified press routes</span><Link className="button ghost" href="/methodology">Verification methodology</Link></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Quick answer</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>How should independent artists submit music to blogs and press?</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>Use the publication's current official feature, review, contact, or submission route and match the request to that route. Editorial review, social support, playlist consideration, premieres, and label demos may be handled separately even by the same brand.</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Current verified cohort</p><h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Press routes checked against official public sources</h2></div></div>
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
          <h2 style={{ fontSize: "1.5rem", marginTop: 8 }}>Treat the submission route as part of editorial fit.</h2>
          <div className="grid two-col" style={{ marginTop: 14 }}>{checks.map(([title, copy]) => <div className="pipeline-card" key={title}><strong>{title}</strong><span className="muted">{copy}</span></div>)}</div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Why the route type matters</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>Magnetic Magazine illustrates the split.</h2><p className="muted" style={{ lineHeight: 1.7 }}>Its current public contact information separates editorial music from label-demo submissions. The organization name is the same; the job of the route is not.</p></div>
          <div className="card"><p className="eyebrow">What “accepting” means</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>Open for consideration is not promised coverage.</h2><p className="muted" style={{ lineHeight: 1.7 }}>ArtistOS verifies the stated route and requirements. Editorial selection, coverage timing, response, audience fit, and placement remain outside that claim.</p></div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: 32 }}><h2 style={{ fontSize: "1.6rem" }}>Keep press outreach connected to the release, person, interaction, and outcome.</h2><p className="muted">The private ArtistOS workspace turns one-off pitching into reusable relationship and campaign memory.</p><div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/login">Open ArtistOS</Link><Link className="button ghost" href="/music-submission-sites">Browse submission lanes</Link></div></section>
      </div>
    </main>
  );
}
