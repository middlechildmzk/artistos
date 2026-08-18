import type { Metadata } from "next";
import Link from "next/link";

const reviewed = 50;
const verified = 40;
const staleOrChanged = 10;
const clearCorrections = 23;
const minimumCorrectionRate = ((clearCorrections / reviewed) * 100).toFixed(1);

const examples = [
  {
    name: "KALX 90.7 FM",
    before: "Stored as a music-submission email route.",
    after: "Current official instructions require professionally pressed CDs or LPs by physical mail and reject digital submissions.",
    source: "https://www.kalx.berkeley.edu/about/contact/",
    label: "Email → physical-only",
  },
  {
    name: "Radio Milwaukee",
    before: "Stored URL pointed to the station's In The Mix form for 29-minute DJ sets.",
    after: "The current general artist route is a separate Music Submission page with its own audio and radio-edit requirements.",
    source: "https://radiomilwaukee.org/music-submission",
    label: "Wrong form corrected",
  },
  {
    name: "KXSC Radio",
    before: "Stored music@kxsc.org, which is a Music Director staff address.",
    after: "KXSC's dedicated Music Submission page publishes submissions@kxsc.org—or physical mail—as the submission route.",
    source: "https://kxsc.org/musicsubmission/",
    label: "Staff email ≠ submission inbox",
  },
  {
    name: "KDVS 90.3 FM",
    before: "Stored an older Gmail route from a secondary source.",
    after: "Current KDVS instructions say new music submissions are physical-only; the Music Director email is a contact route, not digital intake.",
    source: "https://kdvs.org/about/faq",
    label: "Digital → physical-only",
  },
  {
    name: "WPRB 103.3 FM",
    before: "Stored program@wprb.com as the music-submission email.",
    after: "Current WPRB guidance reserves that address for DJ/show proposals and uses music@wprb.com for music submissions.",
    source: "https://wprb.com/contact/",
    label: "Wrong department corrected",
  },
  {
    name: "WFUV 90.7 FM",
    before: "Stored musicdept@wfuv.org as the submission email.",
    after: "Current official guidance says to send music by mail to the Music Department; the email is for general music questions.",
    source: "https://wfuv.org/contact",
    label: "Email → mail workflow",
  },
  {
    name: "CJTR / AccessNow 91.3",
    before: "Stored a show-specific Gmail address as the station submission route.",
    after: "Current station-wide guidance uses a different local-submission contact and recommends !earshot Distro as the preferred general digital route.",
    source: "https://accessnowradio.ca/contact/",
    label: "Show contact → station route",
  },
  {
    name: "The BIRN",
    before: "Historical submission page and submit@thebirn.com were treated as a current route.",
    after: "The BIRN's current homepage says the station is on hiatus, so ArtistOS withholds the historical submission workflow from sendable status.",
    source: "https://thebirn.com/",
    label: "Station on hiatus",
  },
  {
    name: "UCLA Radio",
    before: "Directory seed treated radio.music@media.ucla.edu as an open submission email.",
    after: "The current official contact page supports it as Music Programming Inquiries, not enough evidence for an open unsolicited-submission policy.",
    source: "https://uclaradio.com/contact-us/",
    label: "Claim downgraded",
  },
  {
    name: "CBC Music",
    before: "Stored musicprogrammers@cbc.ca as an open submission address.",
    after: "ArtistOS could not substantiate that stored route from a current first-party CBC source, so the route is withheld rather than guessed from secondary guidance.",
    source: "https://www.cbc.ca/listen",
    label: "Stored route withheld",
  },
];

