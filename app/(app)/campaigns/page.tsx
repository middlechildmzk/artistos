import Link from 'next/link';
import { Badge, Card, PageHeader } from '@/components/ui';

const stages = ['Discovered', 'Qualified', 'Contacted', 'Waiting', 'Approved', 'Rejected', 'Placed', 'Relationship'];

const channels = [
  ['Playlists', '/playlists', 'Spotify and multi-platform playlist opportunities'],
  ['Industry', '/industry', 'Blogs, channels, radio, labels, managers, sync, and partners'],
  ['Outreach', '/outreach', 'Messages, follow-ups, replies, and relationship history'],
  ['Outcomes', '/releases', 'Placements, coverage, replies, campaign evidence, and lessons'],
] as const;

export default function CampaignIntelligencePage() {
  return (
    <>
      <PageHeader
        eyebrow="Campaign Intelligence"
        title="Turn promotion research into trusted relationships and measurable outcomes"
        description="CuratorFit, the promotion CRM, and the evidence-first network graph now converge here. Recommendations must explain fit, source, freshness, trust, and next action."
        actions={<Link className="button primary" href="/playlists">Find opportunities</Link>}
      />

      <section className="grid grid-4">
        {channels.map(([title, href, description]) => (
          <Card key={title}>
            <div className="eyebrow">Campaign lane</div>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
            <Link className="button ghost section" href={href}>Open {title.toLowerCase()}</Link>
          </Card>
        ))}
      </section>

      <section className="section grid grid-2">
        <Card>
          <div className="eyebrow">Relationship pipeline</div>
          <h2>One lifecycle across every channel</h2>
          <div className="row wrap section">
            {stages.map((stage, index) => <Badge tone={stage === 'Placed' || stage === 'Relationship' ? 'green' : stage === 'Rejected' ? 'red' : index > 2 ? 'amber' : ''} key={stage}>{stage}</Badge>)}
          </div>
          <p className="muted">The objective is not one-off playlist placement. ArtistOS should preserve the person, organization, property, evidence, communication, preference, and outcome so every release starts warmer.</p>
        </Card>
        <Card>
          <div className="eyebrow">Recommendation contract</div>
          <h2>Every suggested target must answer five questions</h2>
          <div className="list section">
            {['Why is this a fit?', 'What evidence supports it?', 'How fresh is the information?', 'What are the risks or restrictions?', 'What should happen next?'].map((item, index) => <div className="list-item" key={item}><span className="check">{index + 1}</span><strong>{item}</strong></div>)}
          </div>
        </Card>
      </section>

      <section className="section grid grid-3">
        <Card><div className="eyebrow">Supply</div><h2>Curators and partners</h2><p className="muted">Playlist owners, publications, YouTube channels, creators, DJs, radio, sync, labels, managers, producers, and service partners.</p><Link className="button ghost" href="/industry">Open network</Link></Card>
        <Card><div className="eyebrow">Demand</div><h2>Artists and teams</h2><p className="muted">Independent artists, bands, producers, managers, labels, and agencies discovered through content, tools, referrals, and direct research.</p><Link className="button ghost" href="/search">Search graph</Link></Card>
        <Card><div className="eyebrow">Proof</div><h2>Never Alone campaign</h2><p className="muted">Use the current Middle Child release as the first complete workflow, including assets, outreach, content, submissions, placements, follow-ups, and retrospective.</p><Link className="button primary" href="/releases">Open release</Link></Card>
      </section>
    </>
  );
}
