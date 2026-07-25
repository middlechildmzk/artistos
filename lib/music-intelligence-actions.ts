'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const text = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const numeric = (v: FormDataEntryValue | null) => v === null || v === '' ? null : Number(v);

async function context(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');
  const slug = text(form.get('platform_slug'));
  const { data: platform, error } = await supabase.from('music_platforms').select('id,slug').eq('slug', slug).single();
  if (error || !platform) throw new Error(`Unknown platform: ${slug}`);
  return { supabase, user, platform };
}

export async function savePlatformProfile(form: FormData) {
  const { supabase, user, platform } = await context(form);
  const artistName = text(form.get('artist_name')) || 'Middle Child';
  const payload = {
    owner_id: user.id, platform_id: platform.id, artist_name: artistName,
    external_artist_id: text(form.get('external_artist_id')) || null,
    profile_url: text(form.get('profile_url')) || null,
    connection_state: text(form.get('connection_state')) || 'unconnected',
    source_type: text(form.get('source_type')) || 'manual',
    last_verified_at: text(form.get('last_verified_at')) || null,
    freshness_status: text(form.get('freshness_status')) || 'unknown',
    metadata: { notes: text(form.get('notes')) || null },
  };
  const { error } = await supabase.from('artist_platform_profiles').upsert(payload, { onConflict: 'owner_id,platform_id,artist_name' });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function saveReleaseLink(form: FormData) {
  const { supabase, user, platform } = await context(form);
  const payload = {
    owner_id: user.id, release_id: text(form.get('release_id')) || null, platform_id: platform.id,
    release_url: text(form.get('release_url')) || null,
    external_release_id: text(form.get('external_release_id')) || null,
    external_track_id: text(form.get('external_track_id')) || null,
    release_status: text(form.get('release_status')) || 'unknown',
    source_type: text(form.get('source_type')) || 'manual',
    last_verified_at: text(form.get('last_verified_at')) || null,
    evidence_url: text(form.get('evidence_url')) || null,
  };
  const { error } = await supabase.from('release_platform_links').upsert(payload, { onConflict: 'owner_id,release_id,platform_id' });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function recordMusicMetric(form: FormData) {
  const { supabase, user, platform } = await context(form);
  const metrics = {
    streams: numeric(form.get('streams')), views: numeric(form.get('views')), followers: numeric(form.get('followers')),
    monthly_listeners: numeric(form.get('monthly_listeners')), saves: numeric(form.get('saves')),
    playlist_adds: numeric(form.get('playlist_adds')), revenue_usd: numeric(form.get('revenue_usd')),
  };
  const { error } = await supabase.from('music_metric_snapshots').upsert({
    owner_id: user.id, platform_id: platform.id, release_id: text(form.get('release_id')) || null,
    metric_date: text(form.get('metric_date')) || new Date().toISOString().slice(0,10), source_type: text(form.get('source_type')) || 'manual',
    source_reference: text(form.get('source_reference')) || null, metrics, confidence: numeric(form.get('confidence')),
  }, { onConflict: 'owner_id,platform_id,release_id,profile_id,metric_date,source_type' });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function recordCoverage(form: FormData) {
  const { supabase, user, platform } = await context(form);
  const { error } = await supabase.from('music_coverage_events').insert({
    owner_id: user.id, release_id: text(form.get('release_id')) || null, platform_id: platform.id,
    coverage_type: text(form.get('coverage_type')), outlet_name: text(form.get('outlet_name')), title: text(form.get('title')) || null,
    url: text(form.get('url')) || null, contact_name: text(form.get('contact_name')) || null,
    contact_method: text(form.get('contact_method')) || null, occurred_at: text(form.get('occurred_at')) || new Date().toISOString(),
    audience_estimate: numeric(form.get('audience_estimate')), source_type: text(form.get('source_type')) || 'public',
    confidence: numeric(form.get('confidence')), verification_state: text(form.get('verification_state')) || 'unverified',
    last_verified_at: text(form.get('last_verified_at')) || null, evidence: { url: text(form.get('evidence_url')) || null }, notes: text(form.get('notes')) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}
