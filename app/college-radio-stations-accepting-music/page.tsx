import type { Metadata } from "next";
import Link from "next/link";
import { expandedRoutesByLane } from "@/lib/public-verified-routes-expanded";

const routes = expandedRoutesByLane("radio").filter((route) => route.type.toLowerCase().includes("college"));

export const metadata: Metadata = {
  title: "College Radio Stations Accepting Music Submissions | Verified 2026 List",
  description: "A verified 2026 guide to college radio stations accepting independent music, with current digital, email, form, physical-media, and submission requirements from official sources.",
  alternates: { canonical: "/college-radio-stations-accepting-music" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "College Radio Stations Accepting Music | ArtistOS Network",
    description: "Current college-radio submission routes checked against station-owned sources—not copied directory emails.",
    url: "/college-radio-stations-accepting-music",
    type: "article",
  },
};

export default function CollegeRadioStationsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "College Radio Stations Accepting Music Submissions",
        description: metadata.description,
        datePublished: "2026-08-18",
        dateModified: "2026-08-18",
        author: { "@type": "Organization", name: "ArtistOS Network" },
      },
      {
        "@type": "ItemList",
        name: "Verified college radio stations accepting music submissions",
        numberOfItems: routes.length,
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
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">College radio submissions</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/radio-stations-accepting-music">All radio</Link><Link className="button ghost compact" href="/research/music-submission-route-verification">Research</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 40, marginBottom: 18 }}>
          <p className="eyebrow">Verified 2026 college-radio routes</p>
          <h1>College radio stations accepting music submissions.</h1>
          <p className="muted" style={{ maxWidth: 900, marginTop: 16, lineHeight: 1.75 }}>College radio is not one submission system. Some stations accept digital links or email, some publish dedicated forms, some prioritize physical releases, and some currently require physical media. ArtistOS checks the station's own current instructions before listing a route here.</p>
          <div className="nav-links" style={{ marginTop: 18 }}><span className="pill">{routes.length} verified college-radio routes</span><span className="pill">official-source checked</span><span className="pill">updated August 18, 2026</span></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Quick answer</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>How do you submit music to college radio?</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>Start with the station's current Music Department or submission page. Check whether it accepts digital or physical music, whether attachments are allowed, whether it wants singles or multi-track releases, and whether a Music Director email is actually the submission inbox. The 50-route ArtistOS pilot found multiple cases where old directory contacts pointed to the wrong department or the station's submission method had changed.</p>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Digital examples</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>Email, forms, and download links</h2><p className="muted" style={{ lineHeight: 1.7 }}>KJHK, KCSU, KXSC, WNYU, WTBU, WXDU, and other stations in this cohort currently support a digital route of some kind. Requirements differ: links may be preferred over attachments, and a generic staff email may not be the published submission inbox.</p></div>
          <div className="card"><p className="eyebrow">Physical examples</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>Some college stations still want hard copies.</h2><p className="muted" style={{ lineHeight: 1.7 }}>KALX and KDVS currently publish physical-only new-music workflows, while WCBN invites hard-copy submissions and WPRB prioritizes physical packages. A digital-only pitching strategy would miss those current instructions.</p></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Verified list</p><h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>College radio submission routes checked against official sources</h2></div></div>
          <div className="stack" style={{ marginTop: 12 }}>
            {routes.map((route) => (
              <article className="directory-row" key={route.name}>
                <div className="directory-main">
                  <div className="tag-row"><strong>{route.name}</strong><span className="pill">{route.status}</span></div>
                  <p className="muted"><strong style={{ color: "var(--text)" }}>{route.route}.</strong> {route.requirements}</p>
                  <div className="tag-row"><span className="pill">Verified {route.checked}</span><a className="button ghost compact" href={route.source} target="_blank" rel="noreferrer">Official station source ↗</a></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Why verification matters</p>
          <h2 style={{ fontSize: "1.5rem", marginTop: 8 }}>A Music Director email is not automatically a submission route.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>KXSC is a good example: its Music Director staff address exists, but the station's dedicated submission page publishes a different submissions inbox. WPRB similarly separates music submissions from its programming/DJ contact. ArtistOS treats those distinctions as structured route data instead of flattening every public email into a pitch target.</p>
          <Link className="button ghost compact" style={{ marginTop: 12 }} href="/research/music-submission-route-verification">See what changed across all 50 reviewed routes →</Link>
        </section>

        <section className="card" style={{ textAlign: "center", padding: 32 }}><h2 style={{ fontSize: "1.6rem" }}>Need more than college radio?</h2><p className="muted">Browse verified radio, press, sync, and music-submission routes, then connect the right targets to a release campaign inside ArtistOS.</p><div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/verified-routes">Browse verified routes</Link><Link className="button ghost" href="/music-submission-sites">Music submission guide</Link></div></section>
      </div>
    </main>
  );
}
