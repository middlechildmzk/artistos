import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Music Submission Verification Methodology",
  description: "How ArtistOS verifies music submission routes, tracks route decay, scores evidence, and separates discovery seeds from production-ready facts.",
  alternates: { canonical: "/methodology" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

const steps = [
  ["1. Discover", "A route may come from public research, a directory, an artist workflow, or a private discovery source. Discovery does not equal verification."],
  ["2. Resolve identity", "ArtistOS identifies the actual organization, property, and canonical public source before trusting the route."],
  ["3. Check the official source", "The current official website, submission page, contact page, or documented platform route is treated as the primary evidence whenever available."],
  ["4. Record requirements", "Method, eligibility, format, free/paid status, assets, timing, rights terms, AI policy, and other material constraints are stored separately from the contact itself."],
  ["5. Timestamp the claim", "Every verified claim needs a checked date. A route without a freshness date should age back into a verification queue."],
  ["6. Track changes", "When a route changes, ArtistOS records the old value, new value, verification method, and date instead of silently overwriting history."],
];

export default function MethodologyPage() {
  return (
    <main>
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand"><div className="logo">A</div><div><strong>ArtistOS Network</strong><div className="eyebrow">Verification methodology</div></div></Link>
          <nav className="nav-links"><Link className="button ghost compact" href="/verified-routes">Verified routes</Link><Link className="button primary compact" href="/login">Open ArtistOS</Link></nav>
        </header>

        <section className="card release-card" style={{ padding: "38px", marginBottom: 18 }}>
          <p className="eyebrow">Evidence first</p>
          <h1>How ArtistOS verifies music submission routes.</h1>
          <p className="muted" style={{ maxWidth: 820, marginTop: 16, lineHeight: 1.75 }}>A directory entry is a lead, not truth. ArtistOS separates discovery from verification so an old email, closed form, changed fee, or outdated eligibility rule is not presented as current just because it exists in a spreadsheet.</p>
        </section>

        <section className="grid two-col" style={{ marginBottom: 18 }}>
          <div className="card">
            <p className="eyebrow">Verification workflow</p>
            <div className="stack" style={{ marginTop: 14 }}>
              {steps.map(([title, copy]) => <div className="pipeline-card" key={title}><strong>{title}</strong><span className="muted">{copy}</span></div>)}
            </div>
          </div>
          <div className="card">
            <p className="eyebrow">Evidence hierarchy</p>
            <h2 style={{ fontSize: "1.5rem", marginTop: 8 }}>What counts as strong evidence?</h2>
            <div className="stack compact-stack">
              <div className="row"><strong>Official submission/contact page</strong><span className="pill">strongest</span></div>
              <div className="row"><strong>Official organization page</strong><span className="pill">strong</span></div>
              <div className="row"><strong>Official platform profile</strong><span className="pill">supporting</span></div>
              <div className="row"><strong>Trusted third-party directory</strong><span className="pill">discovery</span></div>
              <div className="row"><strong>Unverified copied list</strong><span className="pill blocked">not production-ready</span></div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Route decay</p>
          <h2 style={{ fontSize: "1.55rem", marginTop: 8 }}>What ArtistOS is measuring</h2>
          <p className="muted" style={{ lineHeight: 1.75 }}>The verification program tracks whether a previously claimed route is still accurate, whether its submission method changed, whether eligibility changed, whether a fee or format requirement changed, and whether the route can still be supported by a current public source. This creates a measurable route-decay layer instead of another undated contact list.</p>
        </section>

        <section className="card" style={{ textAlign: "center", padding: "32px" }}>
          <h2 style={{ fontSize: "1.6rem" }}>See the evidence in practice.</h2>
          <p className="muted">The public pilot only surfaces independently verified public-source facts.</p>
          <Link className="button primary" href="/verified-routes">Explore verified routes</Link>
        </section>
      </div>
    </main>
  );
}
