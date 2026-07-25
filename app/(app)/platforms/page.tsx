import { Badge, Card, Metric, PageHeader } from '@/components/ui';
import { DISTROKID_BASELINE, MUSIC_PLATFORMS, NEVER_ALONE_RELEASE } from '@/lib/platform-registry';

const modeLabel: Record<string, string> = {
  oauth: 'OAuth', api: 'API', export: 'Export', distributor: 'DistroKid', public: 'Public', manual: 'Manual',
};

export default function PlatformsPage() {
  const core = MUSIC_PLATFORMS.filter((item) => item.priority === 'core');
  const growth = MUSIC_PLATFORMS.filter((item) => item.priority === 'growth');
  const coverage = MUSIC_PLATFORMS.filter((item) => item.priority === 'coverage');

  return <>
    <PageHeader
      eyebrow="Universal music intelligence"
      title="Every platform. One release identity."
      description="Track distribution, audience, streaming, social, playlists, press, radio, and revenue without pretending every source exposes a live API."
      actions={<a className="button primary" href={NEVER_ALONE_RELEASE.presaveUrl} target="_blank" rel="noreferrer">Open Never Alone</a>}
    />

    <section className="grid grid-4">
      <Metric value={MUSIC_PLATFORMS.length} label="platform groups mapped" />
      <Metric value={DISTROKID_BASELINE.length} label="DistroKid-linked destinations" />
      <Metric value={core.length} label="launch-critical connections" />
      <Metric value="4" label="evidence source classes" />
    </section>

    <section className="section grid grid-2">
      <Card>
        <div className="eyebrow">Canonical release identity</div>
        <h2>{NEVER_ALONE_RELEASE.title} <span className="muted">feat. {NEVER_ALONE_RELEASE.featuredArtist}</span></h2>
        <div className="stack">
          <div className="row between"><span>Artist</span><strong>{NEVER_ALONE_RELEASE.artist}</strong></div>
          <div className="row between"><span>Release date</span><strong>{NEVER_ALONE_RELEASE.releaseDate}</strong></div>
          <div className="row between"><span>UPC</span><strong>{NEVER_ALONE_RELEASE.upc}</strong></div>
          <div className="row between"><span>Label</span><strong>{NEVER_ALONE_RELEASE.label}</strong></div>
        </div>
        <div className="notice section">Every DSP profile, release URL, track ID, stream report, playlist placement, and media feature should resolve back to this record.</div>
      </Card>

      <Card>
        <div className="eyebrow">Connection truth</div>
        <h2>Live, imported, verified, or manual</h2>
        <div className="list">
          <div className="list-item"><span className="check">1</span><div><strong>Live API / OAuth</strong><div className="kicker">Provider-authorized metrics and identity</div></div><Badge tone="green">highest freshness</Badge></div>
          <div className="list-item"><span className="check">2</span><div><strong>Artist dashboard export</strong><div className="kicker">CSV or report imported with period and source</div></div><Badge>auditable</Badge></div>
          <div className="list-item"><span className="check">3</span><div><strong>DistroKid statement</strong><div className="kicker">Cross-store streams, sales, and revenue</div></div><Badge>authoritative payout</Badge></div>
          <div className="list-item"><span className="check">4</span><div><strong>Public/manual evidence</strong><div className="kicker">URL, screenshot, date, confidence, reviewer</div></div><Badge tone="amber">verification required</Badge></div>
        </div>
      </Card>
    </section>

    <section className="section">
      <Card>
        <div className="row between"><div><div className="eyebrow">Launch-critical</div><h2>Connect these first</h2></div><Badge>{core.length}</Badge></div>
        <div className="grid grid-2">
          {core.map((platform) => <div className="card inset" key={platform.slug}>
            <div className="row between"><div><strong>{platform.name}</strong><div className="kicker">{platform.category}</div></div><Badge tone="amber">connection needed</Badge></div>
            <p className="muted">{platform.notes}</p>
            <div className="row wrap">{platform.modes.map((mode) => <Badge key={mode}>{modeLabel[mode]}</Badge>)}</div>
            <p className="kicker">Tracks: {platform.metrics.join(' · ')}</p>
          </div>)}
        </div>
      </Card>
    </section>

    <section className="section grid grid-2">
      <Card>
        <div className="row between"><div><div className="eyebrow">Growth network</div><h2>High-value expansion</h2></div><Badge>{growth.length}</Badge></div>
        <div className="stack">{growth.map((platform) => <div className="list-item" key={platform.slug}><div><strong>{platform.name}</strong><div className="kicker">{platform.category} · {platform.modes.map((mode) => modeLabel[mode]).join(' + ')}</div></div><Badge tone="amber">not synced</Badge></div>)}</div>
      </Card>
      <Card>
        <div className="row between"><div><div className="eyebrow">Distribution coverage</div><h2>Long-tail destinations</h2></div><Badge>{coverage.length}</Badge></div>
        <div className="stack">{coverage.map((platform) => <div className="list-item" key={platform.slug}><div><strong>{platform.name}</strong><div className="kicker">{platform.category} · {platform.metrics.join(' · ')}</div></div><Badge>mapped</Badge></div>)}</div>
      </Card>
    </section>

    <section className="section"><Card>
      <div className="eyebrow">Next operational steps</div>
      <h2>Turn the map into live intelligence</h2>
      <div className="grid grid-4">
        <div className="card inset"><strong>1. Identity</strong><p className="muted">Save every artist, release, and track ID by platform.</p></div>
        <div className="card inset"><strong>2. Connect</strong><p className="muted">Authorize Gmail, Spotify, Google/YouTube, Meta, SoundCloud, and other eligible accounts.</p></div>
        <div className="card inset"><strong>3. Import</strong><p className="muted">Load DistroKid, Apple, Amazon, Spotify, and other artist-dashboard reports.</p></div>
        <div className="card inset"><strong>4. Verify</strong><p className="muted">Monitor playlist adds, press, channels, radio, and broken profile links with evidence dates.</p></div>
      </div>
    </Card></section>
  </>;
}
