import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addMetric } from "../intelligence/actions";

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;
  const [{ data: metrics }, { data: artists }, { data: releases }, { count: placements }, { count: replies }] = await Promise.all([
    supabase.from("metric_snapshots").select("*").eq("workspace_id", workspaceId).order("captured_on", { ascending: false }).limit(200),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId),
    supabase.from("releases").select("id,title").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
    supabase.from("outcomes").select("id", {count:"exact",head:true}).eq("workspace_id", workspaceId),
    supabase.from("interactions").select("id", {count:"exact",head:true}).eq("workspace_id", workspaceId).neq("reply_status","none"),
  ]);
  const latest = new Map<string, any>();
  for (const metric of metrics ?? []) { const key = `${metric.platform}:${metric.metric}`; if (!latest.has(key)) latest.set(key, metric); }
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">Cross-platform performance</div><h1>Analytics Hub</h1><p className="muted">One evidence layer for audience growth, streams, engagement, outreach, and placements.</p></div><nav className="nav-links"><Link className="button ghost" href="/command-center">Command</Link><Link className="button ghost" href="/studio">Studio</Link><Link className="button ghost" href="/campaigns">Campaigns</Link></nav></header>
  <section className="grid stats" style={{marginBottom:16}}><div className="card"><div className="eyebrow">Tracked signals</div><div className="stat-value">{latest.size}</div></div><div className="card"><div className="eyebrow">Recorded outcomes</div><div className="stat-value">{placements ?? 0}</div></div><div className="card"><div className="eyebrow">Replies</div><div className="stat-value">{replies ?? 0}</div></div><div className="card"><div className="eyebrow">Platforms</div><div className="stat-value">{new Set((metrics ?? []).map(m=>m.platform)).size}</div></div></section>
  <section className="grid two-col"><div className="card"><h2>Latest metrics</h2>{Array.from(latest.values()).length ? Array.from(latest.values()).map((metric:any)=><div className="row" key={`${metric.platform}-${metric.metric}`}><div><strong>{metric.platform} · {metric.metric}</strong><p className="muted">{metric.captured_on}</p></div><div className="stat-value compact">{Number(metric.value).toLocaleString()}</div></div>) : <div className="empty">Add the first metric snapshot.</div>}</div>
  <form action={addMetric} className="card stack"><h2>Add snapshot</h2><div className="form-grid two"><label className="field"><span>Platform</span><select className="input" name="platform"><option>spotify</option><option>apple_music</option><option>youtube</option><option>instagram</option><option>tiktok</option><option>facebook</option><option>x</option><option>email</option><option>revenue</option></select></label><label className="field"><span>Metric</span><input className="input" name="metric" placeholder="followers" required/></label></div><label className="field"><span>Value</span><input className="input" type="number" step="any" name="value" required/></label><label className="field"><span>Captured on</span><input className="input" type="date" name="capturedOn"/></label><label className="field"><span>Artist</span><select className="input" name="artistId"><option value="">Workspace</option>{(artists ?? []).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">All releases</option>{(releases ?? []).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label className="field"><span>Source URL</span><input className="input" name="sourceUrl"/></label><button className="button primary" type="submit">Save snapshot</button></form></section></main>;
}
