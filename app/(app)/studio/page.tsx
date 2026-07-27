import Link from 'next/link';
import { Badge, Card, PageHeader } from '@/components/ui';

const tools = [
  { title: 'Music Prompt Builder', description: 'Build structured prompts from genre, mood, energy, instrumentation, references, and song section.', status: 'ready', href: '/studio/prompts' },
  { title: 'Song Positioning', description: 'Turn a track into a clear genre, mood, audience, comparable-artist, and playlist-fit brief.', status: 'ready', href: '/platforms' },
  { title: 'Release Copy', description: 'Create Spotify pitches, bios, one-sheets, captions, email copy, and creator-use language from saved release facts.', status: 'connected', href: '/content' },
  { title: 'Visual Direction', description: 'Generate artwork, Canvas, short-form video, visualizer, and image-model briefs that stay on brand.', status: 'planned', href: '/assets' },
  { title: 'Mix & Master Review', description: 'Combine measured audio facts with clearly labeled production observations and release-readiness checks.', status: 'planned', href: '/releases' },
  { title: 'AI Release Risk Review', description: 'Review provenance, disclosure, metadata, platform policy, and detector-risk signals before distribution.', status: 'planned', href: '/releases' },
];

export default function CreatorStudioPage() {
  return (
    <>
      <PageHeader
        eyebrow="Creator Studio"
        title="Create better music and release assets without starting from zero"
        description="Creator Music Prompts is now part of ArtistOS. Every tool should use the artist, release, brand, and campaign context already saved in the workspace."
        actions={<Link className="button primary" href="/releases">Open Never Alone</Link>}
      />

      <section className="grid grid-3">
        {tools.map((tool) => (
          <Card key={tool.title}>
            <div className="row between">
              <div className="eyebrow">Artist-aware tool</div>
              <Badge tone={tool.status === 'planned' ? 'amber' : 'green'}>{tool.status}</Badge>
            </div>
            <h2>{tool.title}</h2>
            <p className="muted">{tool.description}</p>
            <Link className="button ghost section" href={tool.href}>{tool.status === 'planned' ? 'View workflow' : 'Open tool'}</Link>
          </Card>
        ))}
      </section>

      <section className="section grid grid-2">
        <Card>
          <div className="eyebrow">Shared memory</div>
          <h2>One artist context across every tool</h2>
          <p className="muted">ArtistOS should remember sound, influences, brand language, visual identity, previous prompts, approved copy, release history, collaborators, and campaign outcomes.</p>
          <div className="row wrap">
            <Badge tone="green">Middle Child</Badge><Badge>emotional electronic</Badge><Badge>melodic bass</Badge><Badge>dark → hopeful</Badge><Badge>blue / magenta</Badge>
          </div>
        </Card>
        <Card>
          <div className="eyebrow">Trust rule</div>
          <h2>Measured facts stay separate from AI judgment</h2>
          <p className="muted">Audio measurements, platform requirements, source evidence, and user-provided facts must be labeled separately from creative suggestions, weak signals, and inferred risks.</p>
          <div className="row wrap"><Badge tone="green">Verified fact</Badge><Badge>Supported inference</Badge><Badge tone="amber">Weak signal</Badge><Badge tone="red">Conflict</Badge></div>
        </Card>
      </section>
    </>
  );
}
