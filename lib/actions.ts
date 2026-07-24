"use server";

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const RELATIONSHIP_STAGES = new Set(['identified','qualified','pitched','replied','negotiating','placed','declined','dormant']);

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function requestOrigin(requestHeaders: Headers) {
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  return process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : 'http://localhost:3000');
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = value(formData, 'email');
  const password = value(formData, 'password');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/');
}

export async function sendMagicLink(formData: FormData) {
  const supabase = await createClient();
  const email = value(formData, 'email');
  const origin = requestOrigin(await headers());
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/login?message=Check%20your%20email%20for%20the%20secure%20sign-in%20link.');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function toggleTask(formData: FormData) {
  const supabase = await createClient();
  const id = value(formData, 'id');
  const current = value(formData, 'current');
  const next = current === 'done' ? 'open' : 'done';
  const { error } = await supabase.from('tasks').update({
    status: next,
    completed_at: next === 'done' ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
  revalidatePath('/releases');
}

export async function updateRelationshipStage(formData: FormData) {
  const supabase = await createClient();
  const table = value(formData, 'table');
  const id = value(formData, 'id');
  const stage = value(formData, 'stage');
  if (!['properties', 'people', 'organizations'].includes(table)) throw new Error('Unsupported entity type.');
  if (!RELATIONSHIP_STAGES.has(stage)) throw new Error('Unsupported relationship stage.');
  const { error } = await supabase.from(table).update({ relationship_stage: stage }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/playlists');
  revalidatePath('/industry');
}

export async function logInteraction(formData: FormData) {
  const supabase = await createClient();
  const propertyId = value(formData, 'property_id') || null;
  const personId = value(formData, 'person_id') || null;
  const organizationId = value(formData, 'organization_id') || null;
  const subject = value(formData, 'subject');
  const body = value(formData, 'body');
  const channel = value(formData, 'channel') || 'email';
  const followUp = value(formData, 'follow_up_due') || null;
  const { error } = await supabase.from('interactions').insert({
    property_id: propertyId,
    person_id: personId,
    organization_id: organizationId,
    direction: 'outbound',
    channel,
    subject,
    body,
    follow_up_due: followUp,
    notes: 'Logged manually in ArtistOS. No automatic send occurred.',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/outreach');
  revalidatePath('/');
}
