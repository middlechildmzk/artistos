import { createClient } from '@/lib/supabase/server';

export async function getMusicIntelligence() {
  const supabase = await createClient();
  const [platforms, profiles, links, metrics, coverage, placements, releases] = await Promise.all([
    supabase.from('music_platforms').select('*').order('priority').order('name'),
    supabase.from('artist_platform_profiles').select('*,music_platforms(slug,name)').order('updated_at', { ascending: false }),
    supabase.from('release_platform_links').select('*,music_platforms(slug,name)').order('updated_at', { ascending: false }),
    supabase.from('music_metric_snapshots').select('*,music_platforms(slug,name)').order('metric_date', { ascending: false }).limit(250),
    supabase.from('music_coverage_events').select('*,music_platforms(slug,name)').order('occurred_at', { ascending: false }).limit(150),
    supabase.from('playlist_placements').select('*,music_platforms(slug,name)').order('added_at', { ascending: false, nullsFirst: false }).limit(150),
    supabase.from('releases').select('id,title,release_date,status,upc').order('release_date', { ascending: false }),
  ]);
  const errors = [platforms.error, profiles.error, links.error, metrics.error, coverage.error, placements.error].filter(Boolean);
  const migrationRequired = errors.some((e) => e?.code === '42P01');
  const release = (releases.data ?? []).find((r) => r.title === 'Never Alone') ?? releases.data?.[0] ?? null;
  const totals = (metrics.data ?? []).reduce((a: any, row: any) => {
    const m = row.metrics ?? {};
    return { streams: a.streams + Number(m.streams ?? 0), views: a.views + Number(m.views ?? 0), followers: Math.max(a.followers, Number(m.followers ?? 0)), revenue: a.revenue + Number(m.revenue_usd ?? 0) };
  }, { streams: 0, views: 0, followers: 0, revenue: 0 });
  return { platforms: platforms.data ?? [], profiles: profiles.data ?? [], links: links.data ?? [], metrics: metrics.data ?? [], coverage: coverage.data ?? [], placements: placements.data ?? [], release, releases: releases.data ?? [], totals, migrationRequired, error: migrationRequired ? null : errors[0]?.message ?? null };
}
