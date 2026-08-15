import type { Metadata } from "next";
import Link from "next/link";
import { publicVerifiedRoutes } from "@/lib/public-verified-routes";

export const metadata: Metadata = {
  title: "Music Submission Sites & Routes: What Independent Artists Should Verify First",
  description: "A verified-route guide for independent artists submitting music to radio, blogs, press, and sync opportunities. Learn what to check before pitching and browse current official-source examples.",
  alternates: { canonical: "/music-submission-sites" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "Music Submission Sites & Routes | ArtistOS Network",
    description: "Verified music submission routes with official sources, requirements, and last-checked dates.",
    url: "/music-submission-sites",
    type: "article",
  },
};

const categories = [
  {
    title: "Radio stations accepting music",
    href: "/radio-stations-accepting-music",
    copy: "College, community, specialty, and independent radio routes can differ on digital vs. physical delivery, file format, release size, and local-artist rules.",
  },
  {
    title: "Music blogs accepting submissions",
    href: "/music-blogs-accepting-submissions",
    copy: "Editorial routes can split reviews, premieres, features, social support, playlist consideration, and label demos into different inboxes or forms.",
  },
  {
    title: "Sync licensing submissions",
    href: "/sync-licensing-submissions",
    copy: "Music-supervision and placement routes often have stricter release, rights, file, catalog, and eligibility requirements than ordinary press pitching.",
  },
];

const checks = [
  ["Is the route still open?", "A page can remain indexed long after the form, inbox, or program changed."],
  ["Is this the right route type?", "Editorial, demo, playlist, radio, and sync submissions can use different channels inside the same organization."],
  ["Are you eligible?", "Some routes require an EP/album, commercial release, local connection, specific rights, physical media, or another condition."],
  ["What format is accepted?", "A working email can still be the wrong route if the outlet requires a form, download link, physical release, or no attachments."],
  ["Is it free or paid?", "Separate an application or campaign fee from optional services, and verify the price at the official source before paying."],
  ["When was it checked?", "Freshness is part of the data. A route verified months ago should not be presented with the same confidence as one checked today."],
];

export default function MusicSubmissionSitesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Music Submission Sites & Routes: What Independent Artists Should Verify First",
    description: metadata.description,
    datePublished: "2026-08-15",
    dateModified: "2026-08-15",
    author: { "@type": "Organization", name: "ArtistOS Network" },
    about: ["music submission", "independent artists", "radio submission", "music blogs", "sync licensing"],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Verified music submission intelligence</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/verified-routes">Verified routes</Link><Link className="button ghost compact" href="/methodology">Methodology</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: 40, marginBottom: 18 }}>
          <p className="eyebrow">Independent artist guide</p>
          <h1>Music submission sites are only useful if the route is still true.</h1>
          <p className="muted" style={{ maxWidth: 880, marginTop: 16, lineHeight: 1.75 }}>Before pitching a playlist, radio station, music blog, label, or sync contact, verify the current official submission route, eligibility, format, cost, and last-updated evidence. ArtistOS is building that verification layer instead of treating old directory entries as permanent facts.</p>
          <div className="nav-links" style={{ marginTop: 20 }}><Link className="button primary" href="/verified-routes">Browse {publicVerifiedRoutes.length} verified pilot routes</Link><Link className="button ghost" href="/methodology">How verification works</Link></div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Quick answer</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>Where can independent artists submit music?</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>Common routes include radio music departments, college and community stations, music publications, editorial feature forms, playlists, labels, and music-supervision or sync companies. The important question is not only whether an organization appears on a list; it is whether the current official source still supports the route and whether your release matches its requirements.</p>
        </section>

        <section className="grid three-col" style={{ marginBottom: 18 }}>
          {categories.map((category) => <Link className="card" href={category.href} key={category.href}><p className="eyebrow">Verified lane</p><h2 style={{ fontSize: "1.35rem", marginTop: 8 }}>{category.title}</h2><p className="muted" style={{ lineHeight: 1.65 }}>{category.copy}</p><span className="button ghost compact" style={{ marginTop: 12 }}>Open guide →</span></Link>)}
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Six checks before you submit</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>A valid URL is not enough.</h2>
          <div className="grid two-col" style={{ marginTop: 14 }}>{checks.map(([title, copy]) => <div className="pipeline-card" key={title}><strong>{title}</strong><span className="muted">{copy}</span></div>)}</div>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card"><p className="eyebrow">What “verified” means here</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>Supported by a current public source when checked.</h2><p className="muted" style={{ lineHeight: 1.7 }}>It does not mean guaranteed acceptance, guaranteed response, editorial fit, or permanent availability. The source and verification date stay attached because routes change.</p></div>
          <div className="card"><p className="eyebrow">Why lists decay</p><h2 style={{ fontSize: "1.4rem", marginTop: 8 }}>Submission information has a half-life.</h2><p className="muted" style={{ lineHeight: 1.7 }}>Forms close, addresses change, digital routes become physical-only, pricing changes, and eligibility rules get rewritten. ArtistOS records those changes as data rather than silently leaving stale entries active.</p></div>
        </section>

        <section className="card" style={{ textAlign: "center", padding: 32 }}><h2 style={{ fontSize: "1.6rem" }}>Use the evidence, then build a release-specific target list.</h2><p className="muted">The private ArtistOS workspace connects routes to fit, outreach, relationships, placements, and outcomes.</p><div className="nav-links" style={{ justifyContent: "center" }}><Link className="button primary" href="/login">Open ArtistOS</Link><Link className="button ghost" href="/verified-routes">See current verified routes</Link></div></section>
      </div>
    </main>
  );
}
