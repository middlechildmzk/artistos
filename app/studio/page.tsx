import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addContentIdea, updateContentStatus } from "../intelligence/actions";

export default async function StudioPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;
  const [{ data: ideas }, { data: artists }, { data: releases }] = await Promise.all([
    supabase.from("content_ideas").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("artists").select("id,name").eq("workspace_id", workspaceId).order("name"),
    supabase.from("releases").select("id,title").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
  ]);
  const columns = ["idea","drafting","ready","scheduled","published"];
  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">Creator operating system</div><h1>Creator Studio</h1><p className="muted">Turn release strategy into platform-ready hooks, concepts, captions, and a publish queue.</p></div><nav className="nav-links"><Link className="button ghost" href="/command-center">Command</Link><Link className="button ghost" href="/releases">Releases</Link><Link className="button ghost" href="/analytics">Analytics</Link></nav></header>
    <section className="grid two-col" style={{marginBottom:16}}>
      <form action={addContentIdea} className="card stack"><h2>Create content card</h2><div className="form-grid two"><label className="field"><span>Platform</span><select className="input" name="platform"><option>instagram</option><option>tiktok</option><option>youtube</option><option>facebook</option><option>x</option><option>email</option></select></label><label className="field"><span>Format</span><select className="input" name="format"><option>reel</option><option>short</option><option>post</option><option>story</option><option>email</option><option>canvas</option></select></label></div><label className="field"><span>Hook</span><input className="input" name="hook" required placeholder="I thought I was invisible..."/></label><label className="field"><span>Concept</span><textarea className="input textarea" name="concept" placeholder="Visual arc, scene, edit rhythm, CTA"/></label><label className="field"><span>Caption</span><textarea className="input textarea" name="caption"/></label><div className="form-grid two"><label className="field"><span>Artist</span><select className="input" name="artistId"><option value="">No artist</option>{(artists ?? []).map((artist)=><option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label><label className="field"><span>Release</span><select className="input" name="releaseId"><option value="">No release</option>{(releases ?? []).map((release)=><option key={release.id} value={release.id}>{release.title}</option>)}</select></label></div><label className="field"><span>Schedule</span><input className="input" type="datetime-local" name="scheduledFor"/></label><button className="button primary" type="submit">Add to studio</button></form>
      <div className="card"><h2>Release content engine</h2><p className="muted">Use one card per publishable idea. Move it from idea to published while preserving the hook, creative concept, caption, platform, and release relationship.</p><div className="grid stats"><div><div className="eyebrow">Ideas</div><div className="stat-value">{(ideas ?? []).filter(i=>i.status==='idea').length}</div></div><div><div className="eyebrow">Ready</div><div className="stat-value">{(ideas ?? []).filter(i=>i.status==='ready').length}</div></div><div><div className="eyebrow">Scheduled</div><div className="stat-value">{(ideas ?? []).filter(i=>i.status==='scheduled').length}</div></div><div><div className="eyebrow">Published</div><div className="stat-value">{(ideas ?? []).filter(i=>i.status==='published').length}</div></div></div></div>
    </section>
    <section className="pipeline-grid">{columns.map((status)=><div className="pipeline-column" key={status}><div className="section-heading tight"><strong>{status}</strong><span className="pill">{(ideas ?? []).filter(i=>i.status===status).length}</span></div>{(ideas ?? []).filter(i=>i.status===status).map((idea)=><article className="pipeline-card" key={idea.id}><div className="tag-row"><span className="pill">{idea.platform}</span><span className="pill">{idea.format}</span></div><strong>{idea.hook}</strong>{idea.concept ? <span className="muted">{idea.concept}</span> : null}<form action={updateContentStatus}><input type="hidden" name="id" value={idea.id}/><select className="input" name="status" defaultValue={idea.status}>{columns.map(column=><option key={column}>{column}</option>)}</select><button className="button" type="submit">Move</button></form></article>)}</div>)}</section>
  </main>;
}
