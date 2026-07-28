import Link from "next/link";
import styles from "./tour.module.css";

const priorities = [
  { label: "Release", title: "Complete release-week readiness audit", detail: "Confirm assets, metadata, smart links, and platform delivery.", status: "Due today" },
  { label: "Promotion", title: "Review 18 high-fit opportunities", detail: "Prioritize credible melodic bass, creator, radio, and sync targets.", status: "Needs review" },
  { label: "Content", title: "Approve three teaser concepts", detail: "Turn the core message into short-form release-week stories.", status: "Approval" },
];

const managerSteps = [
  "Audit release readiness and unresolved blockers",
  "Rank evidence-backed promotion opportunities",
  "Prepare platform-specific content concepts",
  "Convert approved work into tracked actions",
];

const opportunities = [
  { name: "Melodic Bass Editorial", type: "Playlist", fit: 92, trust: 88, risk: 8 },
  { name: "Late Night Electronic", type: "YouTube", fit: 87, trust: 82, risk: 12 },
  { name: "Creator-Safe Music Brief", type: "Sync", fit: 84, trust: 91, risk: 5 },
];

export default function ProductTourPage() {
  return (
    <main className={`shell ${styles.tourShell}`}>
      <div className={styles.sampleBanner}><strong>Guided product tour</strong><span>Representative data only. No live records or actions.</span></div>

      <header className={`topbar ${styles.topbar}`}>
        <div className="brand"><div className="logo">A</div><div><div className="eyebrow">Independent artist command center</div><strong>ArtistOS</strong></div></div>
        <div className="nav-links"><Link className="button ghost" href="/login">Sign in</Link><a className="button primary" href="#workflow">Explore the workflow</a></div>
      </header>

      <section className={`card release-card ${styles.hero}`}>
        <div>
          <div className="eyebrow">Current release</div>
          <h1>Never Alone</h1>
          <p className="muted">Middle Child · Releasing July 31 · Emotional melodic bass</p>
          <div className="tag-row"><span className="pill">Release week</span><span className="pill">18 tasks complete</span><span className="pill">3 approvals pending</span></div>
        </div>
        <div className={styles.readiness}><span className="eyebrow">Readiness</span><strong>82%</strong><div className="progress"><span style={{ width: "82%" }} /></div><small className="muted">Four priority actions remain</small></div>
      </section>

      <section className={`grid stats ${styles.stats}`}>
        <div className="card"><div className="eyebrow">Open tasks</div><div className="stat-value">4</div><p className="muted">Focused, not overwhelming</p></div>
        <div className="card"><div className="eyebrow">Opportunities</div><div className="stat-value">126</div><p className="muted">18 ready for review</p></div>
        <div className="card"><div className="eyebrow">Contactable fans</div><div className="stat-value">2,846</div><p className="muted">Suppression-safe audience</p></div>
        <div className="card"><div className="eyebrow">Evidence health</div><div className="stat-value compact">Strong</div><p className="muted">Sources and freshness visible</p></div>
      </section>

      <section className="grid two-col" id="workflow">
        <div className="card">
          <div className="section-heading"><div><div className="eyebrow">Today</div><h2>Do next</h2></div><span className="pill">Priority ordered</span></div>
          {priorities.map((item) => <article className="row" key={item.title}><div><span className="pill">{item.label}</span><strong className={styles.rowTitle}>{item.title}</strong><p className="muted">{item.detail}</p></div><span className="pill">{item.status}</span></article>)}
        </div>

        <aside className="card">
          <div className="section-heading"><div><div className="eyebrow">AI Manager</div><h2>Release-week plan</h2></div><span className="pill">Human controlled</span></div>
          <p className="muted">ArtistOS coordinates departments, but consequential actions remain reviewable.</p>
          <div>{managerSteps.map((step, index) => <div className="timeline-item" key={step}><span className="timeline-dot" /><div><strong>{index + 1}. {step}</strong><p className="muted">Prepared as a reviewable work package.</p></div></div>)}</div>
          <button className="button primary" type="button" disabled>Approval required before execution</button>
        </aside>
      </section>

      <section className={styles.moduleGrid}>
        <article className={`card ${styles.moduleCard}`}>
          <div className="section-heading"><div><div className="eyebrow">Opportunity Intelligence</div><h2>Best-fit promotion lanes</h2></div><span className="pill">Evidence-first</span></div>
          {opportunities.map((item) => <div className={styles.opportunitySample} key={item.name}><div><strong>{item.name}</strong><p className="muted">{item.type}</p></div><div className="tag-row"><span className="pill">Fit {item.fit}</span><span className="pill">Trust {item.trust}</span><span className="pill">Risk {item.risk}</span></div></div>)}
        </article>

        <article className={`card ${styles.moduleCard}`}>
          <div className="section-heading"><div><div className="eyebrow">Artist Brain</div><h2>What ArtistOS knows</h2></div><span className="pill">Source-linked</span></div>
          <div className={styles.brainSample}><span className="pill">Verified fact</span><strong>Never Alone releases July 31.</strong><p className="muted">Source: delivered release metadata</p></div>
          <div className={styles.brainSample}><span className="pill">Supported inference</span><strong>The strongest audience response may come from wounded-but-hopeful storytelling.</strong><p className="muted">Requires human review before becoming guidance.</p></div>
          <div className={styles.brainSample}><span className="pill blocked">Conflict visible</span><strong>Featured-artist capitalization differs across legacy assets.</strong><p className="muted">ArtistOS preserves the contradiction instead of silently choosing.</p></div>
        </article>

        <article className={`card ${styles.moduleCard}`}>
          <div className="section-heading"><div><div className="eyebrow">Campaign Intelligence</div><h2>Connected execution</h2></div><span className="pill">One workflow</span></div>
          <div className={styles.campaignSample}><span>Curator research</span><strong>34 reviewed</strong></div>
          <div className={styles.campaignSample}><span>Creator outreach</span><strong>12 prepared</strong></div>
          <div className={styles.campaignSample}><span>Content plan</span><strong>9 assets</strong></div>
          <div className={styles.campaignSample}><span>Follow-ups</span><strong>6 due</strong></div>
          <p className={`muted ${styles.moduleNote}`}>Research, CRM, content, approvals, and outcomes stay connected to the same release.</p>
        </article>
      </section>

      <section className={`card ${styles.cta}`}>
        <div><div className="eyebrow">The operating model</div><h2>Plan → review → execute → measure → learn</h2><p className="muted">ArtistOS is designed to reduce fragmentation without giving automation unchecked authority.</p></div>
        <Link className="button primary" href="/login">Continue to sign in</Link>
      </section>
    </main>
  );
}
