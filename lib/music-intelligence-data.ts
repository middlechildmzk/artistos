import { createClient } from '@/lib/supabase/server';

export async function getMusicIntelligence() {
  const supabase = await createClient();
  const [platforms, profiles, links, metrics, coverage, placements, releases] = await Promise.all([
    supabase.from('music_platforms').select('*').order('priority').order('name'),
    supabase.from('artist_platform_profiles').select('*').order('updated_at', { ascending: false }),
    supabase.from('release_platform_links').select('*').order('updated_at', { ascending: false }),
    supabase.from('music_metric_snapshots').select('*').order('metric_date', { ascending: false }).limit(250),
    supabase.from('music_coverage_events').select('*').order('occurred_at', { ascending: false }).limit(150),
    supabase.from('playlist_placements').select('*').order('first_seen_at', { ascending: false }).limit(150),
    supabase.from('releases').select('id,title,release_date,status,upc').order('release_date', { ascending: false }),
  ]);
  const errors = [platforms.error, profiles.error, links.error, metrics.error, coverage.error, placements.error].filter(Boolean);
  const migrationRequired = errors.some((e) => e?.code === '42P01');
  const release = (releases.data ?? []).find((r) => r.title === 'Never Alone') ?? releases.data?.[0] ?? null;
  const latestByPlatform = new Map<string, any>();
  for (const row of metrics.data ?? []) if (!latestByPlatform.has(row.platform_slug)) latestByPlatform.set(row.platform_slug, row);
  const totals = (metrics.data ?? []).reduce((a: any, r: any) => ({
    streams: a.streams + Number(r.streams ?? 0), views: a.views + Number(r.views ?? 0),
    followers: Math.max(a.followers, Number(r.followers ?? 0)), revenue: a.revenue + Number(r.revenue_usd ?? 0),
  }), { streams: 0, views: 0, followers: 0, revenue: 0 });
  return { platforms: platforms.data ?? [], profiles: profiles.data ?? [], links: links.data ?? [], metrics: metrics.data ?? [], coverage: coverage.data ?? [], placements: placements.data ?? [], release, latestByPlatform, totals, migrationRequired, error: migrationRequired ? null : errors[0]?.message ?? null };
}
