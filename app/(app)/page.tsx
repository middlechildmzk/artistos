import Link from 'next/link';
import { getTodayData, type Row } from '@/lib/data';
import { toggleTask } from '@/lib/actions';
import { Badge, Card, Metric, StatusBadge } from '@/components/ui';
import { AICopilotForm } from '@/components/AICopilotForm';

function daysUntil(date: string) {
  const target = new Date(`${date}T12:00:00-05:00`).getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / 86400000));
}

export default async function TodayPage() {
  const data = await getTodayData();
  const days = daysUntil(data.releaseDate);
  const percent = data.progress.total ? Math.round((data.progress.done / data.progress.total) * 100) : 0;
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow">Friday, July 24 · regain control</div>
            <h1>Never Alone<br /><span style={{color:'#a99eff'}}>release command center</span></h1>
            <p className="muted" style={{maxWidth:660}}>One focused plan built from the live campaign, not a demo dashboard. Finish what protects the release, then move the highest-trust outreach forward.</p>
            <div className="row wrap">
              <Badge tone="green">{data.progress.done} complete</Badge>
              <Badge tone="amber">{data.progress.open} open</Badge>
              <Badge>{percent}% campaign progress</Badge>
            </div>
          </div>
          <div className="countdown"><strong>{days}</strong><span>days until July 31</span></div>
        </div>
      </section>

      <section className="section grid grid-4">
        <Metric value={data.counts.properties.toLocaleString()} label="playlists and properties" />
        <Metric value={data.counts.people.toLocaleString()} label="industry contacts" />
        <Metric value={data.counts.fans.toLocaleString()} label="contactable fans" />
        <Metric value={data.counts.suppressions.toLocaleString()} label="authoritative suppressions" />
      </section>

      <section className="section grid grid-2">
        <Card>
          <div className="row between"><div><div className="eyebrow">Do this next</div><h2>{data.nextTask?.title ?? 'Review the release workspace'}</h2></div><span className="check">1</span></div>
          <p className="muted">{data.nextTask?.detail || 'The deterministic queue uses deadline, spine classification, blocker state, and campaign order.'}</p>
          {data.nextTask?.blocked_by && !data.nextTask.blocker_cleared ? <div className="notice warning">Blocked by: {data.nextTask.blocked_by}</div> : null}
          <div className="row wrap section">
            {data.nextTask ? <form action={toggleTask}><input type="hidden" name="id" value={data.nextTask.id} /><input type="hidden" name="current" value={data.nextTask.status} /><button className="button primary" type="submit">Mark complete</button></form> : null}
            <Link className="button ghost" href="/releases">Open release workspace</Link>
          </div>
        </Card>
        <Card>
          <div className="row between"><div><div className="eyebrow">Campaign health</div><h2>{percent}% ready</h2></div><Badge tone={data.blockers.length ? 'amber' : 'green'}>{data.blockers.length} blockers</Badge></div>
          <div className="progress"><span style={{width:`${percent}%`}} /></div>
          <p className="muted section">Completion is capped by real blockers and integration readiness. Filled fields alone never produce 100%.</p>
          <div className="row wrap"><Badge>{data.counts.outcomes} outcomes</Badge><Badge>{data.counts.endpoints} submission routes</Badge><Badge tone={data.counts.risks ? 'amber' : 'green'}>{data.counts.risks} risk records</Badge></div>
        </Card>
      </section>

      <section className="section grid grid-2">
        <Card>
          <div className="row between"><div><div className="eyebrow">Prioritized queue</div><h2>Next actions</h2></div><Link href="/releases" className="button ghost">All tasks</Link></div>
          <div className="list">
            {data.tasks.filter((task: Row) => task.status !== 'done').slice(0, 7).map((task: Row, index: number) => (
              <div className="list-item" key={task.id}>
                <form action={toggleTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="current" value={task.status} /><button className="check" type="submit" aria-label={`Complete ${task.title}`}>{index + 1}</button></form>
                <div><strong>{task.title}</strong><div className="kicker">{task.due_date ? `Due ${task.due_date}` : 'No due date'} · {task.classification}</div></div>
                <StatusBadge status={task.blocked_by && !task.blocker_cleared ? 'blocked' : task.status} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="row between"><div><div className="eyebrow">Targeting</div><h2>Recommended today</h2></div><Link href="/playlists" className="button ghost">Explore all</Link></div>
          <div className="list">
            {data.rankedProperties.map((property: Row) => (
              <Link className="list-item" href={`/playlists?id=${property.id}`} key={property.id}>
                <span className="check">{property.fit.score}</span>
                <div><strong>{property.name}</strong><div className="kicker">{property.platform || 'Unknown platform'} · {property.fit.reasons[0]}</div></div>
                <StatusBadge status={property.verification_status} />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="section grid grid-2">
        <Card><div className="eyebrow">Audited copilot</div><h2>Grounded release help</h2><p className="muted">Uses saved release and task facts, stores an audit record, and never sends or overrides suppression and risk controls.</p><AICopilotForm /></Card>
        <Card><div className="eyebrow">Release-week rule</div><h2>Protect the spine</h2><p className="muted">Finish metadata, links, content, safe audience, and verified outreach before adding new systems. Anything blocked stays visible instead of being silently treated as done.</p><div className="row wrap"><Badge tone="green">Live data</Badge><Badge tone="amber">Explicit sends only</Badge><Badge>{data.counts.signals} relationship signals</Badge></div></Card>
      </section>

      <section className="section grid grid-2">
        <Card>
          <div className="eyebrow">Blocked work</div><h2>Clear these before adding more</h2>
          {data.blockers.length ? <div className="stack">{data.blockers.slice(0,5).map((task: Row) => <div className="notice warning" key={task.id}><strong>{task.title}</strong><br />{task.blocked_by}</div>)}</div> : <div className="empty">No recorded blockers.</div>}
        </Card>
        <Card>
          <div className="eyebrow">Follow-through</div><h2>Follow-ups due</h2>
          {data.followUps.length ? <div className="list">{data.followUps.slice(0,6).map((item: Row) => <div className="list-item" key={item.id}><span className="check">↗</span><div><strong>{item.subject || item.channel || 'Outreach follow-up'}</strong><div className="kicker">Due {item.follow_up_due}</div></div><StatusBadge status="due" /></div>)}</div> : <div className="empty">No overdue follow-ups. Start with verified release-week targets.</div>}
        </Card>
      </section>
    </>
  );
}
