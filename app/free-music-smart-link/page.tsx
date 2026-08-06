import type { Metadata } from "next";
import { ArrowRight, BarChart3, Headphones, MailPlus, MousePointerClick, Music2, Route, Sparkles } from "lucide-react";
import Link from "next/link";
import styles from "./smart-link.module.css";

export const metadata: Metadata = {
  title: "Free Music Smart Link for Artists",
  description: "Create a free music smart link for Spotify, Apple Music, YouTube Music, SoundCloud and more. Track clicks, campaign sources and fan signups with ArtistOS.",
  keywords: ["free music smart link", "smart link for music", "Spotify smart link", "Apple Music smart link", "Linkfire alternative for musicians"],
  alternates: { canonical: "/free-music-smart-link" },
  openGraph: {
    title: "Free Music Smart Link for Artists | ArtistOS",
    description: "One fast music link for every streaming service, campaign and fan.",
    url: "/free-music-smart-link",
  },
};

const features = [
  [Headphones, "Every major music service", "Add Spotify, Apple Music, YouTube Music, Amazon Music, Deezer, TIDAL, SoundCloud, Bandcamp and more."],
  [MousePointerClick, "Click tracking", "See page views and destination clicks without losing the campaign that produced them."],
  [Route, "Campaign attribution", "Create trackable links for Instagram, TikTok, email, ads, press and every outreach channel."],
  [MailPlus, "Artist-owned audience", "Optionally collect consented fan emails directly on the release page."],
  [BarChart3, "Release-level insights", "Connect link behavior to the same release, campaign and performance workspace."],
  [Sparkles, "Network matches next", "Move from fan link to playlists, radio, media, labels, sync and creator opportunities."],
] as const;

export default function FreeMusicSmartLinkPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a music smart link?",
        acceptedAnswer: { "@type": "Answer", text: "A music smart link gives fans one release page with buttons for the streaming services they already use." },
      },
      {
        "@type": "Question",
        name: "Is the ArtistOS music smart link free?",
        acceptedAnswer: { "@type": "Answer", text: "Yes. ArtistOS includes a free music smart link inside each release workspace." },
      },
      {
        "@type": "Question",
        name: "Can ArtistOS track music-link campaigns?",
        acceptedAnswer: { "@type": "Answer", text: "ArtistOS tracks page views, destination clicks and UTM campaign attribution, with optional consented fan signup." },
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/"><span>A</span> ArtistOS</Link>
        <div><Link href="/">Explore ArtistOS</Link><Link className={styles.navCta} href="/login">Create free link</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>ArtistOS Links Free</span>
          <h1>One music link. Every place your fans listen.</h1>
          <p>Create a fast, music-first smart link for every release. Send fans to their preferred service, measure each campaign and keep the data connected to the release.</p>
          <div className={styles.actions}><Link className={styles.primary} href="/login">Create your free music link <ArrowRight aria-hidden="true" size={16} /></Link><a className={styles.secondary} href="#features">See what is included</a></div>
          <small>No separate link product to manage. It lives with the release in ArtistOS.</small>
        </div>

        <div className={styles.linkMockup} aria-label="Example ArtistOS music smart link">
          <div className={styles.mockGlow} />
          <div className={styles.cover}><span>Never Alone</span></div>
          <span className={styles.mockEyebrow}>New single</span>
          <h2>Never Alone</h2>
          <p>Middle Child</p>
          <div className={styles.services}>
            {["Spotify", "Apple Music", "YouTube Music", "SoundCloud"].map((service, index) => <div key={service}><span><i>{index + 1}</i>{service}</span><strong>Listen</strong></div>)}
          </div>
          <div className={styles.mockFooter}><Music2 aria-hidden="true" size={13} /> Powered by ArtistOS</div>
        </div>
      </section>

      <section className={styles.trust}>
        <span>Spotify</span><span>Apple Music</span><span>YouTube Music</span><span>Amazon Music</span><span>Deezer</span><span>TIDAL</span>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.sectionHeading}><span>Built for music campaigns</span><h2>Everything a release link should do.</h2><p>Start simple, then use the same link across social, press, outreach and paid campaigns.</p></div>
        <div className={styles.featureGrid}>
          {features.map(([Icon, title, description]) => <article key={title}><span><Icon aria-hidden="true" size={18} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className={styles.bridge}>
        <div>
          <span className={styles.eyebrow}>The link is only the beginning</span>
          <h2>Turn release traffic into your next best opportunity.</h2>
          <p>ArtistOS connects the fan-facing link with Network Intelligence. Find the playlists, radio, blogs, labels, sync opportunities and creators that fit the same release, then track the pitch and result.</p>
          <Link className={styles.primary} href="/login">Create release workspace <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className={styles.flow}>
          <div><span>01</span><strong>Create music link</strong><p>One page for every service.</p></div>
          <div><span>02</span><strong>Share and learn</strong><p>See which campaigns move fans.</p></div>
          <div><span>03</span><strong>Find release matches</strong><p>Open ArtistOS Network.</p></div>
        </div>
      </section>

      <section className={styles.faq}>
        <div className={styles.sectionHeading}><span>Questions</span><h2>Music smart links, without the clutter.</h2></div>
        <details><summary>What makes this music-specific?</summary><p>The page is built around a canonical ArtistOS release, its artwork, dates, streaming destinations, campaigns and audience signals.</p></details>
        <details><summary>Can I track different campaigns?</summary><p>Yes. Create UTM-tagged versions for social, email, press, ads and partner campaigns while keeping one public release URL.</p></details>
        <details><summary>Does this automatically pre-save music?</summary><p>ArtistOS currently supports pre-release pages and intent tracking. Direct DSP pre-save authorization will be added separately so the product never implies an authorization it did not complete.</p></details>
      </section>

      <section className={styles.final}>
        <h2>Your release deserves one clean destination.</h2>
        <p>Create the link for free, then let ArtistOS help you find where the music belongs next.</p>
        <Link className={styles.primary} href="/login">Create free music link <ArrowRight aria-hidden="true" size={16} /></Link>
      </section>
    </main>
  );
}
