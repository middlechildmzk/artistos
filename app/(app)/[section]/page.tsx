import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, Empty, ErrorNotice, Metric, PageHeader, StatusBadge } from '@/components/ui';
import { getAssets, getContent, getFans, getImports, getIndustry, getIntegrations, getOutreach, getProperties, getReleases, globalSearch, type Row } from '@/lib/data';
import { logInteraction, toggleTask, updateRelationshipStage } from '@/lib/actions';
import { GmailDraftForm } from '@/components/GmailDraftForm';

const allowed = new Set(['releases','playlists','industry','fans','outreach','content','assets','imports','search','integrations']);
const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { section } = await params;
  if (!allowed.has(section)) notFound();
  const query = await searchParams;
  if (section === 'releases') return <ReleasesPage />;
  if (section === 'playlists') return <PlaylistsPage q={text(query.q)} stage={text(query.stage) || 'all'} id={text(query.id)} />;
  if (section === 'industry') return <IndustryPage q={text(query.q)} />;
  if (section === 'fans') return <FansPage q={text(query.q)} />;
  if (section === 'outreach') return <OutreachPage />;
  if (section === 'content') return <ContentPage />;
  if (section === 'assets') return <AssetsPage />;
  if (section === 'imports') return <ImportsPage />;
  if (section === 'search') return <SearchPage q={text(query.q)} />;
  return <IntegrationsPage />;
}

