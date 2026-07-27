import Link from 'next/link';
import { Badge, Card, PageHeader } from '@/components/ui';

const tools = [
  ['Spotify Pitch Builder', 'Turn release facts into a focused editorial pitch with a live character budget.', 'available', '/content'],
  ['Release Readiness Check', 'Check metadata, audio, artwork, lyrics, ownership, distribution, and campaign deadlines.', 'available', '/releases'],
  ['Music Prompt Builder', 'Generate structured prompts that preserve artist identity instead of producing generic genre text.', 'available', '/studio'],
  ['Playlist Pitch Builder', 'Create a concise, truthful pitch grounded in track fit and curator preferences.', 'available', '/campaigns'],
  ['Artwork Validator', 'Check dimensions, file readiness, text risks, and common distributor rejection conditions.', 'next', '/assets'],
  ['AI Release Risk Review', 'Organize provenance, disclosure, detector signals, and platform-policy considerations before release.', 'next', '/studio'],
  ['Artist Bio Builder', 'Create short, platform, press, and full biography versions from one approved artist story.', 'next', '/content'],
  ['Release Timeline Generator', 'Build a practical schedule backward from a release date and identify missed deadlines.', 'next', '/releases'],
] as const;

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Free tools and acquisition"
        title="Solve one music problem, then save the work into ArtistOS"
        description="These tools are the public doorway into the ecosystem. Each one should deliver standalone value, then connect the result to an artist profile, release, campaign, or relationship."
        actions={<Link className="button primary" href="/studio">Open Creator Studio</Link>}
      />

      <section className="grid grid-4">
        {tools.map(([title, description, status, href]) => (
          <Card key={title}>
            <div className="row between"><div className="eyebrow">Free utility</div><Badge tone={status === 'available' ? 'green' : 'amber'}>{status}</Badge></div>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
            <Link className="button ghost section" href={href}>{status === 'available' ? 'Use workflow' : 'View planned flow'}</Link>
          </Card>
        ))}
      </section>

      <section className="section grid grid-3">
        <Card><div className="eyebrow">Acquisition</div><h2>Anonymous value first</h2><p className="muted">A visitor should be able to complete the core calculation or draft without creating an account.</p></Card>
        <Card><div className="eyebrow">Conversion</div><h2>Save, personalize, continue</h2><p className="muted">Account creation becomes useful when it preserves the output, remembers the artist, and connects the result to a live release.</p></Card>
        <Card><div className="eyebrow">Compounding data</div><h2>Learn from outcomes</h2><p className="muted">Approved outputs and campaign results improve future recommendations without treating unverified AI text as fact.</p></Card>
      </section>
    </>
  );
}
