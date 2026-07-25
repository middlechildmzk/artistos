import { Badge, Card, Empty, ErrorNotice, Metric, PageHeader, StatusBadge } from '@/components/ui';
import { recordCoverage, recordMusicMetric, savePlatformProfile, saveReleaseLink } from '@/lib/music-intelligence-actions';
import { getMusicIntelligence } from '@/lib/music-intelligence-data';
import { NEVER_ALONE_RELEASE } from '@/lib/platform-registry';

export default async function PlatformsPage() {
  const data = await getMusicIntelligence();
  const platformOptions = data.platforms.map((p: any) => <option key={p.slug} value={p.slug}>{p.name}</option>);
  const connected = data.profiles.filter((p: any) => p.connection_state === 'connected').length;
  const liveLinks = data.links.filter((l: any) => l.release_status === 'live').length;
  const activePlacements = data.placements.filter((p: any) => !p.removed_at).length;

  return <>
    <PageHeader eyebrow="Universal music intelligence" title="Every platform. One operating system." description="Connect accounts, record release links, import or enter metrics, monitor playlist adds, and preserve evidence for press, radio, blogs, channels, and DJ support." actions={<a className="button primary" href={NEVER_ALONE_RELEASE.presaveUrl} target="_blank" rel="noreferrer">Open Never Alone</a>} />
    {data.migrationRequired ? <div className="notice warning"><strong>Database activation required.</strong> Apply <code>supabase/migrations/20260725130000_artistos_music_intelligence.sql</code>.</div> : null}
    <ErrorNotice message={data.error} />

    <section className="grid grid-4">
      <Metric value={data.platforms.length} label="platform groups" />
      <Metric value={connected} label="connected profiles" />
      <Metric value={liveLinks} label="verified live release links" />
      <Metric value={activePlacements} label="active playlist placements" />
    </section>

    <section className="section grid grid-4">
      <Metric value={data.totals.streams.toLocaleString()} label="recorded streams" />
      <Metric value={data.totals.views.toLocaleString()} label="recorded views" />
      <Metric value={data.totals.followers.toLocaleString()} label="latest follower high" />
      <Metric value={`$${data.totals.revenue.toFixed(2)}`} label="recorded revenue" />
    </section>

    <section className="section grid grid-2">
      <Card>
        <div className="eyebrow">Account and profile registry</div><h2>Connect or verify a platform</h2>
        <form action={savePlatformProfile} className="stack">
          <div className="form-grid"><div className="field"><label>Platform</label><select className="select" name="platform_slug">{platformOptions}</select></div><div className="field"><label>Artist</label><input className="input" name="artist_name" defaultValue="Middle Child" /></div></div>
          <div className="field"><label>Profile URL</label><input className="input" type="url" name="profile_url" /></div>
          <div className="field"><label>External artist ID</label><input className="input" name="external_artist_id" /></div>
          <div className="form-grid"><div className="field"><label>Connection</label><select className="select" name="connection_state"><option>unconnected</option><option>pending</option><option>connected</option><option>error</option></select></div><div className="field"><label>Source</label><select className="select" name="source_type"><option>oauth</option><option>api</option><option>export</option><option>distributor</option><option>public</option><option>manual</option></select></div><div className="field"><label>Freshness</label><select className="select" name="freshness_status"><option>unknown</option><option>fresh</option><option>stale</option><option>broken</option></select></div></div>
          <div className="field"><label>Last verified</label><input className="input" type="datetime-local" name="last_verified_at" /></div>
          <div className="field"><label>Notes</label><textarea className="textarea" name="notes" /></div>
          <button className="button primary">Save profile</button>
        </form>
      </Card>

      <Card>
        <div className="eyebrow">Release destination registry</div><h2>Save a Never Alone store link</h2>
        <form action={saveReleaseLink} className="stack">
          <input type="hidden" name="release_id" value={data.release?.id ?? ''} />
          <div className="form-grid"><div className="field"><label>Platform</label><select className="select" name="platform_slug">{platformOptions}</select></div><div className="field"><label>Status</label><select className="select" name="release_status"><option>unknown</option><option>pending</option><option>live</option><option>missing</option><option>wrong_profile</option></select></div></div>
          <div className="field"><label>Release or track URL</label><input className="input" type="url" name="release_url" /></div>
          <div className="form-grid"><div className="field"><label>Release ID</label><input className="input" name="external_release_id" /></div><div className="field"><label>Track ID / ISRC</label><input className="input" name="external_track_id" /></div></div>
          <div className="form-grid"><div className="field"><label>Source</label><select className="select" name="source_type"><option>manual</option><option>api</option><option>distributor</option><option>public</option></select></div><div className="field"><label>Verified</label><input className="input" type="datetime-local" name="last_verified_at" /></div></div>
          <div className="field"><label>Evidence URL</label><input className="input" type="url" name="evidence_url" /></div>
          <button className="button primary">Save destination</button>
        </form>
      </Card>
    </section>

    <section className="section grid grid-2">
      <Card>
        <div className="eyebrow">Metrics ingestion</div><h2>Record API, export, or DistroKid data</h2>
        <form action={recordMusicMetric} className="stack">
          <input type="hidden" name="release_id" value={data.release?.id ?? ''} />
          <div className="form-grid"><div className="field"><label>Platform</label><select className="select" name="platform_slug">{platformOptions}</select></div><div className="field"><label>Date</label><input className="input" type="date" name="metric_date" /></div><div className="field"><label>Source</label><select className="select" name="source_type"><option>manual</option><option>api</option><option>export</option><option>distributor</option><option>public</option></select></div></div>
          <div className="form-grid">{['streams','views','followers','monthly_listeners','saves','playlist_adds','revenue_usd'].map((name) => <div className="field" key={name}><label>{name.replaceAll('_',' ')}</label><input className="input" type="number" step={name === 'revenue_usd' ? '0.01' : '1'} min="0" name={name} /></div>)}</div>
          <div className="form-grid"><div className="field"><label>Confidence 0–100</label><input className="input" type="number" min="0" max="100" name="confidence" /></div><div className="field"><label>Source reference</label><input className="input" name="source_reference" placeholder="CSV filename, API run, report period, or URL" /></div></div>
          <button className="button primary">Record snapshot</button>
        </form>
      </Card>

      <Card>
        <div className="eyebrow">Coverage evidence</div><h2>Log blogs, radio, channels, podcasts, or DJ support</h2>
        <form action={recordCoverage} className="stack">
          <input type="hidden" name="release_id" value={data.release?.id ?? ''} />
          <div className="form-grid"><div className="field"><label>Type</label><select className="select" name="coverage_type"><option>blog_feature</option><option>radio_spin</option><option>youtube_channel</option><option>podcast</option><option>dj_support</option><option>soundcloud_repost</option><option>sync</option></select></div><div className="field"><label>Platform</label><select className="select" name="platform_slug">{platformOptions}</select></div></div>
          <div className="field"><label>Outlet</label><input className="input" name="outlet_name" required /></div><div className="field"><label>Feature title</label><input className="input" name="title" /></div><div className="field"><label>URL</label><input className="input" type="url" name="url" /></div>
          <div className="form-grid"><div className="field"><label>Date</label><input className="input" type="datetime-local" name="occurred_at" /></div><div className="field"><label>Audience estimate</label><input className="input" type="number" min="0" name="audience_estimate" /></div></div>
          <div className="form-grid"><div className="field"><label>Contact</label><input className="input" name="contact_name" /></div><div className="field"><label>Contact route</label><input className="input" name="contact_method" placeholder="email, form, Instagram, etc." /></div></div>
          <div className="form-grid"><div className="field"><label>Verification</label><select className="select" name="verification_state"><option>unverified</option><option>supported</option><option>verified</option><option>stale</option><option>conflicting</option></select></div><div className="field"><label>Confidence</label><input className="input" type="number" min="0" max="100" name="confidence" /></div></div>
          <div className="field"><label>Evidence URL</label><input className="input" type="url" name="evidence_url" /></div><div className="field"><label>Notes</label><textarea className="textarea" name="notes" /></div>
          <button className="button primary">Log coverage</button>
        </form>
      </Card>
    </section>

    <section className="section grid grid-2">
      <Card><div className="row between"><div><div className="eyebrow">Platform health</div><h2>Profiles and connections</h2></div><Badge>{data.profiles.length}</Badge></div>{data.profiles.length ? <div className="stack">{data.profiles.map((p: any) => <div className="list-item" key={p.id}><div><strong>{p.music_platforms?.name ?? 'Platform'} · {p.artist_name}</strong><div className="kicker">{p.source_type} · {p.last_verified_at ?? 'never verified'}</div></div><StatusBadge status={p.connection_state} /></div>)}</div> : <Empty>No platform profiles saved yet.</Empty>}</Card>
      <Card><div className="row between"><div><div className="eyebrow">Store coverage</div><h2>Never Alone destinations</h2></div><Badge>{data.links.length}</Badge></div>{data.links.length ? <div className="stack">{data.links.map((l: any) => <div className="list-item" key={l.id}><div><strong>{l.music_platforms?.name ?? 'Platform'}</strong><div className="kicker">{l.source_type} · {l.last_verified_at ?? 'never verified'}</div></div><div className="row"><StatusBadge status={l.release_status} />{l.release_url ? <a className="button ghost" href={l.release_url} target="_blank" rel="noreferrer">Open</a> : null}</div></div>)}</div> : <Empty>No platform release links saved yet.</Empty>}</Card>
    </section>

    <section className="section grid grid-2">
      <Card><div className="row between"><div><div className="eyebrow">Recent intelligence</div><h2>Metric snapshots</h2></div><Badge>{data.metrics.length}</Badge></div>{data.metrics.length ? <div className="timeline">{data.metrics.slice(0,25).map((m: any) => <div className="timeline-item" key={m.id}><strong>{m.music_platforms?.name ?? 'Platform'}</strong><div className="kicker">{m.metric_date} · {m.source_type} · confidence {m.confidence ?? 'n/a'}</div><p className="muted">Streams {Number(m.metrics?.streams ?? 0).toLocaleString()} · Views {Number(m.metrics?.views ?? 0).toLocaleString()} · Followers {Number(m.metrics?.followers ?? 0).toLocaleString()} · Revenue ${Number(m.metrics?.revenue_usd ?? 0).toFixed(2)}</p></div>)}</div> : <Empty>No metrics imported or recorded.</Empty>}</Card>
      <Card><div className="row between"><div><div className="eyebrow">Earned media and support</div><h2>Coverage timeline</h2></div><Badge>{data.coverage.length}</Badge></div>{data.coverage.length ? <div className="timeline">{data.coverage.slice(0,25).map((c: any) => <div className="timeline-item" key={c.id}><strong>{c.outlet_name}</strong><div className="kicker">{c.coverage_type} · {c.occurred_at ?? 'date unknown'} · {c.verification_state}</div><p className="muted">{c.title ?? c.notes ?? 'No description recorded.'}</p>{c.url ? <a className="button ghost" href={c.url} target="_blank" rel="noreferrer">Open evidence</a> : null}</div>)}</div> : <Empty>No press, radio, channel, podcast, or DJ support logged.</Empty>}</Card>
    </section>
  </>;
}
