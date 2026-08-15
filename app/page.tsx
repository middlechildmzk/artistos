import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ArtistOS Network | Verified Music Submission & Opportunity Intelligence",
  description: "Find where your next release belongs. ArtistOS Network helps independent artists discover playlists, radio, blogs, creators, labels, sync opportunities, and submission routes with evidence and verification.",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "ArtistOS Network | Know Where Your Next Release Belongs",
    description: "Evidence-first music opportunity intelligence for independent artists.",
    url: "/",
    type: "website",
  },
};

const lanes = [
  ["Playlists", "Find curator and playlist opportunities by genre, fit, reach, and route status."],
  ["Radio", "Discover college, community, specialty, and independent radio routes with current submission requirements."],
  ["Blogs & press", "Find publications that still accept music and see what each route actually requires."],
  ["Creators & YouTube", "Map channels and creators that fit the sound, audience, and campaign goal."],
  ["Labels & industry", "Track labels, publishers, managers, PR firms, and industry organizations without losing the evidence trail."],
  ["Sync", "Identify licensing and supervision opportunities, submission requirements, and rights constraints."],
];

const trust = [
  "Official-source evidence",
  "Last-verified dates",
  "Route-change tracking",
  "Eligibility and format requirements",
  "Free / paid route context",
  "Human-review workflow",
];

export default function HomePage() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ArtistOS Network",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Music industry opportunity intelligence",
    operatingSystem: "Web",
    description: "Evidence-first music opportunity intelligence for independent artists, covering playlists, radio, blogs, creators, labels, sync opportunities, and verified submission routes.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand">
            <div className="logo">A</div>
            <div>
              <strong>ArtistOS Network</strong>
              <div className="eyebrow">Music opportunity intelligence</div>
            </div>
          </Link>
          <nav className="nav-links">
            <Link className="button ghost compact" href="/verified-routes">Verified routes</Link>
            <Link className="button ghost compact" href="/methodology">Methodology</Link>
            <Link className="button primary compact" href="/login">Open ArtistOS</Link>
          </nav>
        </header>

        <section className="card release-card" style={{ padding: "42px", marginBottom: 18 }}>
          <p className="eyebrow">ArtistOS Network Intelligence</p>
          <h1>Know where your next release belongs.</h1>
          <p className="muted" style={{ maxWidth: 820, fontSize: "1.08rem", lineHeight: 1.75, marginTop: 16 }}>
            ArtistOS helps independent artists discover the playlists, radio stations, blogs, creators, labels, sync routes, and industry opportunities that actually fit a release — then keeps the source, route, verification history, outreach, and outcome connected.
          </p>
          <div className="nav-links" style={{ marginTop: 24 }}>
            <Link className="button primary" href="/verified-routes">Explore verified routes</Link>
            <Link className="button ghost" href="/login">Open the private workspace</Link>
          </div>
        </section>

        <section className="grid three-col" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="eyebrow">Problem</div>
            <h2 style={{ marginTop: 8 }}>Directories decay.</h2>
            <p className="muted">Submission forms close, emails change, fees move, and eligibility rules get rewritten. A stale contact list wastes time and money.</p>
          </div>
          <div className="card">
            <div className="eyebrow">ArtistOS difference</div>
            <h2 style={{ marginTop: 8 }}>Evidence, not copied claims.</h2>
            <p className="muted">Public facts are tied to sources, verification state, and the date they were checked so artists can see what is current and what needs another look.</p>
          </div>
          <div className="card">
            <div className="eyebrow">Workflow</div>
            <h2 style={{ marginTop: 8 }}>Discovery becomes memory.</h2>
            <p className="muted">Targets, people, submission routes, interactions, placements, and outcomes stay connected instead of disappearing into spreadsheets and browser tabs.</p>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Opportunity graph</p>
              <h2 style={{ fontSize: "1.6rem", marginTop: 8 }}>One network across the places artists actually pitch.</h2>
            </div>
          </div>
          <div className="grid three-col" style={{ marginTop: 14 }}>
            {lanes.map(([title, copy]) => (
              <div key={title} className="pipeline-card">
                <strong>{title}</strong>
                <span className="muted">{copy}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card">
            <p className="eyebrow">Verified route intelligence</p>
            <h2 style={{ fontSize: "1.6rem", marginTop: 8 }}>A submission route should tell you more than where to click.</h2>
            <p className="muted">ArtistOS is building route records around the questions artists actually need answered before pitching.</p>
            <div className="stack compact-stack">
              {trust.map((item) => <div key={item} className="row"><strong>{item}</strong><span className="pill">tracked</span></div>)}
            </div>
            <Link href="/verified-routes" className="button primary" style={{ marginTop: 18 }}>See the verified-routes pilot</Link>
          </div>
          <div className="card">
            <p className="eyebrow">Why this matters</p>
            <h2 style={{ fontSize: "1.6rem", marginTop: 8 }}>The internet is full of music-industry lists. Very few tell you when the route stopped being true.</h2>
            <p className="muted" style={{ lineHeight: 1.7 }}>ArtistOS treats freshness as product data. When a digital route becomes physical-only, a form closes, an AI-music policy changes, or a publication changes how it accepts pitches, that change belongs in the record.</p>
            <p className="muted" style={{ lineHeight: 1.7 }}>That verification layer is also the basis for public research on route decay: how often music-submission information becomes stale, what changes first, and which categories require the most frequent rechecking.</p>
          </div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: "34px" }}>
          <p className="eyebrow">Built for independent artists</p>
          <h2 style={{ fontSize: "1.8rem", marginTop: 8 }}>Stop asking “where can I submit this?” from scratch every release.</h2>
          <p className="muted" style={{ maxWidth: 760, margin: "12px auto 20px", lineHeight: 1.7 }}>Build a reusable network of opportunities, evidence, relationships, and outcomes around your music.</p>
          <div className="nav-links" style={{ justifyContent: "center" }}>
            <Link className="button primary" href="/login">Open ArtistOS</Link>
            <Link className="button ghost" href="/methodology">How verification works</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