async function ReleasesPage() {
  const data = await getReleases();
  const active = data.releases.find((release: Row) => release.title === 'Never Alone') ?? data.releases[0];
  const activeTasks = data.tasks.filter((task: Row) => !active || task.release_id === active.id);
  const done = activeTasks.filter((task: Row) => task.status === 'done').length;
  const percent = activeTasks.length ? Math.round(done / activeTasks.length * 100) : 0;
  return <>
    <PageHeader eyebrow="Release workspace" title="Never Alone" description="Metadata, release spine, blockers, rights notes, and recorded outcomes for the July 31 launch." />
    <ErrorNotice message={data.error} />
    {active ? <>
      <section className="hero">
        <div className="hero-grid"><div><Badge tone="amber">{active.status}</Badge><h1 style={{marginTop:16}}>{active.title}{active.featured_artist ? <><br /><span style={{color:'#a99eff',fontSize:'.55em'}}>feat. {active.featured_artist}</span></> : null}</h1><p className="muted">{active.notes || 'Emotional electronic / melodic bass. Dark, wounded, hopeful, healing, cinematic, and bass-forward.'}</p></div><div className="stack"><div className="card metric"><strong>{active.release_date}</strong><span>release date</span></div><div className="row wrap"><Badge>{active.distributor || 'Distributor unknown'}</Badge><Badge>{active.label || 'Label unknown'}</Badge></div></div></div>
      </section>
      <section className="section grid grid-4"><Metric value={`${percent}%`} label="task completion" /><Metric value={active.upc || 'Unknown'} label="UPC" /><Metric value={done} label="tasks complete" /><Metric value={activeTasks.length - done} label="tasks remaining" /></section>
      <section className="section grid grid-2">
        <Card><div className="eyebrow">Canonical release facts</div><h2>Protected metadata</h2><div className="stack"><div className="row between"><span className="muted">Artist</span><strong>{active.artists?.name || 'Middle Child'}</strong></div><div className="row between"><span className="muted">Credit</span><strong>{active.title} (feat. {active.featured_artist || 'lowly sunday'})</strong></div><div className="row between"><span className="muted">Distributor</span><strong>{active.distributor || 'DistroKid'}</strong></div><div className="row between"><span className="muted">Label</span><strong>{active.label || 'BVSS FVM'}</strong></div><div className="row between"><span className="muted">Release date</span><strong>{active.release_date}</strong></div><div className="row between"><span className="muted">UPC</span><strong>{active.upc || '882877618355'}</strong></div></div></Card>
        <Card><div className="eyebrow">Rights and creator use</div><h2>Do not overclaim</h2><p className="muted">ArtistOS surfaces only recorded rights facts. It does not imply playlist placement, sync approval, Content ID status, zero-claim guarantees, stems, or blanket commercial rights.</p><div className="notice">One-stop ownership is a working internal fact for Dan Larson / BVSS FVM. Public creator-use language still requires the approved release memo and final platform settings.</div></Card>
      </section>
      <section className="section grid grid-2">
        <Card><div className="row between"><div><div className="eyebrow">Release spine</div><h2>Tasks and blockers</h2></div><Badge>{activeTasks.length} tasks</Badge></div><div className="list">{activeTasks.map((task: Row) => <div className="list-item" key={task.id}><form action={toggleTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="current" value={task.status} /><button className={`check ${task.status === 'done' ? 'done' : ''}`} type="submit">{task.status === 'done' ? '✓' : '○'}</button></form><div><strong>{task.title}</strong><div className="kicker">{task.due_date || 'No date'} · {task.classification}{task.blocked_by && !task.blocker_cleared ? ` · Blocked by ${task.blocked_by}` : ''}</div></div><StatusBadge status={task.status} /></div>)}</div></Card>
        <Card><div className="eyebrow">Recorded outcomes</div><h2>Evidence, not assumptions</h2>{data.outcomes.length ? <div className="timeline">{data.outcomes.slice(0,12).map((outcome: Row) => <div className="timeline-item" key={outcome.id}><strong>{outcome.outcome_type}</strong><div className="kicker">{outcome.outcome_date || 'Date unknown'} · confidence {outcome.confidence}</div><p className="muted">{outcome.evidence_summary || 'No evidence summary recorded.'}</p>{outcome.url ? <a className="button ghost" href={outcome.url} target="_blank" rel="noreferrer">Open evidence</a> : null}</div>)}</div> : <Empty>No outcomes are recorded for this release yet.</Empty>}</Card>
      </section>
    </> : <Empty>No releases are available through the authenticated live query.</Empty>}
  </>;
}

async function PlaylistsPage({ q, stage, id }: { q: string; stage: string; id: string }) {
  const data = await getProperties(q, stage, id);
  const detail = id ? data.rows[0] : null;
  if (detail) return <>
    <PageHeader eyebrow="Playlist detail" title={detail.name} description="Evidence, fit reasoning, submission routes, activity, outcomes, and risk records for this property." actions={<Link className="button ghost" href="/playlists">Back to map</Link>} />
    <ErrorNotice message={data.error} />
    <section className="grid grid-3"><Metric value={detail.fit.score} label="explainable fit score" /><Metric value={detail.platform || 'Unknown'} label="platform" /><Metric value={detail.followers_estimate || detail.followers_legacy || 'Unknown'} label="followers estimate" /></section>
    <section className="section grid grid-2">
      <Card><div className="row between"><div><div className="eyebrow">Target record</div><h2>{detail.name}</h2></div><StatusBadge status={detail.verification_status} /></div><div className="stack"><p className="muted">{detail.notes || 'No notes recorded.'}</p><div className="row wrap">{detail.fit.reasons.map((reason: string) => <Badge key={reason}>{reason}</Badge>)}</div><div className="row wrap">{(detail.genre_tags || []).map((tag: string) => <Badge key={tag}>{tag}</Badge>)}</div>{detail.url || detail.platform_url ? <a className="button primary" href={detail.url || detail.platform_url} target="_blank" rel="noreferrer">Open property</a> : null}</div></Card>
      <Card><div className="eyebrow">Relationship workflow</div><h2>Stage and next action</h2><form action={updateRelationshipStage} className="stack"><input type="hidden" name="table" value="properties" /><input type="hidden" name="id" value={detail.id} /><select className="select" name="stage" defaultValue={detail.relationship_stage || 'identified'}>{['identified','qualified','pitched','replied','negotiating','placed','declined','dormant'].map((option) => <option value={option} key={option}>{option}</option>)}</select><button className="button primary" type="submit">Save stage</button></form><div className="notice section">Missing emails, followers, ownership, or activity are shown as unknown, never as verified absence or zero.</div></Card>
    </section>
    <section className="section grid grid-2">
      <Card><div className="eyebrow">Submission routes</div><h2>{data.detail?.endpoints.length || 0} endpoints</h2>{data.detail?.endpoints.length ? <div className="stack">{data.detail.endpoints.map((endpoint: any) => <div className="card" key={endpoint.id}><div className="row between"><strong>{endpoint.endpoint_type || 'Submission route'}</strong><StatusBadge status={endpoint.verification_status} /></div><p className="muted">{endpoint.submission_rules || endpoint.notes || 'No rules recorded.'}</p>{endpoint.submission_url ? <a className="button ghost" href={endpoint.submission_url} target="_blank" rel="noreferrer">Open route</a> : endpoint.submission_email ? <Badge>{endpoint.submission_email}</Badge> : <Badge tone="amber">No route recorded</Badge>}</div>)}</div> : <Empty>No linked submission endpoint is recorded.</Empty>}</Card>
      <Card><div className="eyebrow">Risk and outcomes</div><h2>Evidence trail</h2>{data.detail?.risks.map((risk: any) => <div className="notice danger" key={risk.id}><strong>{risk.risk_classification || risk.event_type}</strong><br />{risk.evidence || risk.measured_outcome}</div>)}{data.detail?.outcomes.map((outcome: any) => <div className="notice" key={outcome.id}><strong>{outcome.outcome_type}</strong><br />{outcome.evidence_summary}</div>)}{!data.detail?.risks.length && !data.detail?.outcomes.length ? <Empty>No linked risk or outcome records.</Empty> : null}</Card>
    </section>
  </>;
  return <>
    <PageHeader eyebrow="Playlist and curator map" title="3,184 working targets" description="Search, rank, verify, open, and move real properties through an evidence-first outreach pipeline." />
    <form className="card form-grid" method="get"><div className="field"><label htmlFor="q">Search name, owner, or genre</label><input className="input" id="q" name="q" defaultValue={q} placeholder="melodic bass, future bass, curator…" /></div><div className="field"><label htmlFor="stage">Relationship view</label><select className="select" id="stage" name="stage" defaultValue={stage}><option value="all">All records</option>{['identified','qualified','pitched','replied','negotiating','placed','declined','dormant'].map((option) => <option value={option} key={option}>{option}</option>)}</select></div><button className="button primary" type="submit">Apply filters</button><Link className="button ghost" href="/playlists">Reset</Link></form>
    <ErrorNotice message={data.error} />
    <section className="section table-wrap"><table><thead><tr><th>Fit</th><th>Property</th><th>Platform</th><th>Owner / genre</th><th>Verification</th><th>Stage</th><th>Next</th></tr></thead><tbody>{data.rows.map((row: Row) => <tr key={row.id}><td><Badge tone={row.fit.score >= 70 ? 'green' : row.fit.score >= 50 ? 'amber' : ''}>{row.fit.score}</Badge></td><td><Link href={`/playlists?id=${row.id}`}><strong>{row.name}</strong></Link><div className="kicker">{row.followers_estimate || row.followers_legacy || 'Audience size unknown'}</div></td><td>{row.platform || 'Unknown'}</td><td>{row.owner_or_operator || row.genres || (row.genre_tags || []).join(', ') || 'Unknown'}</td><td><StatusBadge status={row.verification_status} /></td><td><StatusBadge status={row.relationship_stage} /></td><td>{row.next_action || 'Verify fit and route'}</td></tr>)}</tbody></table></section>
    {!data.rows.length ? <Empty>No matching properties. Try a broader search or another relationship stage.</Empty> : null}
  </>;
}

async function IndustryPage({ q }: { q: string }) {
  const data = await getIndustry(q);
  return <>
    <PageHeader eyebrow="Industry CRM" title="People, organizations, evidence" description="Industry records remain separate from fans and preserve source, verification, relationship, and route context." />
    <form className="card row" method="get"><input className="input" name="q" defaultValue={q} placeholder="Search name, role, email, company, or type" /><button className="button primary" type="submit">Search</button></form>
    <ErrorNotice message={data.error} />
    <section className="section grid grid-3"><Metric value={data.people.length} label="people in current result" /><Metric value={data.organizations.length} label="organizations in current result" /><Metric value={data.endpoints.length} label="submission routes loaded" /></section>
    <section className="section grid grid-2">
      <Card><div className="eyebrow">People</div><h2>Industry contacts</h2><div className="list">{data.people.map((person: Row) => <div className="list-item" key={person.id}><span className="check">◇</span><div><strong>{person.full_name || [person.first_name,person.last_name].filter(Boolean).join(' ') || 'Unnamed contact'}</strong><div className="kicker">{person.role || person.role_type || 'Role unknown'} · {person.email || 'Email not recorded'} · {person.location || 'Location unknown'}</div></div><StatusBadge status={person.verification_status} /></div>)}</div></Card>
      <Card><div className="eyebrow">Organizations</div><h2>Properties and companies</h2><div className="list">{data.organizations.map((org: Row) => <div className="list-item" key={org.id}><span className="check">⬡</span><div><strong>{org.display_name || org.canonical_name}</strong><div className="kicker">{org.org_type || 'Type unknown'} · {org.location || 'Location unknown'} · trust {org.trust_tier}</div></div><StatusBadge status={org.relationship_stage} /></div>)}</div></Card>
    </section>
    <section className="section grid grid-2"><Card><div className="eyebrow">Relationship signals</div><h2>Recorded evidence</h2>{data.signals.length ? <div className="timeline">{data.signals.map((signal: Row) => <div className="timeline-item" key={signal.id}><strong>{signal.entity_label || signal.email || 'Relationship signal'}</strong><div className="kicker">{signal.interaction_date || 'Date unknown'} · {signal.relationship_status || 'status unknown'}</div><p className="muted">{signal.evidence_summary || signal.signal}</p></div>)}</div> : <Empty>No relationship signals match this view.</Empty>}</Card><Card><div className="eyebrow">Verified routes</div><h2>Submission endpoints</h2>{data.endpoints.length ? <div className="stack">{data.endpoints.map((endpoint: Row) => <div className="card" key={endpoint.id}><div className="row between"><strong>{endpoint.endpoint_type || 'Endpoint'}</strong><StatusBadge status={endpoint.verification_status} /></div><p className="muted">{endpoint.submission_rules || endpoint.notes || 'No rules recorded.'}</p></div>)}</div> : <Empty>No submission endpoints available.</Empty>}</Card></section>
  </>;
}

async function FansPage({ q }: { q: string }) {
  const data = await getFans(q);
  return <>
    <PageHeader eyebrow="Suppression-safe fan CRM" title="Audience without accidental harm" description="Fans are searched and segmented separately from industry contacts. Every send path must re-check the authoritative suppression table." />
    <div className="notice warning"><strong>{data.suppressionCount.toLocaleString()} authoritative suppressions are active.</strong> Suppressed addresses never appear in a sendable workflow. The Gmail draft API performs another exact suppression check immediately before draft creation.</div>
    <form className="card row section" method="get"><input className="input" name="q" defaultValue={q} placeholder="Search email, name, segment, or location" /><button className="button primary" type="submit">Search safe audience</button></form>
    <ErrorNotice message={data.error} />
    <section className="section table-wrap"><table><thead><tr><th>Fan</th><th>Segment</th><th>Consent</th><th>Verification</th><th>Source</th><th>Location</th></tr></thead><tbody>{data.fans.map((fan: Row) => <tr key={fan.id}><td><strong>{fan.name || fan.first_name || 'Unnamed fan'}</strong><div className="kicker">{fan.email}</div></td><td>{fan.segment || 'Unsegmented'}</td><td><StatusBadge status={fan.consent_status} /></td><td><StatusBadge status={fan.verification_status} /></td><td>{fan.consent_source || fan.source_files || fan.source_sheet || 'Unknown'}</td><td>{fan.location || 'Unknown'}</td></tr>)}</tbody></table></section>
    {!data.fans.length ? <Empty>No safe audience records match this search.</Empty> : null}
    <section className="section"><Card><div className="eyebrow">Recent suppressions</div><h2>Do not contact</h2><div className="list">{data.suppressions.map((row: Row) => <div className="list-item" key={row.email}><span className="check">!</span><div><strong>{row.email}</strong><div className="kicker">{row.reason || 'Reason not recorded'} · {row.source || 'Source unknown'}</div></div><StatusBadge status="suppressed" /></div>)}</div></Card></section>
  </>;
}

async function OutreachPage() {
  const data = await getOutreach();
  return <>
    <PageHeader eyebrow="Outreach workspace" title="Personalize, review, confirm" description="Build one grounded message at a time. ArtistOS never auto-sends or hides follow-ups." />
    <ErrorNotice message={data.error} />
    <section className="grid grid-2">
      <Card><div className="eyebrow">Gmail draft</div><h2>Create a real reviewable draft</h2><p className="muted">Requires the committed OAuth migration, Google credentials, and a connected Gmail account. Recipient suppression is checked before Gmail is called.</p><GmailDraftForm properties={data.properties} people={data.people} /></Card>
      <Card><div className="eyebrow">Manual interaction</div><h2>Log outreach without sending</h2><form action={logInteraction} className="stack"><div className="field"><label>Property</label><select className="select" name="property_id"><option value="">No property</option>{data.properties.map((row: Row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></div><div className="field"><label>Person</label><select className="select" name="person_id"><option value="">No person</option>{data.people.map((row: Row) => <option value={row.id} key={row.id}>{row.full_name || row.email}</option>)}</select></div><div className="field"><label>Channel</label><select className="select" name="channel"><option>email</option><option>submission form</option><option>Instagram</option><option>LinkedIn</option><option>other</option></select></div><div className="field"><label>Subject</label><input className="input" name="subject" /></div><div className="field"><label>Message / notes</label><textarea className="textarea" name="body" /></div><div className="field"><label>Follow-up due</label><input className="input" type="date" name="follow_up_due" /></div><button className="button primary" type="submit">Log interaction</button></form></Card>
    </section>
    <section className="section"><Card><div className="row between"><div><div className="eyebrow">Activity</div><h2>Recent interactions</h2></div><Badge>{data.interactions.length}</Badge></div>{data.interactions.length ? <div className="timeline">{data.interactions.map((item: Row) => <div className="timeline-item" key={item.id}><strong>{item.subject || item.channel || 'Interaction'}</strong><div className="kicker">{item.occurred_at} · {item.direction} · follow-up {item.follow_up_due || 'not scheduled'}</div><p className="muted">{item.notes || item.body || 'No notes recorded.'}</p></div>)}</div> : <Empty>No interactions are recorded yet. Create a draft or log a verified submission.</Empty>}</Card></section>
  </>;
}

async function ContentPage() {
  const data = await getContent();
  const runbook = [
    ['Jul 24','Regain control','Confirm master, art, metadata, links, pitch, Canvas, integrations, safe audience, and three next posts.'],
    ['Jul 25','Target and personalize','Rank practical outreach batches by fit, trust, route quality, and timing.'],
    ['Jul 26','Audience warm-up','Review the suppression-safe segment, create the fan draft, and publish a story-led teaser.'],
    ['Jul 27','Outreach wave one','Contact the highest-fit verified targets and log every route and follow-up.'],
    ['Jul 28','Content and creator use','Publish the strongest short-form teaser and use only approved rights language.'],
    ['Jul 29','Follow-up and readiness','Prepare release-day copy and resolve real blockers.'],
    ['Jul 30','Final checks','Verify links, drafts, assets, CTAs, and recipient safety. Avoid unnecessary migrations.'],
    ['Jul 31','Release day','Confirm live links, publish, send the reviewed email, log results, and celebrate.'],
  ];
  return <>
    <PageHeader eyebrow="Release-week calendar" title="Content that moves the launch" description="A focused July 24–31 operating rhythm, plus database-backed content items after the reviewed migration is applied." />
    {data.migrationRequired ? <div className="notice warning">The <code>content_items</code> migration is committed but has not been applied to production. The release-week runbook remains usable without changing live data.</div> : null}
    <ErrorNotice message={!data.migrationRequired ? data.error : null} />
    <section className="section grid grid-2">
      <Card><div className="eyebrow">Runbook</div><h2>July 24–31</h2><div className="timeline">{runbook.map(([date,title,detail]) => <div className="timeline-item" key={date}><strong>{date} · {title}</strong><p className="muted">{detail}</p></div>)}</div></Card>
      <Card><div className="eyebrow">Scheduled content</div><h2>Database items</h2>{data.items.length ? <div className="list">{data.items.map((item: Row) => <div className="list-item" key={item.id}><span className="check">▦</span><div><strong>{item.title}</strong><div className="kicker">{item.platform || 'Platform unknown'} · {item.scheduled_for || 'Unscheduled'}</div></div><StatusBadge status={item.status} /></div>)}</div> : <Empty>No content items are stored yet. Apply the reviewed migration, then add copy, assets, platform, CTA, owner, and schedule.</Empty>}</Card>
    </section>
  </>;
}

async function AssetsPage() {
  const data = await getAssets();
  return <>
    <PageHeader eyebrow="Asset library" title="Masters, artwork, video, copy" description="Store verified locations and rights/use notes without pretending a missing asset exists." />
    <ErrorNotice message={data.error} />
    <section className="grid grid-4"><Metric value={data.assets.length} label="stored assets" /><Metric value={data.assets.filter((a: Row) => a.status === 'ready').length} label="ready" /><Metric value={data.assets.filter((a: Row) => a.asset_type?.includes('video')).length} label="video assets" /><Metric value={data.assets.filter((a: Row) => a.url).length} label="linked files" /></section>
    <section className="section grid grid-3">{data.assets.map((asset: Row) => <Card key={asset.id}><div className="row between"><Badge>{asset.asset_type}</Badge><StatusBadge status={asset.status} /></div><h2 style={{marginTop:14}}>{asset.name}</h2><p className="muted">{asset.notes || asset.location_note || 'No notes recorded.'}</p><div className="kicker">{asset.releases?.title || asset.artists?.name || 'Unassigned'}</div>{asset.url ? <a className="button primary section" href={asset.url} target="_blank" rel="noreferrer">Open asset</a> : null}</Card>)}</section>
    {!data.assets.length ? <Empty>No asset records exist yet. Add only verified links or storage locations.</Empty> : null}
  </>;
}

async function ImportsPage() {
  const data = await getImports();
  return <>
    <PageHeader eyebrow="Import control" title="Dry run before write" description="Fan, industry, organization, and property imports stay separate, preserve provenance, detect likely duplicates, and retain rollback history." />
    <div className="notice warning">This preview intentionally does not accept blind CSV inserts. The current safe workflow is: classify import type, map columns, dry run, review duplicates and suppressions, then approve a tracked batch.</div>
    <ErrorNotice message={data.error} />
    <section className="section table-wrap"><table><thead><tr><th>Source</th><th>Sheet</th><th>Status</th><th>Rows</th><th>Imported</th><th>Created</th><th>Rollback</th></tr></thead><tbody>{data.batches.map((batch: Row) => <tr key={batch.id}><td><strong>{batch.source_file}</strong><div className="kicker">{batch.description}</div></td><td>{batch.source_sheet || '—'}</td><td><StatusBadge status={batch.status} /></td><td>{batch.row_count ?? 'Unknown'}</td><td>{batch.imported_count ?? 'Unknown'}</td><td>{batch.created_at}</td><td>{batch.rolled_back_at ? <Badge tone="red">rolled back</Badge> : <Badge tone="green">available</Badge>}</td></tr>)}</tbody></table></section>
  </>;
}

async function SearchPage({ q }: { q: string }) {
  const data = await globalSearch(q);
  return <>
    <PageHeader eyebrow="Global search" title="Find the next useful record" description="Search across releases, tasks, properties, people, organizations, and fans. Results stay grouped by entity type." />
    <form className="card row" method="get"><input className="input" name="q" defaultValue={q} placeholder="Never Alone, melodic bass, curator name, email…" autoFocus /><button className="button primary" type="submit">Search</button></form>
    <ErrorNotice message={data.error} />
    {!q ? <section className="section"><Empty>Enter a specific name, email, property, release, or task.</Empty></section> : <section className="section grid grid-2">{Object.entries(data.groups).map(([group, rows]) => <Card key={group}><div className="row between"><h2 style={{textTransform:'capitalize'}}>{group}</h2><Badge>{rows.length}</Badge></div>{rows.length ? <div className="list">{rows.map((row: any) => <div className="list-item" key={row.id}><span className="check">⌕</span><div><strong>{row.title || row.name || row.full_name || row.display_name || row.canonical_name || row.email}</strong><div className="kicker">{row.status || row.role || row.platform || row.segment || row.org_type || 'Record'}</div></div>{group === 'properties' ? <Link className="button ghost" href={`/playlists?id=${row.id}`}>Open</Link> : <StatusBadge status={row.relationship_stage || row.verification_status || row.status} />}</div>)}</div> : <Empty>No matches.</Empty>}</Card>)}</section>}
  </>;
}

async function IntegrationsPage() {
  const data = await getIntegrations();
  const cards = [
    { name:'Supabase', status:data.supabase.status, detail:data.supabase.detail, href:null, action:'Live-data health' },
    { name:'Gmail / Google', status:data.google.status, detail:data.google.connection?.account_email || (data.google.configured ? 'Credentials present; connect and test.' : 'Add Google OAuth credentials and encryption key.'), href:'/api/oauth/google/start', action:'Connect Gmail' },
    { name:'Spotify', status:data.spotify.status, detail:data.spotify.connection?.account_email || (data.spotify.configured ? 'Credentials present; connect and test.' : 'Add Spotify OAuth credentials and encryption key.'), href:'/api/oauth/spotify/start', action:'Connect Spotify' },
    { name:'AI copilot', status:data.ai.status, detail:data.ai.configured ? `Configured for ${data.ai.model}; run a grounded generation test before marking connected.` : 'Add OPENAI_API_KEY server-side.', href:null, action:'Audited generation' },
    { name:'DistroKid / HyperFollow', status:'manual', detail:'Manual links and verified timestamps only. ArtistOS does not scrape private dashboards.', href:null, action:'Manual workflow' },
    { name:'Social publishing', status:'manual', detail:'Calendar, copy, assets, checklist, and verified post URLs. No fake publishing confirmation.', href:null, action:'Manual workflow' },
  ];
  return <>
    <PageHeader eyebrow="Integration health" title="Connected means tested" description="Credentials alone never produce a green status. ArtistOS records identity, scope, last successful request, and safe failure details." />
    {data.migrationRequired ? <div className="notice warning"><strong>Reviewed database migration required.</strong> Apply <code>supabase/migrations/20260724190000_artistos_integrations.sql</code> before OAuth connections or content items can persist. No production DDL was applied automatically.</div> : null}
    <section className="section grid grid-3">{cards.map((item: Row) => <Card key={item.name}><div className="row between"><h2>{item.name}</h2><StatusBadge status={item.status} /></div><p className="muted">{item.detail}</p>{item.href ? <a className="button primary" href={item.href}>{item.action}</a> : <Badge>{item.action}</Badge>}</Card>)}</section>
    <section className="section"><Card><div className="eyebrow">Environment and promotion</div><h2>Preview first, production later</h2><ol className="muted"><li>Apply the reviewed non-destructive migration only after approval.</li><li>Configure Preview environment variables separately in Vercel.</li><li>Connect Gmail and Spotify through preview redirect URLs.</li><li>Create a real Gmail draft, run a Spotify profile test, and perform a grounded AI test.</li><li>Verify task, relationship-stage, and interaction writes persist under RLS.</li><li>Run browser verification on desktop and mobile.</li><li>Only then promote the preview deployment to the production alias.</li></ol></Card></section>
  </>;
}
