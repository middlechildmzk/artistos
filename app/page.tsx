import type { Metadata } from "next";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Headphones,
  Megaphone,
  Mic2,
  Radio,
  Search,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { NetworkPreview } from "@/components/network-preview";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "ArtistOS | Know where your next release belongs",
  description: "Match your music with playlists, radio, blogs, labels, sync opportunities, creators and industry contacts. Track every pitch, follow-up and result in one connected workspace.",
  alternates: { canonical: "/" },
};

const workflow = [
  ["01", "Discover", "Search the full music opportunity universe."],
  ["02", "Match", "See why each opportunity fits your release."],
  ["03", "Pitch", "Choose the best free, paid or direct route."],
  ["04", "Track", "Keep every follow-up, result and relationship connected."],
  ["05", "Learn", "Make every campaign improve the next one."],
] as const;

const categories = [
  [Headphones, "Playlists", "Curators and editorial routes"],
  [Radio, "Radio", "Stations, shows and DJs"],
  [BookOpen, "Blogs & media", "Reviews, premieres and coverage"],
  [Building2, "Labels", "Demo routes and artist teams"],
  [BriefcaseBusiness, "Sync", "Film, TV, games and creators"],
  [AudioLines, "YouTube", "Channels and music networks"],
  [Mic2, "Creators", "Influencers and tastemakers"],
  [Megaphone, "Podcasts", "Interviews and music shows"],
  [Share2, "Live", "Venues, showcases and festivals"],
  [Search, "Industry", "Contacts, organizations and services"],
] as const;

export default function HomePage() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ArtistOS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "The opportunity intelligence engine for independent artists.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />

      <nav className={styles.nav} aria-label="Public navigation">
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark} aria-hidden="true">A</span>
          <span>ArtistOS</span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#network">Network</a>
          <a href="#how-it-works">How it works</a>
          <a href="#everything">Everything else</a>
          <Link href="/free-music-smart-link">Free music smart link</Link>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.signIn} href="/login">Sign in</Link>
          <Link className={styles.navCta} href="/login">Start free</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>The opportunity intelligence engine for independent artists</span>
        <h1>Know exactly where your next release belongs.</h1>
        <p>Match your music with playlists, radio, blogs, labels, sync opportunities, creators and industry contacts. Manage every pitch, follow-up and result from one connected workspace.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryCta} href="/login">Find opportunities <ArrowRight aria-hidden="true" size={16} /></Link>
          <a className={styles.secondaryCta} href="#how-it-works">See how ArtistOS works</a>
        </div>
        <div className={styles.previewWrap} id="network">
          <NetworkPreview />
        </div>
      </section>

      <section className={styles.credibility} aria-label="ArtistOS Network coverage">
        <div><strong>2,000+</strong><span>music opportunities collected</span></div>
        <div><strong>10 categories</strong><span>from playlists to labels and sync</span></div>
        <div><strong>Release-aware</strong><span>matching grounded in your music</span></div>
        <div><strong>Routes included</strong><span>free, paid and direct options compared</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Built around your release</span>
          <h2>A directory tells you what exists. ArtistOS tells you what fits.</h2>
          <p>Every match starts with the release itself, including genre, mood, audience, territory and campaign context. You see the evidence behind the recommendation before you pitch.</p>
        </div>
        <div className={styles.matchDemo}>
          <article className={styles.releaseCard}>
            <div className={styles.releaseArtwork}>Never Alone</div>
            <h3>Never Alone</h3>
            <p>Middle Child · upcoming single</p>
            <div className={styles.tagLine}><span>Melodic bass</span><span>Emotional</span><span>Cinematic</span><span>English</span></div>
          </article>
          <div className={styles.matchArrow}><ArrowRight aria-hidden="true" size={24} /></div>
          <article className={styles.matchCard}>
            <div className={styles.fitScore}><span>Release fit</span><strong>94%</strong></div>
            <h3>Proximity</h3>
            <p>A high-confidence match with a documented route, visible audience signal and relevant electronic-music history.</p>
            <div className={styles.matchReasons}><span><i /> Genre and mood overlap</span><span><i /> Audience size is appropriate</span><span><i /> Direct submission route available</span></div>
          </article>
        </div>
      </section>

      <section className={styles.section} id="how-it-works">
        <div className={styles.sectionHeader}>
          <span>One connected workflow</span>
          <h2>From first match to a smarter next release.</h2>
          <p>ArtistOS keeps the opportunity, the pitch, the result and the relationship together so useful context never disappears into another spreadsheet.</p>
        </div>
        <div className={styles.workflow}>
          {workflow.map(([number, title, description]) => <article key={title}><b>{number}</b><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>The full opportunity graph</span>
          <h2>Every meaningful way your music can move.</h2>
          <p>Explore channels beyond playlist pitching, then compare them in one consistent workspace.</p>
        </div>
        <div className={styles.categoryGrid}>
          {categories.map(([Icon, title, description]) => (
            <article className={styles.categoryCard} key={title}>
              <span className={styles.categoryIcon}><Icon aria-hidden="true" size={17} /></span>
              <strong>{title}</strong>
              <span>{description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="everything">
        <div className={styles.sectionHeader}>
          <span>Everything around the release</span>
          <h2>Network Intelligence gets you in. The artist operating system keeps you growing.</h2>
          <p>Once the right opportunities are found, ArtistOS connects the rest of the work without turning every capability into another product to learn.</p>
        </div>
        <div className={styles.aroundGrid}>
          <article className={styles.aroundCard}><span>Releases</span><h3>One release workspace</h3><p>Metadata, assets, music smart links and creator tools stay together.</p></article>
          <article className={styles.aroundCard}><span>Campaigns</span><h3>Every pitch in motion</h3><p>Track submissions, follow-ups, replies, placements and proof.</p></article>
          <article className={styles.aroundCard}><span>Insights</span><h3>Performance with context</h3><p>Connect audience, campaign and smart-link signals to the release.</p></article>
          <article className={styles.aroundCard}><span>Learning</span><h3>A system that remembers</h3><p>Preserve relationships and outcomes so recommendations keep improving.</p></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Why ArtistOS</span>
          <h2>Stop rebuilding the same context in disconnected tools.</h2>
        </div>
        <div className={styles.differenceGrid}>
          <article className={styles.differenceCard}>
            <h3>Directories and spreadsheets</h3>
            <ul><li>Lists without release context</li><li>Pitch history split across platforms</li><li>Relationships lost after each campaign</li><li>Results that do not improve future decisions</li></ul>
          </article>
          <article className={styles.differenceCard}>
            <h3>ArtistOS Network</h3>
            <ul><li>Release-specific fit with visible reasons</li><li>Free, paid and direct routes compared</li><li>Every contact and follow-up connected</li><li>Placements and outcomes become career intelligence</li></ul>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Find the right people and opportunities for your music.</h2>
        <p>Start with ArtistOS Network. Build the rest of your artist career around it.</p>
        <Link className={styles.primaryCta} href="/login">Find opportunities <ArrowRight aria-hidden="true" size={16} /></Link>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 ArtistOS. Built for independent artists.</span>
        <div className={styles.footerLinks}><Link href="/free-music-smart-link">Music smart links</Link><Link href="/login">Sign in</Link></div>
      </footer>
    </main>
  );
}