export const metadata: Metadata = {
  title: "50 Music Submission Routes Re-Checked | ArtistOS Research",
  description: `ArtistOS checked ${reviewed} music-submission routes against current official sources. ${clearCorrections} required a clear correction or downgrade. See the evidence and limitations.`,
  alternates: { canonical: "/research/music-submission-route-verification" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "50 Music Submission Routes Re-Checked | ArtistOS",
    description: `${reviewed} routes checked against official sources. ${clearCorrections} clear material corrections or downgrades documented in the prioritized cohort.`,
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
        headline: "What Happened When ArtistOS Re-Checked 50 Music Submission Routes",
        description: metadata.description,
        datePublished: "2026-08-16",
        dateModified: "2026-08-18",
        author: { "@type": "Organization", name: "ArtistOS Network" },
      },
      {
        "@type": "Dataset",
        name: "ArtistOS 50-Route Music Submission Verification Cohort",
        description: `A prioritized cohort of ${reviewed} public music-submission routes checked against current official sources.`,
        dateModified: "2026-08-18",
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
          <p className="eyebrow">Completed pilot cohort · Updated August 18, 2026</p>
          <h1>What happened when we re-checked 50 music submission routes?</h1>
          <p className="muted" style={{ maxWidth: 900, fontSize: "1.08rem", lineHeight: 1.75, marginTop: 16 }}>ArtistOS manually re-checked a prioritized cohort of music-industry submission endpoints against current official public sources. The result is not a generic directory: it is a record of which routes still work, which changed, and which claims should no longer be treated as sendable.</p>
        </section>

        <section className="grid three-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Reviewed cohort</p><h2 style={{ fontSize: "2.5rem", marginTop: 8 }}>{reviewed}</h2><p className="muted">Every endpoint in the pilot cohort has now been reviewed.</p></div>
          <div className="card"><p className="eyebrow">Current verified</p><h2 style={{ fontSize: "2.5rem", marginTop: 8 }}>{verified}</h2><p className="muted">Routes supported strongly enough to keep as current verified opportunities.</p></div>
          <div className="card"><p className="eyebrow">Stale / changed</p><h2 style={{ fontSize: "2.5rem", marginTop: 8 }}>{staleOrChanged}</h2><p className="muted">Routes withheld from sendable status because the stored claim no longer cleared verification.</p></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Conservative correction signal</p>
          <h2 style={{ fontSize: "1.7rem", marginTop: 8 }}>At least {clearCorrections} of {reviewed} routes required a clear material correction or downgrade.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>That is a <strong style={{ color: "var(--text)" }}>{minimumCorrectionRate}% minimum observed correction rate</strong> in this prioritized cohort. The count includes documented cases such as the wrong inbox, wrong department, wrong submission type, a dead policy page, a station hiatus, or a stored submission claim that current official evidence could no longer support.</p>
          <p className="muted" style={{ lineHeight: 1.75 }}><strong style={{ color: "var(--text)" }}>This is not an industry-wide decay rate.</strong> The 50 routes were prioritized for product verification rather than randomly sampled from every music opportunity. The statistic describes this cohort only. A larger stratified or randomized sample would be required to estimate a population-wide rate.</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-heading"><div><p className="eyebrow">Representative changes</p><h2 style={{ fontSize: "1.6rem", marginTop: 8 }}>Ten examples from the verification trail</h2></div></div>
          <div className="stack" style={{ marginTop: 14 }}>
            {examples.map((example) => <article className="directory-row" key={example.name}><div className="directory-main"><div className="tag-row"><strong>{example.name}</strong><span className="pill">{example.label}</span></div><p className="muted"><strong style={{ color: "var(--text)" }}>Before:</strong> {example.before}</p><p className="muted"><strong style={{ color: "var(--text)" }}>Current finding:</strong> {example.after}</p><a className="button ghost compact" href={example.source} target="_blank" rel="noreferrer">Official source ↗</a></div></article>)}
          </div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">Method</p><h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Official source wins.</h2><p className="muted" style={{ lineHeight: 1.7 }}>A directory, spreadsheet, aggregator, old email, or previously observed route is only a discovery seed. Verification requires current public evidence from the organization itself whenever that evidence is available.</p></div>
          <div className="card"><p className="eyebrow">Classification</p><h2 style={{ fontSize: "1.45rem", marginTop: 8 }}>Uncertainty is a status, not a reason to guess.</h2><p className="muted" style={{ lineHeight: 1.7 }}>If the current official source confirms only a staff/inquiry contact—or fails to confirm a stored submission claim—the route stays non-sendable rather than being promoted as open.</p></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Next research layer</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Expand beyond the initial 50 and report by opportunity type.</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>The next cohort should expand across radio, press, playlists, labels, sync, creators, and other public routes while preserving every verification event. That lets ArtistOS publish category-specific correction rates, verification-age curves, and recurring re-check results instead of one undifferentiated directory count.</p>
          <div className="nav-links" style={{ marginTop: 18 }}><Link className="button primary" href="/verified-routes">Browse currently verified routes</Link><Link className="button ghost" href="/methodology">Read verification methodology</Link></div>
        </section>
      </div>
    </main>
  );
}
