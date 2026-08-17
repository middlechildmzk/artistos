import type { Metadata } from "next";
import Link from "next/link";

const reviewed = 23;
const verified = 21;
const staleOrChanged = 2;
const clearCorrections = 4;
const minimumCorrectionRate = ((clearCorrections / reviewed) * 100).toFixed(1);

const examples = [
  {
    name: "KALX 90.7 FM",
    before: "Stored as a music-submission email route.",
    after: "Current official instructions require professionally pressed CDs or LPs by physical mail and reject digital submissions.",
    source: "https://www.kalx.berkeley.edu/about/contact/",
    label: "Route materially changed",
  },
  {
    name: "Radio Milwaukee",
    before: "Stored URL pointed to the station's In The Mix form for 29-minute DJ sets.",
    after: "The current general artist route is a separate Music Submission page requiring uncompressed audio, radio edits, and no physical media.",
    source: "https://radiomilwaukee.org/music-submission",
    label: "Wrong route corrected",
  },
  {
    name: "CiTR 101.9 FM",
    before: "Stored music@citr.ca as an open music-submission route.",
    after: "Current official material checked did not confirm that stored route. CiTR currently surfaces music.executive@citr.ca for Music Collective inquiries, so the old route remains non-sendable pending stronger evidence.",
    source: "https://www.citr.ca/radio/spit-in-your-ear/",
    label: "Stored route not confirmed",
  },
  {
    name: "UCLA Radio",
    before: "Directory seed treated radio.music@media.ucla.edu as an open music-submission email.",
    after: "UCLA Radio's current official contact page labels it Music Programming Inquiries. That is not enough evidence to claim an open unsolicited submission policy.",
    source: "https://uclaradio.com/contact-us/",
    label: "Claim downgraded",
  },
];

export const metadata: Metadata = {
  title: "Music Submission Route Verification Pilot | ArtistOS Research",
  description: `ArtistOS checked ${reviewed} music-submission routes against current official sources. See what remained valid, what changed, and why this pilot is not an industry-wide decay-rate estimate.`,
  alternates: { canonical: "/research/music-submission-route-verification" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "Music Submission Route Verification Pilot | ArtistOS",
    description: `${reviewed} routes checked against official sources. ${clearCorrections} clear material corrections or downgrades documented in the pilot cohort.`,
    url: "/research/music-submission-route-verification",
    type: "article",
  },
};

export default function RouteVerificationResearchPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Music Submission Route Verification Pilot",
        description: metadata.description,
        datePublished: "2026-08-16",
        dateModified: "2026-08-16",
        author: { "@type": "Organization", name: "ArtistOS Network" },
      },
      {
        "@type": "Dataset",
        name: "ArtistOS Music Submission Route Verification Pilot",
        description: `A prioritized pilot cohort of ${reviewed} public music-submission routes checked against current official sources.`,
        dateModified: "2026-08-16",
        variableMeasured: ["verification status", "route change", "submission method", "official-source support"],
        measurementTechnique: "Manual verification against current official public sources",
        creator: { "@type": "Organization", name: "ArtistOS Network" },
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Original route research</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/verified-routes">Verified routes</Link><Link className="button ghost compact" href="/methodology">Methodology</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 42, marginBottom: 18 }}>
          <p className="eyebrow">Pilot research · August 16, 2026</p>
          <h1>What happens when you actually re-check music submission routes?</h1>
          <p className="muted" style={{ maxWidth: 900, fontSize: "1.08rem", lineHeight: 1.75, marginTop: 16 }}>ArtistOS is building a verification layer for music-industry opportunities. This first public snapshot covers a prioritized cohort of submission endpoints checked manually against current official sources. The purpose is to measure the verification problem before making larger claims about route decay.</p>
        </section>

        <section className="grid three-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Reviewed cohort</p><h2 style={{ fontSize: "2.5rem", marginTop: 8 }}>{reviewed}</h2><p className="muted">Submission endpoints reviewed against official public evidence.</p></div>
          <div className="card"><p className="eyebrow">Current verified</p><h2 style={{ fontSize: "2.5rem", marginTop: 8 }}>{verified}</h2><p className="muted">Routes currently supported strongly enough to mark verified.</p></div>
          <div className="card"><p className="eyebrow">Stale / changed</p><h2 style={{ fontSize: "2.5rem", marginTop: 8 }}>{staleOrChanged}</h2><p className="muted">Routes deliberately withheld from sendable status after current review.</p></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Conservative correction signal</p>
          <h2 style={{ fontSize: "1.7rem", marginTop: 8 }}>At least {clearCorrections} of {reviewed} reviewed routes needed a clear material correction or downgrade.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>That is a <strong style={{ color: "var(--text)" }}>{minimumCorrectionRate}% minimum observed correction rate</strong> in this pilot cohort. It is intentionally conservative: only cases with a clearly documented mismatch between the stored claim and current official evidence are counted here.</p>
          <p className="muted" style={{ lineHeight: 1.75 }}><strong style={{ color: "var(--text)" }}>This is not an industry-wide decay rate.</strong> The cohort was prioritized for product verification, not randomly sampled from every music submission opportunity. The number describes this reviewed cohort only and should not be generalized to the entire music industry.</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">What changed</p><h2 style={{ fontSize: "1.6rem", marginTop: 8 }}>Four clear examples from the evidence trail</h2></div></div>
          <div className="stack" style={{ marginTop: 14 }}>
            {examples.map((example) => <article className="directory-row" key={example.name}><div className="directory-main"><div className="tag-row"><strong>{example.name}</strong><span className="pill">{example.label}</span></div><p className="muted"><strong style={{ color: "var(--text)" }}>Before:</strong> {example.before}</p><p className="muted"><strong style={{ color: "var(--text)" }}>Current finding:</strong> {example.after}</p><a className="button ghost compact" href={example.source} target="_blank" rel="noreferrer">Official source ↗</a></div></article>)}
          </div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Method</p><h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Official source wins.</h2><p className="muted" style={{ lineHeight: 1.7 }}>A directory, spreadsheet, aggregator, old email, or previously observed route is treated as a discovery seed. Verification requires current public evidence from the organization itself whenever that evidence is available.</p></div>
          <div className="card"><p className="eyebrow">Classification</p><h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Uncertainty is a status, not a reason to guess.</h2><p className="muted" style={{ lineHeight: 1.7 }}>If the current official source confirms only an inquiry contact—or fails to confirm a stored submission claim—the route stays non-sendable rather than being promoted as open.</p></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">What comes next</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>A larger cohort can support stronger claims.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>The next research layer is to expand the verified cohort across radio, press, playlists, labels, sync, and creator routes; predefine change categories; preserve every verification event; and report results by source category and verification age. Until then, the 17.4% figure remains a descriptive pilot statistic—not a population estimate.</p>
          <div className="nav-links" style={{ marginTop: 18 }}><Link className="button primary" href="/verified-routes">Browse currently verified routes</Link><Link className="button ghost" href="/methodology">Read verification methodology</Link></div>
        </section>
      </div>
    </main>
  );
}
