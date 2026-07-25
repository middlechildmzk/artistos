import { createClient } from '@/lib/supabase/server';
import type { Row } from '@/lib/data';

export const NEVER_ALONE_PRESAVE_URL = 'https://distrokid.com/hyperfollow/middlechild7/never-alone-feat-low-sunday/';

export async function getSocialWorkspace() {
  const supabase = await createClient();
  const [{ data: releases }, { data: items, error }, { data: assets }, { data: metrics }] = await Promise.all([
    supabase.from('releases').select('id,title,featured_artist,release_date,status').order('release_date', { ascending: false }),
    supabase.from('content_items').select('*').order('scheduled_for', { ascending: true, nullsFirst: false }).limit(150),
    supabase.from('assets').select('id,name,asset_type,status,url').order('created_at', { ascending: false }).limit(80),
    supabase.from('campaign_metrics').select('*').order('metric_date', { ascending: false }).limit(30),
  ]);

  const release = (releases ?? []).find((row: Row) => row.title === 'Never Alone') ?? releases?.[0] ?? null;
  const allItems = items ?? [];
  const counts = {
    ideas: allItems.filter((row: Row) => row.status === 'idea').length,
    ready: allItems.filter((row: Row) => row.status === 'ready').length,
    scheduled: allItems.filter((row: Row) => row.status === 'scheduled').length,
    published: allItems.filter((row: Row) => row.status === 'published').length,
  };

  return {
    release,
    items: allItems,
    assets: assets ?? [],
    metrics: metrics ?? [],
    counts,
    migrationRequired: error?.code === '42703' || error?.code === '42P01' || Boolean(error?.message?.includes('campaign_metrics')),
    error: error?.message ?? null,
  };
}
