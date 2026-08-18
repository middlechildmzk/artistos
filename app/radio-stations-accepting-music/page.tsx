import type { Metadata } from "next";
import Link from "next/link";
import { expandedRoutesByLane } from "@/lib/public-verified-routes-expanded";

export const metadata: Metadata = {
  title: "Radio Stations Accepting Music Submissions | Verified 2026 Routes",
  description: "Browse independently verified radio submission routes for independent artists, including current digital, physical, and eligibility requirements with official sources and verification dates.",
  alternates: { canonical: "/radio-stations-accepting-music" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "Radio Stations Accepting Music | ArtistOS Network",
    description: "Verified radio submission routes with official sources, current requirements, and last-checked dates.",
    url: "/radio-stations-accepting-music",
    type: "article",
  },
};

const routes = expandedRoutesByLane("radio");

const checks = [
  ["Digital or physical?", "Some stations accept streaming or download links; others still require professionally pressed physical media."],
  ["Single, EP, or album?", "A station may require multiple distinct tracks even when the submission route itself is open."],
  ["Attachment policy", "A working music-director email does not mean attachments are accepted. Follow the station's stated delivery method."],
  ["Local or format rules", "Community, college, specialty, and local programming can have different eligibility or programming constraints."],
];

export default function RadioStationsAcceptingMusicPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Radio Stations Accepting Music Submissions",
        description: metadata.description,
        datePublished: "2026-08-16",
        dateModified: "2026-08-18",
        author: { "@type": "Organization", name: "ArtistOS Network" },
      },
      {
        "@type": "ItemList",
        name: "Verified radio stations accepting music submissions",
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
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Radio submission intelligence</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/music-submission-sites">Submission guide</Link><Link className="button ghost compact" href="/research/music-submission-route-verification">Research</Link><Link className="button ghost compact" href="/verified-routes">All verified routes</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 40, marginBottom: 18 }}>
          <p className="eyebrow">Verified radio submissions · Updated August 18, 2026</p>
          <h1>Radio stations accepting music submissions.</h1>
          <p className="muted" style={{ maxWidth: 880, marginTop: 16, lineHeight: 1.75 }}>The useful question is not simply whether a station accepts music. It is how it accepts music today. ArtistOS checks the current official route, delivery format, eligibility rules, and verification date before publishing a route here.</p>
          <div className="nav-links" style={{ marginTop: 20 }}><span className="pill">{routes.length} verified radio routes</span><Link className="button ghost" href="/methodology">Verification methodology</Link></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Quick answer</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>How do independent artists submit music to radio?</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>Radio submission methods vary by station. Current routes can include a music-director email, an official submission form, downloadable files, streaming links, or physical CDs and vinyl. The station's own submission page should determine the method; an old directory email is not enough evidence on its own.</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Current verified cohort</p><h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Radio routes checked against official public sources</h2></div></div>
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
          <p className="eyebrow">What the first 50 checks found</p>
          <h2 style={{ fontSize: "1.5rem", marginTop: 8 }}>Copied radio lists can fail in several different ways.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>Across the completed 50-route ArtistOS pilot cohort, documented corrections included wrong departments, staff contacts presented as submission inboxes, digital routes that became physical-only, dead policy pages, and contacts that current first-party evidence could no longer substantiate. <Link href="/research/music-submission-route-verification">See the full research snapshot →</Link></p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Before you send</p>
          <h2 style={{ fontSize: "1.5rem", marginTop: 8 }}>Four details that change the submission.</h2>
          <div className="grid two-col" style={{ marginTop: 14 }}>{checks.map(([title, copy]) => <div className="pipeline-card" key={title}><strong>{title}</strong><span className="muted">{copy}</span></div>)}</div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">One visible example of route decay</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>KALX currently requires physical media.</h2><p className="muted" style={{ lineHeight: 1.7 }}>That is exactly why copied lists are risky: a remembered email or digital workflow can stay in circulation after the station's current instructions change. The official-source requirement should win.</p></div>
          <div className="card"><p className="eyebrow">What verification does not promise</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>An open route is not a placement guarantee.</h2><p className="muted" style={{ lineHeight: 1.7 }}>Programming taste, capacity, genre fit, response time, and airplay decisions remain with the station. ArtistOS verifies the route and stated requirements, not the outcome.</p></div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: 32 }}><h2 style={{ fontSize: "1.6rem" }}>Build radio into the same release campaign as playlists, press, creators, and sync.</h2><p className="muted">ArtistOS connects verified routes to release fit, outreach history, relationships, placements, and outcomes.</p><div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/login">Open ArtistOS</Link><Link className="button ghost" href="/music-submission-sites">Browse submission lanes</Link></div></section>
      </div>
    </main>
  );
}
