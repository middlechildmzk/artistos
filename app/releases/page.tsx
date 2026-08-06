import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addReleaseAsset, createRelease, createReleaseCampaign, updateRelease } from "./actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "No date set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function ReleasesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [{ data: artists }, { data: releases }, { data: tasks }, { data: assets }, { data: campaigns }, { data: smartLinks }] = await Promise.all([
    supabase.from("artists").select("id, name, aliases").eq("workspace_id", workspaceId).order("name"),
    supabase.from("releases").select("*").eq("workspace_id", workspaceId).order("release_date", { ascending: false }),
    supabase.from("tasks").select("id, release_id, status, blocked_by, blocker_cleared").eq("workspace_id", workspaceId),
    supabase.from("assets").select("id, release_id, name, asset_type, url, location_note, status").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, release_id, name, status, start_date, end_date").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("smart_links").select("id,release_id,slug,mode,is_active,updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
  ]);

  const artistRows = artists ?? [];
  const releaseRows = releases ?? [];
  const taskRows = tasks ?? [];
  const assetRows = assets ?? [];
  const campaignRows = campaigns ?? [];
  const smartLinkRows = smartLinks ?? [];
  const artistById = new Map(artistRows.map((artist) => [artist.id, artist]));

  return <>
    <AppHeader active="releases" />
    <main className="shell">
    <header className="app-page-heading">
      <div><div className="eyebrow">Everything belonging to the music</div><h1>Releases</h1><p>Keep metadata, assets, music links, creator work and campaign launch readiness together for every release.</p></div>
      <nav className="section-tabs" aria-label="Release tools"><Link className="active" href="/releases">Releases</Link><Link href="/links">Music links</Link><Link href="/studio">Creator tools</Link></nav>
    </header>

    <section className="card" style={{ marginBottom: 16 }}>
      <div className="section-heading"><div><h2>Create release</h2><p className="muted">Start with metadata and ArtistOS will generate the operational spine automatically.</p></div><span className="pill">5 starter tasks included</span></div>
      <form action={createRelease} className="form-grid">
        <label className="field"><span>Artist</span><select className="input" name="artistId" required defaultValue=""><option value="" disabled>Select artist</option>{artistRows.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
        <label className="field"><span>Title</span><input className="input" name="title" required /></label>
        <label className="field"><span>Featured artist</span><input className="input" name="featuredArtist" /></label>
        <label className="field"><span>Release date</span><input className="input" name="releaseDate" type="date" /></label>
        <label className="field"><span>Distributor</span><input className="input" name="distributor" /></label>
        <label className="field"><span>Label</span><input className="input" name="label" /></label>
        <button className="button primary" type="submit">Create release workspace</button>
      </form>
    </section>

    <section className="stack">
      {releaseRows.length ? releaseRows.map((release) => {
        const releaseTasks = taskRows.filter((task) => task.release_id === release.id);
        const releaseAssets = assetRows.filter((asset) => asset.release_id === release.id);
        const releaseCampaigns = campaignRows.filter((campaign) => campaign.release_id === release.id);
        const releaseSmartLink = smartLinkRows.find((link) => link.release_id === release.id);
        const completed = releaseTasks.filter((task) => task.status === "done").length;
        const blocked = releaseTasks.filter((task) => task.blocked_by && !task.blocker_cleared && task.status !== "done").length;
        const readiness = releaseTasks.length ? Math.round((completed / releaseTasks.length) * 100) : 0;
        const artist = artistById.get(release.artist_id);
        return <article className="card" key={release.id}>
          <div className="section-heading release-heading">
            <div><div className="eyebrow">{artist?.name || "Artist"}</div><h2>{release.title}{release.featured_artist ? ` feat. ${release.featured_artist}` : ""}</h2><p className="muted">{formatDate(release.release_date)} · {release.status}</p></div>
            <div className="tag-row"><span className="pill">{readiness}% ready</span><span className={`pill ${blocked ? "blocked" : ""}`}>{blocked} blocked</span><span className="pill">{releaseAssets.length} assets</span><span className="pill">{releaseCampaigns.length} campaigns</span></div>
          </div>
          <div className="progress"><span style={{ width: `${readiness}%` }} /></div>

          <div className="release-tools-strip">
            <div><span>Music link</span><strong>{releaseSmartLink ? "/" + releaseSmartLink.slug : "Not created"}</strong><Link href={"/links#release-" + release.id}>{releaseSmartLink ? "Manage link" : "Create free link"} →</Link></div>
            <div><span>Creator tools</span><strong>Ideas, hooks and publishing</strong><Link href={"/studio?releaseId=" + release.id}>Open creator tools →</Link></div>
            <div><span>Campaign</span><strong>{releaseCampaigns[0]?.name ?? "No active campaign"}</strong><Link href="/campaigns">{releaseCampaigns.length ? "Open campaign" : "Start campaign"} →</Link></div>
          </div>

          <div className="grid two-col release-panels">
            <details open>
              <summary>Metadata</summary>
              <form action={updateRelease} className="form-grid mini-form">
                <input type="hidden" name="releaseId" value={release.id} />
                <label className="field"><span>Title</span><input className="input" name="title" defaultValue={release.title} required /></label>
                <label className="field"><span>Featured artist</span><input className="input" name="featuredArtist" defaultValue={release.featured_artist ?? ""} /></label>
                <label className="field"><span>Release date</span><input className="input" name="releaseDate" type="date" defaultValue={release.release_date ?? ""} /></label>
                <label className="field"><span>Status</span><select className="input" name="status" defaultValue={release.status}><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="released">Released</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
                <label className="field"><span>Distributor</span><input className="input" name="distributor" defaultValue={release.distributor ?? ""} /></label>
                <label className="field"><span>Label</span><input className="input" name="label" defaultValue={release.label ?? ""} /></label>
                <label className="field"><span>ISRC</span><input className="input" name="isrc" defaultValue={release.isrc ?? ""} /></label>
                <label className="field"><span>UPC</span><input className="input" name="upc" defaultValue={release.upc ?? ""} /></label>
                <label className="field full"><span>Spotify URL</span><input className="input" name="spotifyUrl" type="url" defaultValue={release.spotify_url ?? ""} /></label>
                <label className="field full"><span>Notes</span><textarea className="input textarea" name="notes" defaultValue={release.notes ?? ""} /></label>
                <button className="button" type="submit">Save metadata</button>
              </form>
            </details>

            <div className="stack">
              <details open><summary>Assets</summary>
                <div className="stack mini-form">{releaseAssets.length ? releaseAssets.map((asset) => <div className="row" key={asset.id}><div><strong>{asset.name}</strong><p className="muted">{asset.asset_type} · {asset.status}</p></div>{asset.url ? <a className="button ghost" href={asset.url} target="_blank" rel="noreferrer">Open</a> : null}</div>) : <div className="empty">No assets logged.</div>}</div>
                <form action={addReleaseAsset} className="stack mini-form"><input type="hidden" name="releaseId" value={release.id} /><input className="input" name="name" placeholder="Asset name" required /><div className="form-grid"><select className="input" name="assetType" defaultValue="artwork"><option value="artwork">Artwork</option><option value="master">Master audio</option><option value="instrumental">Instrumental</option><option value="stems">Stems</option><option value="video">Video</option><option value="canvas">Canvas</option><option value="press">Press asset</option><option value="other">Other</option></select><select className="input" name="status" defaultValue="ready"><option value="draft">Draft</option><option value="ready">Ready</option><option value="approved">Approved</option><option value="blocked">Blocked</option></select></div><input className="input" name="url" type="url" placeholder="Asset URL" /><input className="input" name="locationNote" placeholder="Drive folder, filename, or location note" /><button className="button" type="submit">Add asset</button></form>
              </details>
              <details open><summary>Campaigns</summary>
                <div className="stack mini-form">{releaseCampaigns.length ? releaseCampaigns.map((campaign) => <div className="row" key={campaign.id}><div><strong>{campaign.name}</strong><p className="muted">{campaign.status} · {formatDate(campaign.start_date)}</p></div><Link className="button ghost" href="/campaigns">Open</Link></div>) : <div className="empty">No campaign yet.</div>}</div>
                <form action={createReleaseCampaign} className="stack mini-form"><input type="hidden" name="releaseId" value={release.id} /><input className="input" name="name" placeholder={`${release.title} campaign`} required /><div className="form-grid"><input className="input" name="startDate" type="date" /><input className="input" name="endDate" type="date" /></div><textarea className="input textarea" name="goals" placeholder="Campaign goals, target audience, and success criteria" /><button className="button primary" type="submit">Create campaign</button></form>
              </details>
            </div>
          </div>
        </article>;
      }) : <section className="card"><h2>No releases yet</h2><p className="muted">Create the first release workspace above.</p></section>}
    </section>
    </main>
  </>;
}
