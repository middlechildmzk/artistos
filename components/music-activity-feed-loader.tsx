import { MusicActivityFeed } from "@/components/music-activity-feed";
import { buildMusicActivityFeed } from "@/lib/music-activity/feed";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function MusicActivityFeedLoader() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const workspaceId = membership.workspace_id;
  const [releasesResult, smartLinksResult, eventsResult, metricsResult, placementsResult, evidenceResult] = await Promise.all([
    supabase
      .from("releases")
      .select("id,artist_id,title,featured_artist,isrc,spotify_url")
      .eq("workspace_id", workspaceId),
    supabase
      .from("smart_links")
      .select("id,release_id,slug")
      .eq("workspace_id", workspaceId),
    supabase
      .from("link_events")
      .select("id,smart_link_id,event_type,destination_service,utm_source,utm_medium,utm_campaign,referrer,country_code,occurred_at")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(250),
    supabase
      .from("metric_snapshots")
      .select("id,artist_id,release_id,platform,metric,value,captured_on,source_url")
      .eq("workspace_id", workspaceId)
      .order("captured_on", { ascending: false })
      .limit(1000),
    supabase
      .from("playlist_placements")
      .select("id,release_id,playlist_name,playlist_url,external_playlist_id,followers,track_position,added_at,removed_at,last_activity_at,source_type,confidence,verification_state,last_verified_at")
      .eq("workspace_id", workspaceId)
      .order("last_activity_at", { ascending: false })
      .limit(250),
    supabase
      .from("evidence_records")
      .select("id,artist_id,release_id,evidence_type,source_type,verification_status,verification_method,confidence,confidence_score,observed_at,summary,source_uri,metadata")
      .eq("workspace_id", workspaceId)
      .order("observed_at", { ascending: false })
      .limit(250),
  ]);

  const queryError = releasesResult.error
    ?? smartLinksResult.error
    ?? eventsResult.error
    ?? metricsResult.error
    ?? placementsResult.error
    ?? evidenceResult.error;

  if (queryError) {
    return (
      <div className="shell">
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading"><div><div className="eyebrow">Unified observation stream</div><h2>Music activity</h2></div><span className="pill blocked">Source read failed</span></div>
          <p className="muted">ArtistOS could not assemble the activity timeline. Existing Insights data remains available, and the failed read is not presented as an empty result.</p>
        </section>
      </div>
    );
  }

  const items = buildMusicActivityFeed({
    releases: releasesResult.data ?? [],
    smartLinks: smartLinksResult.data ?? [],
    linkEvents: eventsResult.data ?? [],
    metrics: metricsResult.data ?? [],
    placements: placementsResult.data ?? [],
    evidence: evidenceResult.data ?? [],
  });

  return <div className="shell"><MusicActivityFeed items={items} /></div>;
}
