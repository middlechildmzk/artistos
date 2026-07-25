import { Badge, Card, Empty, ErrorNotice, Metric, PageHeader, StatusBadge } from '@/components/ui';
import { boostPublishedPost, createContentItem, recordCampaignMetric, updateContentStatus } from '@/lib/social-actions';
import { getSocialWorkspace, NEVER_ALONE_PRESAVE_URL } from '@/lib/social-data';
import type { Row } from '@/lib/data';

const platforms = ['Instagram','Facebook','TikTok','YouTube Shorts','X','Email','Threads'];
const statuses = ['idea','drafted','ready','scheduled','published','blocked'];
const approvals = ['draft','review','approved','rejected'];

export default async function SocialPage() {
  const data = await getSocialWorkspace();
  const upcoming = data.items.filter((row: Row) => row.status !== 'published').slice(0, 20);
  const published = data.items.filter((row: Row) => row.status === 'published').slice(0, 20);

  return <>
    <PageHeader
      eyebrow="Social promotion command center"
      title="Create, approve, amplify, measure"
      description="Turn one verified campaign idea into platform-ready work. ArtistOS prepares and tracks the plan; nothing is auto-published."
      actions={<a className="button primary" href={NEVER_ALONE_PRESAVE_URL} target="_blank" rel="noreferrer">Open pre-save</a>}
    />

    {data.migrationRequired ? <div className="notice warning"><strong>Apply the social execution migration.</strong> Run <code>supabase/migrations/20260725100000_artistos_social_execution.sql</code> before using writes on this page.</div> : null}
    <ErrorNotice message={!data.migrationRequired ? data.error : null} />

    <section className="grid grid-4">
      <Metric value={data.counts.ideas} label="ideas" />
      <Metric value={data.counts.ready} label="ready" />
      <Metric value={data.counts.scheduled} label="scheduled" />
      <Metric value={data.counts.published} label="published" />
    </section>

    <section className="section grid grid-2">
      <Card>
        <div className="eyebrow">New content item</div>
        <h2>Build the next post</h2>
        <p className="muted">Every post keeps its platform, CTA, asset, approval, schedule, and source context together.</p>
        <form action={createContentItem} className="stack">
          <input type="hidden" name="release_id" value={data.release?.id || ''} />
          <div className="field"><label>Working title</label><input className="input" name="title" required placeholder="Never Alone teaser: repaired by light" /></div>
          <div className="form-grid">
            <div className="field"><label>Platform</label><select className="select" name="platform">{platforms.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Format</label><select className="select" name="post_type"><option>Reel</option><option>Story</option><option>Short video</option><option>Feed post</option><option>Carousel</option><option>Email</option></select></div>
            <div className="field"><label>Status</label><select className="select" name="status" defaultValue="drafted">{statuses.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Approval</label><select className="select" name="approval_state" defaultValue="review">{approvals.map((item) => <option key={item}>{item}</option>)}</select></div>
          </div>
          <div className="field"><label>Hook</label><input className="input" name="hook" placeholder="I wrote this during one of the hardest seasons of my life." /></div>
          <div className="field"><label>Caption / script</label><textarea className="textarea" name="copy" placeholder="Write the complete platform-ready copy here." /></div>
          <div className="field"><label>CTA</label><input className="input" name="cta" defaultValue={NEVER_ALONE_PRESAVE_URL} /></div>
          <div className="form-grid">
            <div className="field"><label>Schedule</label><input className="input" type="datetime-local" name="scheduled_for" /></div>
            <div className="field"><label>Aspect ratio</label><select className="select" name="aspect_ratio"><option>9:16</option><option>4:5</option><option>1:1</option><option>16:9</option></select></div>
          </div>
          <div className="field"><label>Asset</label><select className="select" name="asset_id"><option value="">No linked asset yet</option>{data.assets.map((asset: Row) => <option value={asset.id} key={asset.id}>{asset.name} · {asset.asset_type}</option>)}</select></div>
          <div className="field"><label>Hashtags / keywords</label><input className="input" name="hashtags" placeholder="#NeverAlone #MiddleChild #MelodicBass" /></div>
          <div className="field"><label>Notes</label><textarea className="textarea" name="notes" placeholder="Visual direction, posting instructions, reply plan, or blocker." /></div>
          <button className="button primary" type="submit">Save content item</button>
        </form>
      </Card>

      <Card>
        <div className="eyebrow">Boost This Post</div>
        <h2>Turn one post into the next 24 hours</h2>
        <p className="muted">Creates four reviewable follow-ups: Story, TikTok, Facebook, and X. They remain drafts until you approve them.</p>
        <form action={boostPublishedPost} className="stack">
          <input type="hidden" name="release_id" value={data.release?.id || ''} />
          <div className="field"><label>Published ArtistOS item</label><select className="select" name="source_id"><option value="">Use pasted post instead</option>{published.map((item: Row) => <option value={item.id} key={item.id}>{item.title} · {item.platform}</option>)}</select></div>
          <div className="field"><label>Published post URL</label><input className="input" name="source_url" type="url" placeholder="https://instagram.com/p/..." /></div>
          <div className="field"><label>Original caption or message</label><textarea className="textarea" name="source_copy" placeholder="Paste the post copy so the variants stay grounded in what was actually published." /></div>
          <div className="notice">ArtistOS will schedule suggested drafts six hours apart. It will not post them automatically.</div>
          <button className="button primary" type="submit">Create amplification plan</button>
        </form>

        <div className="section eyebrow">Release CTA</div>
        <div className="card inset"><strong>Never Alone · July 31</strong><p className="muted">{NEVER_ALONE_PRESAVE_URL}</p><a className="button ghost" href={NEVER_ALONE_PRESAVE_URL} target="_blank" rel="noreferrer">Verify destination</a></div>
      </Card>
    </section>

    <section className="section">
      <Card>
        <div className="row between"><div><div className="eyebrow">Execution queue</div><h2>Review and move the work</h2></div><Badge>{upcoming.length} loaded</Badge></div>
        {upcoming.length ? <div className="stack">{upcoming.map((item: Row) => <div className="card" key={item.id}>
          <div className="row between"><div><strong>{item.title}</strong><div className="kicker">{item.platform || 'Platform unknown'} · {item.post_type || item.content_type || 'Format unknown'} · {item.scheduled_for || 'Unscheduled'}</div></div><div className="row wrap"><StatusBadge status={item.status} /><StatusBadge status={item.approval_state} /></div></div>
          {item.hook ? <p><strong>Hook:</strong> {item.hook}</p> : null}
          <p className="muted">{item.copy || item.notes || 'No copy or notes recorded.'}</p>
          <div className="row wrap">{item.aspect_ratio ? <Badge>{item.aspect_ratio}</Badge> : null}{item.cta ? <a className="button ghost" href={item.cta} target="_blank" rel="noreferrer">Open CTA</a> : null}</div>
          <form action={updateContentStatus} className="form-grid section">
            <input type="hidden" name="id" value={item.id} />
            <div className="field"><label>Status</label><select className="select" name="status" defaultValue={item.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
            <div className="field"><label>Approval</label><select className="select" name="approval_state" defaultValue={item.approval_state || 'draft'}>{approvals.map((approval) => <option key={approval}>{approval}</option>)}</select></div>
            <div className="field"><label>Published URL</label><input className="input" name="published_url" type="url" defaultValue={item.published_url || ''} /></div>
            <button className="button primary" type="submit">Update</button>
          </form>
        </div>)}</div> : <Empty>No upcoming content exists yet. Create the first post above.</Empty>}
      </Card>
    </section>

    <section className="section grid grid-2">
      <Card>
        <div className="eyebrow">Manual analytics</div>
        <h2>Record what happened</h2>
        <p className="muted">Manual numbers remain labeled manual. No fabricated live analytics.</p>
        <form action={recordCampaignMetric} className="stack">
          <input type="hidden" name="release_id" value={data.release?.id || ''} />
          <div className="form-grid"><div className="field"><label>Platform</label><select className="select" name="platform">{platforms.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>Date</label><input className="input" type="date" name="metric_date" /></div></div>
          <div className="form-grid"><div className="field"><label>Views</label><input className="input" type="number" min="0" name="views" /></div><div className="field"><label>Reach</label><input className="input" type="number" min="0" name="reach" /></div><div className="field"><label>Likes</label><input className="input" type="number" min="0" name="likes" /></div><div className="field"><label>Comments</label><input className="input" type="number" min="0" name="comments" /></div><div className="field"><label>Shares</label><input className="input" type="number" min="0" name="shares" /></div><div className="field"><label>Clicks</label><input className="input" type="number" min="0" name="clicks" /></div><div className="field"><label>Saves</label><input className="input" type="number" min="0" name="saves" /></div><div className="field"><label>Spend ($)</label><input className="input" type="number" min="0" step="0.01" name="spend" /></div></div>
          <div className="field"><label>Notes</label><textarea className="textarea" name="notes" /></div>
          <button className="button primary" type="submit">Save manual metrics</button>
        </form>
      </Card>

      <Card>
        <div className="row between"><div><div className="eyebrow">Recent results</div><h2>Measured campaign signals</h2></div><Badge>{data.metrics.length}</Badge></div>
        {data.metrics.length ? <div className="timeline">{data.metrics.map((metric: Row) => <div className="timeline-item" key={metric.id}><strong>{metric.platform}</strong><div className="kicker">{metric.metric_date} · {metric.source_type}</div><p className="muted">Views {metric.metrics?.views || 0} · Reach {metric.metrics?.reach || 0} · Clicks {metric.metrics?.clicks || 0} · Saves {metric.metrics?.saves || 0} · Spend ${Number(metric.metrics?.spend || 0).toFixed(2)}</p></div>)}</div> : <Empty>No campaign metrics have been recorded.</Empty>}
      </Card>
    </section>

    <section className="section"><Card><div className="eyebrow">Published library</div><h2>Verified live posts</h2>{published.length ? <div className="list">{published.map((item: Row) => <div className="list-item" key={item.id}><span className="check">✓</span><div><strong>{item.title}</strong><div className="kicker">{item.platform} · {item.published_at || item.scheduled_for || 'date unknown'}</div></div>{item.published_url ? <a className="button ghost" href={item.published_url} target="_blank" rel="noreferrer">Open post</a> : <Badge tone="amber">URL missing</Badge>}</div>)}</div> : <Empty>No posts are marked published yet.</Empty>}</Card></section>
  </>;
}
