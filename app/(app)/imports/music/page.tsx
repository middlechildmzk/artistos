import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { importMusicMetricsCsv } from '@/lib/music-import-actions';
import { getMusicIntelligence } from '@/lib/music-intelligence-data';

export default async function MusicImportsPage() {
  const data = await getMusicIntelligence();
  return <>
    <PageHeader
      eyebrow="Music data ingestion"
      title="Import every artist dashboard"
      description="Paste normalized CSV exports from DistroKid, Spotify for Artists, Apple Music for Artists, Amazon Music for Artists, YouTube, SoundCloud, Audiomack, Pandora, Deezer, TIDAL, and other sources. Imported values remain labeled by source."
      actions={<Link className="button ghost" href="/platforms">Back to intelligence</Link>}
    />

    <section className="grid grid-2">
      <Card>
        <div className="eyebrow">CSV importer</div>
        <h2>Cross-platform metric snapshots</h2>
        <p className="muted">Required columns: <code>platform,date</code>. Optional columns: streams, views, followers, monthly_listeners, saves, playlist_adds, revenue, country, track, report, confidence.</p>
        <form action={importMusicMetricsCsv} className="stack">
          <div className="form-grid">
            <div className="field"><label>Source</label><select className="select" name="source_type" defaultValue="export"><option value="distributor">DistroKid / distributor</option><option value="export">Artist dashboard export</option><option value="api">API</option><option value="manual">Manual normalization</option></select></div>
            <div className="field"><label>Release</label><select className="select" name="release_id"><option value="">Artist-level metrics</option>{data.releases.map((release: any) => <option value={release.id} key={release.id}>{release.title} · {release.release_date}</option>)}</select></div>
          </div>
          <div className="field"><label>CSV data</label><textarea className="textarea" name="csv" rows={16} required placeholder={'platform,date,streams,views,followers,monthly_listeners,saves,playlist_adds,revenue,country,track,report\nSpotify,2026-07-31,1250,0,4310,18200,94,3,4.82,US,Never Alone,Spotify export\nApple Music,2026-07-31,430,0,0,0,31,0,3.21,US,Never Alone,DistroKid'} /></div>
          <button className="button primary" type="submit">Import metric snapshots</button>
        </form>
      </Card>

      <Card>
        <div className="eyebrow">Normalization guide</div>
        <h2>One schema, different providers</h2>
        <div className="stack">
          <div className="card inset"><strong>DistroKid</strong><p className="muted">Use store as platform, reporting date, quantity as streams or sales, and earnings as revenue. Keep the original report name in source_reference.</p></div>
          <div className="card inset"><strong>Artist dashboards</strong><p className="muted">Map the platform’s native follower, listener, save, stream, view, and playlist fields. Missing values remain zero rather than being estimated.</p></div>
          <div className="card inset"><strong>Confidence</strong><p className="muted">Distributor statements default to 95. First-party exports default to 85. Manual or publicly reconstructed data should be scored lower and retain evidence.</p></div>
          <div className="notice warning"><strong>Do not combine reporting periods.</strong> Import daily, weekly, or monthly rows exactly as exported so ArtistOS can build a trustworthy history.</div>
        </div>
      </Card>
    </section>
  </>;
}
