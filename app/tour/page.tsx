import type { Metadata } from "next";
import { ArrowRight, BarChart3, CalendarDays, Check, Megaphone, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { NetworkPreview } from "@/components/network-preview";
import styles from "./tour.module.css";

export const metadata: Metadata = {
  title: "How ArtistOS works",
  description: "See how ArtistOS connects a release to opportunity matching, campaigns, results and learning.",
};

const steps = [
  [CalendarDays, "Start with the release", "Add the music, date, metadata, assets and context ArtistOS should use."],
  [Search, "Find where it belongs", "Review release-specific matches across playlists, radio, media, labels, sync and creators."],
  [Megaphone, "Run the campaign", "Save targets, compare submission routes, track pitches and follow up without losing context."],
  [BarChart3, "Record what happened", "Connect placements, coverage, link activity and audience response to the release."],
  [Sparkles, "Make the next release smarter", "ArtistOS carries relationship history and measured outcomes forward."],
] as const;

export default function ProductTourPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/"><span>A</span> ArtistOS</Link>
        <div><Link href="/">Product</Link><Link className={styles.ctaSmall} href="/login">Start free</Link></div>
      </nav>

      <header className={styles.hero}>
        <span className={styles.eyebrow}>How ArtistOS works</span>
        <h1>One release. One connected path from discovery to learning.</h1>
        <p>ArtistOS starts with the music, finds the right opportunities and keeps every pitch, result and relationship useful for what comes next.</p>
        <a className={styles.primary} href="#walkthrough">Walk through the product <ArrowRight aria-hidden="true" size={16} /></a>
      </header>

      <section className={styles.preview}>
        <div className={styles.previewLabel}><span>Sample release</span><strong>Never Alone · melodic bass · emotional · cinematic</strong></div>
        <NetworkPreview />
      </section>

      <section className={styles.walkthrough} id="walkthrough">
        <div className={styles.sectionHeading}><span>Five simple stages</span><h2>The product follows the way a release actually grows.</h2></div>
        <div className={styles.stepGrid}>
          {steps.map(([Icon, title, description], index) => (
            <article key={title}>
              <div><span>{"0" + (index + 1)}</span><Icon aria-hidden="true" size={18} /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.todayDemo}>
        <div>
          <span className={styles.eyebrow}>Today</span>
          <h2>Open ArtistOS and know what to do next.</h2>
          <p>The authenticated home keeps one current release, one best next move, up to five priorities, new matches, follow-ups, campaign pulse and one useful insight in view.</p>
        </div>
        <div className={styles.actionCard}>
          <div><Sparkles aria-hidden="true" size={18} /><span>Best next move</span></div>
          <h3>Review the three strongest new radio and playlist matches.</h3>
          <p>All have a public submission route and overlap with the release mood.</p>
          <div className={styles.actionList}><span><Check size={14} /> Release context applied</span><span><Check size={14} /> Routes compared</span><span><Check size={14} /> Fit reasons visible</span></div>
        </div>
      </section>

      <section className={styles.final}>
        <h2>Find where the music belongs. Keep everything that happens next.</h2>
        <p>Start with ArtistOS Network and build the rest of the release around it.</p>
        <Link className={styles.primary} href="/login">Find opportunities <ArrowRight aria-hidden="true" size={16} /></Link>
      </section>
    </main>
  );
}
