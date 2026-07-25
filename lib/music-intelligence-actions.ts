'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const text = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const number = (v: FormDataEntryValue | null) => v === null || v === '' ? null : Number(v);

export async function savePlatformProfile(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');
  const payload = {
    owner_id: user.id, platform_slug: text(form.get('platform_slug')), artist_name: text(form.get('artist_name')) || 'Middle Child',
    external_artist_id: text(form.get('external_artist_id')) || null, profile_url: text(form.get('profile_url')) || null,
    connection_mode: text(form.get('connection_mode')) || 'manual', connection_status: text(form.get('connection_status')) || 'needs_connection',
    verified_at: text(form.get('verified_at')) || null, notes: text(form.get('notes')) || null,
  };
  const { error } = await supabase.from('artist_platform_profiles').upsert(payload, { onConflict: 'owner_id,platform_slug' });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function saveReleaseLink(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');
  const payload = { owner_id: user.id, release_id: text(form.get('release_id')) || null, platform_slug: text(form.get('platform_slug')), release_url: text(form.get('release_url')) || null, track_url: text(form.get('track_url')) || null, external_release_id: text(form.get('external_release_id')) || null, external_track_id: text(form.get('external_track_id')) || null, status: text(form.get('status')) || 'unknown', verified_at: text(form.get('verified_at')) || null };
  const { error } = await supabase.from('release_platform_links').upsert(payload, { onConflict: 'owner_id,release_id,platform_slug' });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function recordMusicMetric(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');
  const { error } = await supabase.from('music_metric_snapshots').insert({ owner_id: user.id, release_id: text(form.get('release_id')) || null, platform_slug: text(form.get('platform_slug')), metric_date: text(form.get('metric_date')) || new Date().toISOString().slice(0,10), source_type: text(form.get('source_type')) || 'manual', streams: number(form.get('streams')), views: number(form.get('views')), followers: number(form.get('followers')), monthly_listeners: number(form.get('monthly_listeners')), saves: number(form.get('saves')), playlist_adds: number(form.get('playlist_adds')), revenue_usd: number(form.get('revenue_usd')), evidence_url: text(form.get('evidence_url')) || null, notes: text(form.get('notes')) || null });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function recordCoverage(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');
  const { error } = await supabase.from('music_coverage_events').insert({ owner_id: user.id, release_id: text(form.get('release_id')) || null, event_type: text(form.get('event_type')), outlet_name: text(form.get('outlet_name')), platform_slug: text(form.get('platform_slug')) || null, title: text(form.get('title')) || null, url: text(form.get('url')) || null, occurred_at: text(form.get('occurred_at')) || new Date().toISOString(), audience_estimate: number(form.get('audience_estimate')), contact_name: text(form.get('contact_name')) || null, contact_email: text(form.get('contact_email')) || null, verification_status: text(form.get('verification_status')) || 'unverified', evidence_url: text(form.get('evidence_url')) || null, notes: text(form.get('notes')) || null });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}
