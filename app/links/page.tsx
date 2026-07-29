import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSmartLink, saveSmartLinkDestination } from "./actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "No release date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function suggestedSlug(artist: string, title: string) {
  return `${artist}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function LinksPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const workspaceId = membership.workspace_id;
  const [{ data: releases }, { data: smartLinks }, { data: destinations }, { data: events }, { data: attributedFans }] = await Promise.all([
    supabase
      .from("releases")
      .select("id,title,featured_artist,release_date,status,artists(name)")
      .eq("workspace_id", workspaceId)
      .order("release_date", { ascending: false }),
    supabase
      .from("smart_links")
      .select("id,release_id,slug,mode,headline,description,capture_email,is_active,consent_copy_version,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("smart_link_destinations")
      .select("id,smart_link_id,service,url,position,is_active")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    supabase
      .from("link_events")
      .select("id,smart_link_id,event_type,destination_service,occurred_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("fans")
      .select("id,source_smart_link_id")
      .eq("workspace_id", workspaceId)
      .not("source_smart_link_id", "is", null),
  ]);

  const releaseRows = releases ?? [];
  const linkRows = smartLinks ?? [];
  const destinationRows = destinations ?? [];
  const eventRows = events ?? [];
  const fanRows = attributedFans ?? [];
  const activeLinks = linkRows.filter((item) => item.is_active).length;
  const views = eventRows.filter((event) => event.event_type === "page_view").length;
  const clicks = eventRows.filter((event) => event.event_type === "destination_click").length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Release to fan connection layer</div>
          <h1>ArtistOS Links</h1>
          <p className="muted">Create the canonical smart link for each release, manage streaming destinations, preserve consent, and connect every visit back to the release graph.</p>
        </div>
        <nav className="nav-links">
          <Link className="button ghost" href="/dashboard">Today</Link>
          <Link className="button ghost" href="/releases">Releases</Link>
          <Link className="button ghost" href="/campaigns">Campaign Intelligence</Link>
          <Link className="button ghost" href="/analytics">Music Intelligence</Link>
        </nav>
      </header>

      <section className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card"><div className="eyebrow">Release links</div><div className="stat-value">{linkRows.length}</div></div>
        <div className="card"><div className="eyebrow">Active</div><div className="stat-value">{activeLinks}</div></div>
        <div className="card"><div className="eyebrow">Tracked views / clicks</div><div className="stat-value compact">{views} / {clicks}</div></div>
        <div className="card"><div className="eyebrow">Attributed fans</div><div className="stat-value">{fanRows.length}</div></div>
      </section>

      <section className="card release-card" style={{ marginBottom: 16 }}>
        <div className="eyebrow">Connected product graph</div>
        <h2>Release → Link → Campaign → Proof → Fan → Intelligence</h2>
        <p className="muted">Links are not a standalone utility. Each one belongs to a release, carries campaign attribution, records privacy-minimized consent evidence, and becomes a measurable input for Artist Brain.</p>
        <div className="tag-row"><span className="pill">One link per release</span><span className="pill">Workspace protected</span><span className="pill">No fingerprint hashes</span><span className="pill">Human-controlled activation</span></div>
      </section>

      <section className="stack">
        {releaseRows.length ? releaseRows.map((release) => {
          const artistRelation = Array.isArray(release.artists) ? release.artists[0] : release.artists;
          const artistName = artistRelation?.name ?? "Artist";
          const smartLink = linkRows.find((item) => item.release_id === release.id);
          const releaseDestinations = smartLink ? destinationRows.filter((item) => item.smart_link_id === smartLink.id) : [];
          const releaseEvents = smartLink ? eventRows.filter((item) => item.smart_link_id === smartLink.id) : [];
          const releaseFans = smartLink ? fanRows.filter((item) => item.source_smart_link_id === smartLink.id) : [];
          const title = `${release.title}${release.featured_artist ? ` (feat. ${release.featured_artist})` : ""}`;

          return (
            <article className="card" key={release.id}>
              <div className="section-heading release-heading">
                <div>
                  <div className="eyebrow">{artistName} · {formatDate(release.release_date)}</div>
                  <h2>{title}</h2>
                  <p className="muted">{smartLink ? `/l/${smartLink.slug}` : "No ArtistOS link configured"}</p>
                </div>
                <div className="tag-row">
                  <span className="pill">{release.status}</span>
                  <span className="pill">{smartLink?.mode ?? "not configured"}</span>
                  <span className="pill">{releaseDestinations.length} destinations</span>
                  <span className="pill">{releaseEvents.length} events</span>
                  <span className="pill">{releaseFans.length} fans</span>
                </div>
              </div>

              <div className="grid two-col">
                <form action={saveSmartLink} className="stack">
                  <input type="hidden" name="releaseId" value={release.id} />
                  <div className="form-grid two">
                    <label className="field"><span>Public slug</span><input className="input" name="slug" defaultValue={smartLink?.slug ?? suggestedSlug(artistName, release.title)} required /></label>
                    <label className="field"><span>Mode</span><select className="input" name="mode" defaultValue={smartLink?.mode ?? (release.status === "upcoming" ? "presave" : "live")}><option value="presave">Presave</option><option value="live">Live</option><option value="private">Private</option></select></label>
                    <label className="field full"><span>Headline</span><input className="input" name="headline" defaultValue={smartLink?.headline ?? `${artistName} · ${title}`} /></label>
                    <label className="field full"><span>Description</span><textarea className="input textarea" name="description" defaultValue={smartLink?.description ?? "Choose where to listen and get the next release update."} /></label>
                  </div>
                  <div className="tag-row">
                    <label className="pill"><input name="captureEmail" type="checkbox" defaultChecked={smartLink?.capture_email ?? true} /> Capture email</label>
                    <label className="pill"><input name="isActive" type="checkbox" defaultChecked={smartLink?.is_active ?? true} /> Active</label>
                    <span className="pill">Consent {smartLink?.consent_copy_version ?? "2026-07-v1"}</span>
                  </div>
                  <button className="button primary" type="submit">{smartLink ? "Save link settings" : "Create release link"}</button>
                </form>

                <div className="stack">
                  <div>
                    <div className="section-heading tight"><h3>Streaming destinations</h3><span className="pill">Manual control</span></div>
                    {releaseDestinations.length ? releaseDestinations.map((destination) => (
                      <div className="row" key={destination.id}>
                        <div><strong style={{ textTransform: "capitalize" }}>{destination.service}</strong><p className="muted">{destination.url}</p></div>
                        <span className="pill">{destination.is_active ? "active" : "hidden"}</span>
                      </div>
                    )) : <div className="empty small">No destinations saved yet.</div>}
                  </div>

                  {smartLink ? (
                    <details>
                      <summary>Add or update destination</summary>
                      <form action={saveSmartLinkDestination} className="stack mini-form">
                        <input type="hidden" name="smartLinkId" value={smartLink.id} />
                        <div className="form-grid two">
                          <label className="field"><span>Service</span><select className="input" name="service" defaultValue="spotify"><option value="spotify">Spotify</option><option value="apple_music">Apple Music</option><option value="youtube_music">YouTube Music</option><option value="soundcloud">SoundCloud</option><option value="bandcamp">Bandcamp</option><option value="hyperfollow">HyperFollow</option><option value="other">Other</option></select></label>
                          <label className="field"><span>Position</span><input className="input" name="position" type="number" min="0" max="100" defaultValue={releaseDestinations.length} /></label>
                          <label className="field full"><span>Destination URL</span><input className="input" name="url" type="url" placeholder="https://..." required /></label>
                        </div>
                        <label className="pill"><input name="isActive" type="checkbox" defaultChecked /> Active destination</label>
                        <button className="button" type="submit">Save destination</button>
                      </form>
                    </details>
                  ) : <p className="muted">Create the release link before adding destinations.</p>}
                </div>
              </div>
            </article>
          );
        }) : <section className="card"><h2>No releases yet</h2><p className="muted">Create a release workspace first, then ArtistOS will attach its smart link, campaigns, proof, fans, and analytics to that release.</p><Link className="button primary" href="/releases">Create release</Link></section>}
      </section>
    </main>
  );
}
