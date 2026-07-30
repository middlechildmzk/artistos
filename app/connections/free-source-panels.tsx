import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";
import {
  connectFreeApiProvider,
  saveExternalArtistIdentity,
  syncLastFm,
  syncListenBrainz,
  syncTicketmaster,
} from "./actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function FreeSourcePanels() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership) return null;

  const [connectionsResult, artistsResult, identitiesResult, metricsResult] = await Promise.all([
    supabase.from("oauth_connections").select("provider,last_success_at,last_error,metadata,encrypted_access_token").eq("workspace_id", membership.workspace_id).eq("user_id", auth.user.id).in("provider", ["lastfm", "ticketmaster"]),
    supabase.from("artists").select("id,name").eq("workspace_id", membership.workspace_id).order("name"),
    supabase.from("artist_external_identities").select("id,artist_id,provider,external_id,display_name,profile_url,verification_status,confidence,contradiction_state,last_verified_at").eq("workspace_id", membership.workspace_id).order("updated_at", { ascending: false }),
    supabase.from("metric_snapshots").select("platform,captured_on").eq("workspace_id", membership.workspace_id).in("platform", ["lastfm", "listenbrainz", "ticketmaster"]).order("captured_on", { ascending: false }).limit(1000),
  ]);

  const connections = connectionsResult.data ?? [];
  const artists = artistsResult.data ?? [];
  const identities = identitiesResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const lastFm = connections.find((connection) => connection.provider === "lastfm") ?? null;
  const ticketmaster = connections.find((connection) => connection.provider === "ticketmaster") ?? null;
  const lastFmConnected = isCurrentTokenEnvelope(lastFm?.encrypted_access_token);
  const ticketmasterConnected = isCurrentTokenEnvelope(ticketmaster?.encrypted_access_token);
  const encryptionConfigured = Boolean(process.env.ARTISTOS_TOKEN_ENCRYPTION_KEY);
  const identitySchemaReady = !identitiesResult.error;
  const identitiesByArtist = new Map<string, typeof identities>();
  for (const identity of identities) {
    const list = identitiesByArtist.get(identity.artist_id) ?? [];
    list.push(identity);
    identitiesByArtist.set(identity.artist_id, list);
  }
  const metricCount = (platform: string) => metrics.filter((metric) => metric.platform === platform).length;
  const latestMetric = (platform: string) => metrics.find((metric) => metric.platform === platform)?.captured_on ?? "None";

  return (
    <>
      <section className="card stack" style={{ marginBottom: 16 }}>
        <div className="section-heading">
          <div>
            <div className="eyebrow">Identity safety layer</div>
            <h2>Confirmed external artist identities</h2>
            <p className="muted">Free APIs must use an exact MusicBrainz ID, Last.fm artist identity, or Ticketmaster attraction ID. ArtistOS never matches the name “Middle Child” automatically.</p>
          </div>
          <span className={`pill ${identitySchemaReady ? "" : "blocked"}`}>{identitySchemaReady ? `${identities.length} identities` : "Migration pending"}</span>
        </div>
        {!identitySchemaReady ? <div className="notice"><strong>Identity schema is not active yet.</strong><p className="muted">The reviewed database migration must be applied before free-source identities can be saved.</p></div> : null}
        {artists.map((artist) => {
          const artistIdentities = identitiesByArtist.get(artist.id) ?? [];
          return (
            <div className="row" key={artist.id}>
              <div>
                <strong>{artist.name}</strong>
                <div className="tag-row" style={{ marginTop: 8 }}>
                  {artistIdentities.length ? artistIdentities.map((identity) => <span className="pill" key={identity.id}>{identity.provider}: {identity.external_id}</span>) : <span className="pill blocked">No free-source identities</span>}
                </div>
              </div>
              <span className="muted">{artistIdentities.filter((identity) => identity.verification_status === "verified").length} verified</span>
            </div>
          );
        })}
        {identitySchemaReady ? (
          <form action={saveExternalArtistIdentity} className="grid two-col">
            <label className="field"><span>Artist</span><select className="input" name="artistId" required><option value="">Choose artist</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
            <label className="field"><span>Provider</span><select className="input" name="provider" required><option value="musicbrainz">MusicBrainz artist ID</option><option value="lastfm">Last.fm artist name</option><option value="ticketmaster">Ticketmaster attraction ID</option><option value="listenbrainz">ListenBrainz artist ID</option></select></label>
            <label className="field"><span>External ID or exact name</span><input className="input" name="externalId" placeholder="UUID, attraction ID, or exact Last.fm name" required /></label>
            <label className="field"><span>Provider profile URL</span><input className="input" type="url" name="profileUrl" placeholder="https://..." /></label>
            <label className="field"><span>Provider display name</span><input className="input" name="displayName" placeholder="Optional confirmation label" /></label>
            <div className="field"><span>&nbsp;</span><button className="button primary" type="submit">Save confirmed identity</button></div>
          </form>
        ) : null}
      </section>

      <section className="grid two-col" style={{ marginBottom: 16 }}>
        <section className="card stack">
          <div className="section-heading"><div><div className="eyebrow">Free public popularity</div><h2>Last.fm</h2><p className="muted">Listeners, playcounts, top tracks, and similar-artist signals.</p></div><span className={`pill ${lastFmConnected ? "" : "blocked"}`}>{lastFmConnected ? "Connected" : "API key required"}</span></div>
          <div className="row"><span>Last successful sync</span><strong>{formatDate(lastFm?.last_success_at)}</strong></div>
          <div className="row"><span>Stored snapshots</span><strong>{metricCount("lastfm")}</strong></div>
          <div className="row"><span>Latest data</span><strong>{latestMetric("lastfm")}</strong></div>
          {lastFm?.last_error ? <div className="notice"><strong>Last error</strong><p className="muted">{lastFm.last_error}</p></div> : null}
          {!encryptionConfigured ? <div className="notice"><strong>Encryption key required first.</strong><p className="muted">Set ARTISTOS_TOKEN_ENCRYPTION_KEY before saving any provider credential.</p></div> : null}
          {!lastFmConnected ? (
            <form action={connectFreeApiProvider} className="stack">
              <input type="hidden" name="provider" value="lastfm" />
              <label className="field"><span>Last.fm API key</span><input className="input" type="password" name="apiKey" autoComplete="off" required disabled={!encryptionConfigured} /></label>
              <label className="field"><span>Account label</span><input className="input" name="accountLabel" placeholder="Middle Child public discovery" disabled={!encryptionConfigured} /></label>
              <button className="button primary" type="submit" disabled={!encryptionConfigured}>Validate and save Last.fm</button>
            </form>
          ) : (
            <form action={syncLastFm} className="stack">
              <label className="field"><span>Artist to sync</span><select className="input" name="artistId" required><option value="">Choose confirmed artist</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
              <button className="button primary" type="submit">Sync Last.fm now</button>
            </form>
          )}
          <p className="muted">Last.fm is a public discovery signal, not a replacement for Spotify for Artists or royalty reporting.</p>
        </section>

        <section className="card stack">
          <div className="section-heading"><div><div className="eyebrow">Open listening signal</div><h2>ListenBrainz</h2><p className="muted">Total listens, unique listeners, and top recordings from the confirmed MusicBrainz artist ID.</p></div><span className="pill">No API key</span></div>
          <div className="row"><span>Stored snapshots</span><strong>{metricCount("listenbrainz")}</strong></div>
          <div className="row"><span>Latest data</span><strong>{latestMetric("listenbrainz")}</strong></div>
          <form action={syncListenBrainz} className="stack">
            <label className="field"><span>Artist to sync</span><select className="input" name="artistId" required><option value="">Choose artist with a MusicBrainz ID</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
            <button className="button primary" type="submit" disabled={!identitySchemaReady}>Sync ListenBrainz now</button>
          </form>
          <p className="muted">Coverage reflects listens submitted to ListenBrainz and is labeled as directional open-data intelligence.</p>
        </section>
      </section>

      <section className="card stack" style={{ marginBottom: 16 }}>
        <div className="section-heading"><div><div className="eyebrow">Live-event intelligence</div><h2>Ticketmaster Discovery</h2><p className="muted">Upcoming events, venues, markets, dates, and ticket links for a confirmed attraction ID.</p></div><span className={`pill ${ticketmasterConnected ? "" : "blocked"}`}>{ticketmasterConnected ? "Connected" : "Developer key required"}</span></div>
        <div className="grid stats">
          <div className="card"><div className="eyebrow">Last successful sync</div><strong>{formatDate(ticketmaster?.last_success_at)}</strong></div>
          <div className="card"><div className="eyebrow">Stored snapshots</div><div className="stat-value compact">{metricCount("ticketmaster")}</div></div>
          <div className="card"><div className="eyebrow">Latest data</div><strong>{latestMetric("ticketmaster")}</strong></div>
        </div>
        {ticketmaster?.last_error ? <div className="notice"><strong>Last error</strong><p className="muted">{ticketmaster.last_error}</p></div> : null}
        {!ticketmasterConnected ? (
          <form action={connectFreeApiProvider} className="grid two-col">
            <input type="hidden" name="provider" value="ticketmaster" />
            <label className="field"><span>Ticketmaster consumer key</span><input className="input" type="password" name="apiKey" autoComplete="off" required disabled={!encryptionConfigured} /></label>
            <label className="field"><span>Account label</span><input className="input" name="accountLabel" placeholder="ArtistOS event intelligence" disabled={!encryptionConfigured} /></label>
            <button className="button primary" type="submit" disabled={!encryptionConfigured}>Validate and save Ticketmaster</button>
          </form>
        ) : (
          <form action={syncTicketmaster} className="grid two-col">
            <label className="field"><span>Artist to sync</span><select className="input" name="artistId" required><option value="">Choose artist with attraction ID</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
            <div className="field"><span>&nbsp;</span><button className="button primary" type="submit">Sync Ticketmaster now</button></div>
          </form>
        )}
      </section>
    </>
  );
}
