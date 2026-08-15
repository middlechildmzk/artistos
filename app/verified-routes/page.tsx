import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Verified Music Submission Routes for Independent Artists",
  description: "A public pilot of independently verified music submission routes for radio, blogs, and editorial outlets, with current requirements, official sources, and verification dates.",
  alternates: { canonical: "/verified-routes" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

const routes = [
  {
    name: "KEXP",
    type: "Radio",
    status: "Open",
    route: "Digital submission email",
    requirements: "Send streaming/download links to md@kexp.org. Do not send attachments.",
    checked: "August 13, 2026",
    source: "https://www.kexp.org/about/submission-guidelines/",
  },
  {
    name: "KCSU 90.5 FM",
    type: "College radio",
    status: "Open",
    route: "Official submission form",
    requirements: "Use the current digital submission form. music@kcsufm.com is listed for music-department contact.",
    checked: "August 13, 2026",
    source: "https://kcsufm.com/submitmusic/",
  },
  {
    name: "KJHK 90.7 FM",
    type: "College radio",
    status: "Open",
    route: "Digital submission email",
    requirements: "Current electronic submission route: submitmusic@kjhk.org.",
    checked: "August 13, 2026",
    source: "https://kjhk.org/web/submit-music/",
  },
  {
    name: "KALX 90.7 FM",
    type: "College radio",
    status: "Open with restrictions",
    route: "Physical mail",
    requirements: "Professionally pressed CDs or LPs only. Current instructions reject digital submissions and streaming/download links.",
    checked: "August 13, 2026",
    source: "https://www.kalx.berkeley.edu/about/contact/",
  },
  {
    name: "Radio K (KUOM)",
    type: "College radio",
    status: "Open",
    route: "Physical or digital",
    requirements: "Accepts physical releases and digital submissions through the Music Department workflow; digital submissions should use downloadable files or supported download links.",
    checked: "August 13, 2026",
    source: "https://radiok.org/submitting-music",
  },
  {
    name: "CFRU 93.3 FM",
    type: "Community radio",
    status: "Open with eligibility rules",
    route: "Digital music department",
    requirements: "General digital submissions should be an EP or album with at least three distinct songs. Download links are preferred; high-quality MP3s are recommended.",
    checked: "August 13, 2026",
    source: "https://www.cfru.ca/music/",
  },
  {
    name: "Electric Hawk",
    type: "Electronic music press",
    status: "Open",
    route: "Official feature form",
    requirements: "Current Get Featured workflow accepts music for editorial consideration, social support, and playlist consideration through the official form.",
    checked: "August 13, 2026",
    source: "https://theelectrichawk.com/get-featured-on-electric-hawk/",
  },
  {
    name: "Magnetic Magazine",
    type: "Music publication / label",
    status: "Open",
    route: "Separate editorial and demo routes",
    requirements: "Editorial music goes to the publication's current music-review inbox; label demos use the separate Magnetic Magazine Recordings demo inbox.",
    checked: "August 13, 2026",
    source: "https://magneticmag.com/contact/",
  },
  {
    name: "ThinkSync Music",
    type: "Sync / music supervision",
    status: "Open with eligibility rules",
    route: "Dedicated submissions inbox",
    requirements: "Commercially released artists can submit a small set of MP3s by download link to the supervision submissions route; placement/publishing submissions use a separate inbox.",
    checked: "August 13, 2026",
    source: "https://thinksyncmusic.com/contact/submissions/",
  },
];

export default function VerifiedRoutesPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Verified music submission routes",
    itemListElement: routes.map((route, index) => ({
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
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Verified routes pilot</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/methodology">Methodology</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: "38px", marginBottom: 18 }}>
          <p className="eyebrow">Public evidence layer</p>
          <h1>Verified music submission routes.</h1>
          <p className="muted" style={{ maxWidth: 850, marginTop: 16, lineHeight: 1.75 }}>These are not copied directory entries. Each route below was independently checked against a current public source. Requirements are summarized because a valid email or form can still be useless when the artist is ineligible, the format is wrong, or the submission method changed.</p>
          <div className="nav-links" style={{ marginTop: 18 }}><span className="pill">{routes.length} public pilot routes</span><span className="pill">official-source checked</span><span className="pill">dated verification</span></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Current pilot</p><h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Routes checked from official public sources</h2></div></div>
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

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card">
            <p className="eyebrow">Important limitation</p>
            <h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Verified does not mean guaranteed acceptance.</h2>
            <p className="muted" style={{ lineHeight: 1.7 }}>Verification means the route and summarized requirements were supported by a current public source when checked. Editorial taste, capacity, response rate, campaign fit, and future policy changes remain outside that claim.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Freshness</p>
            <h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Routes can decay after publication.</h2>
            <p className="muted" style={{ lineHeight: 1.7 }}>ArtistOS records verification dates because music-industry submission information changes. A future version of this page will surface changed, stale, and rechecked routes as the verification cohort grows.</p>
          </div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: "32px" }}>
          <h2 style={{ fontSize: "1.6rem" }}>Want the full workflow, not just a list?</h2>
          <p className="muted">ArtistOS connects discovery, fit, evidence, outreach, relationships, and outcomes around each release.</p>
          <div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/login">Open ArtistOS</Link><Link className="button ghost" href="/methodology">Read the verification methodology</Link></div>
        </section>
      </div>
    </main>
  );
}
