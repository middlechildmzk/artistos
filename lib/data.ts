import { createClient } from '@/lib/supabase/server';

export type Row = Record<string, any>;

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const RELEASE_DATE = '2026-07-31';

function cleanSearch(input?: string) {
  return (input ?? '').replace(/[,%()]/g, ' ').trim().slice(0, 120);
}

function dateDistance(date?: string | null) {
  if (!date) return 999;
  const a = new Date(`${TODAY}T12:00:00Z`).getTime();
  const b = new Date(`${date}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function taskScore(task: Row) {
  const days = dateDistance(task.due_date);
  let score = task.classification === 'spine' ? 30 : 10;
  if (days < 0) score += 90;
  else if (days === 0) score += 80;
  else if (days <= 2) score += 55;
  else if (days <= 7) score += 25;
  if (task.blocked_by && !task.blocker_cleared) score -= 70;
  if (task.status === 'done') score = -999;
  return score - Number(task.sort_order ?? 100) / 1000;
}

export function propertyScore(property: Row) {
  let score = 25;
  const text = `${property.name ?? ''} ${property.genres ?? ''} ${(property.genre_tags ?? []).join(' ')} ${property.notes ?? ''}`.toLowerCase();
  const reasons: string[] = [];
  if (/future bass|melodic bass|melodic dubstep|electronic|chill|emotional/.test(text)) {
    score += 35; reasons.push('genre and mood language aligns');
  }
  if (property.verification_status === 'verified') { score += 20; reasons.push('verified record'); }
  if (property.relationship_stage && property.relationship_stage !== 'identified') { score += 12; reasons.push(`relationship is ${property.relationship_stage}`); }
  if (property.contact_emails) { score += 8; reasons.push('recorded contact route'); }
  if (property.url || property.platform_url) { score += 5; reasons.push('platform link recorded'); }
  if (property.activity_status === 'inactive') { score -= 30; reasons.push('activity marked inactive'); }
  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.length ? reasons : ['needs verification before outreach'] };
}

async function exactCount(table: string) {
  const supabase = await createClient();
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

export async function getTodayData() {
  const supabase = await createClient();
  const [fans, suppressions, people, properties, organizations, endpoints, outcomes, risks, signals] = await Promise.all([
    exactCount('contactable_fans'), exactCount('suppressions'), exactCount('people'), exactCount('properties'), exactCount('organizations'),
    exactCount('submission_endpoints'), exactCount('outcomes'), exactCount('risk_events'), exactCount('relationship_signals'),
  ]);
  const [{ data: releases }, { data: tasks }, { data: followUps }, { data: candidateProperties }] = await Promise.all([
    supabase.from('releases').select('*').order('release_date', { ascending: false }),
    supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('interactions').select('*').eq('follow_up_done', false).lte('follow_up_due', TODAY).order('follow_up_due'),
    supabase.from('properties').select('id,name,platform,genres,genre_tags,verification_status,relationship_stage,contact_emails,url,platform_url,activity_status,notes').limit(80),
  ]);
  const rankedTasks = (tasks ?? []).sort((a: Row, b: Row) => taskScore(b) - taskScore(a));
  const rankedProperties = (candidateProperties ?? []).map((property: Row) => ({ ...property, fit: propertyScore(property) })).sort((a: Row, b: Row) => b.fit.score - a.fit.score).slice(0, 6);
  const done = (tasks ?? []).filter((task: Row) => task.status === 'done').length;
  const open = (tasks ?? []).filter((task: Row) => task.status !== 'done').length;
  return {
    release: (releases ?? []).find((release: Row) => release.title === 'Never Alone') ?? releases?.[0] ?? null,
    tasks: rankedTasks,
    nextTask: rankedTasks.find((task: Row) => task.status !== 'done') ?? null,
    blockers: rankedTasks.filter((task: Row) => task.status !== 'done' && task.blocked_by && !task.blocker_cleared),
    followUps: followUps ?? [],
    rankedProperties,
    progress: { done, open, total: done + open },
    counts: {
      fans: fans.count, suppressions: suppressions.count, people: people.count, properties: properties.count,
      organizations: organizations.count, endpoints: endpoints.count, outcomes: outcomes.count, risks: risks.count, signals: signals.count,
    },
    releaseDate: RELEASE_DATE,
    today: TODAY,
  };
}

export async function getReleases() {
  const supabase = await createClient();
  const [{ data: releases, error }, { data: tasks }, { data: outcomes }] = await Promise.all([
    supabase.from('releases').select('*,artists(name,aliases,genre_tags)').order('release_date', { ascending: false }),
    supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('outcomes').select('*').order('outcome_date', { ascending: false }),
  ]);
  return { releases: releases ?? [], tasks: tasks ?? [], outcomes: outcomes ?? [], error: error?.message ?? null };
}

export async function getProperties(search?: string, stage?: string, id?: string) {
  const supabase = await createClient();
  if (id) {
    const { data: property, error } = await supabase.from('properties').select('*,organizations(*),people!properties_owner_person_id_fkey(*)').eq('id', id).maybeSingle();
    const [{ data: endpoints }, { data: interactions }, { data: outcomes }, { data: risks }] = await Promise.all([
      supabase.from('submission_endpoints').select('*').eq('property_id', id),
      supabase.from('interactions').select('*').eq('property_id', id).order('occurred_at', { ascending: false }),
      supabase.from('outcomes').select('*').eq('property_id', id).order('outcome_date', { ascending: false }),
      supabase.from('risk_events').select('*').eq('property_id', id),
    ]);
    return { rows: property ? [{ ...property, fit: propertyScore(property) }] : [], detail: { endpoints: endpoints ?? [], interactions: interactions ?? [], outcomes: outcomes ?? [], risks: risks ?? [] }, error: error?.message ?? null };
  }
  let query = supabase.from('properties').select('id,name,property_type,platform,url,platform_url,genres,genre_tags,followers_estimate,followers_legacy,owner_or_operator,contact_emails,verification_status,activity_status,relationship_stage,next_action,next_action_due,source,updated_at').order('updated_at', { ascending: false }).limit(60);
  const q = cleanSearch(search);
  if (q) query = query.or(`name.ilike.%${q}%,owner_or_operator.ilike.%${q}%,genres.ilike.%${q}%`);
  if (stage && stage !== 'all') query = query.eq('relationship_stage', stage);
  const { data, error } = await query;
  return { rows: (data ?? []).map((row: Row) => ({ ...row, fit: propertyScore(row) })).sort((a: Row, b: Row) => b.fit.score - a.fit.score), detail: null, error: error?.message ?? null };
}

export async function getIndustry(search?: string) {
  const supabase = await createClient();
  const q = cleanSearch(search);
  let peopleQuery = supabase.from('people').select('id,full_name,first_name,last_name,role,role_type,email,email_status,location,verification_status,relationship_stage,next_action,next_action_due,organization_id').limit(50);
  let orgQuery = supabase.from('organizations').select('id,display_name,canonical_name,org_type,website,location,trust_tier,risk_tier,verification_status,relationship_stage,next_action,next_action_due').limit(30);
  if (q) {
    peopleQuery = peopleQuery.or(`full_name.ilike.%${q}%,role.ilike.%${q}%,email.ilike.%${q}%`);
    orgQuery = orgQuery.or(`display_name.ilike.%${q}%,canonical_name.ilike.%${q}%,org_type.ilike.%${q}%`);
  }
  const [{ data: people, error }, { data: organizations }, { data: signals }, { data: endpoints }] = await Promise.all([
    peopleQuery, orgQuery, supabase.from('relationship_signals').select('*').order('interaction_date', { ascending: false }).limit(20), supabase.from('submission_endpoints').select('*').limit(20),
  ]);
  return { people: people ?? [], organizations: organizations ?? [], signals: signals ?? [], endpoints: endpoints ?? [], error: error?.message ?? null };
}

export async function getFans(search?: string) {
  const supabase = await createClient();
  const q = cleanSearch(search);
  let query = supabase.from('contactable_fans').select('id,email,name,first_name,segment,consent_status,consent_source,first_seen,location,source_files,verification_status').order('created_at', { ascending: false }).limit(80);
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,segment.ilike.%${q}%,location.ilike.%${q}%`);
  const [{ data: fans, error }, { count: suppressionCount }, { data: sampleSuppressions }] = await Promise.all([
    query,
    supabase.from('suppressions').select('*', { count: 'exact', head: true }),
    supabase.from('suppressions').select('email,reason,suppressed_at,source').order('suppressed_at', { ascending: false }).limit(12),
  ]);
  const suppressedEmails = new Set((sampleSuppressions ?? []).map((row: Row) => String(row.email).toLowerCase()));
  return { fans: (fans ?? []).filter((fan: Row) => !suppressedEmails.has(String(fan.email).toLowerCase())), suppressions: sampleSuppressions ?? [], suppressionCount: suppressionCount ?? 0, error: error?.message ?? null };
}

export async function getOutreach() {
  const supabase = await createClient();
  const [{ data: interactions, error }, { data: properties }, { data: people }, { data: campaigns }] = await Promise.all([
    supabase.from('interactions').select('*').order('occurred_at', { ascending: false }).limit(50),
    supabase.from('properties').select('id,name,platform,contact_emails,relationship_stage').not('contact_emails', 'is', null).limit(40),
    supabase.from('people').select('id,full_name,email,role,relationship_stage').not('email', 'is', null).limit(40),
    supabase.from('campaigns').select('*').eq('status', 'active').limit(5),
  ]);
  return { interactions: interactions ?? [], properties: properties ?? [], people: people ?? [], campaigns: campaigns ?? [], error: error?.message ?? null };
}

export async function getContent() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('content_items').select('*').order('scheduled_for', { ascending: true }).limit(100);
  return { items: data ?? [], migrationRequired: error?.code === '42P01' || Boolean(error?.message?.includes('content_items')), error: error?.message ?? null };
}

export async function getAssets() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('assets').select('*,releases(title),artists(name)').order('created_at', { ascending: false });
  return { assets: data ?? [], error: error?.message ?? null };
}

export async function getImports() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false });
  return { batches: data ?? [], error: error?.message ?? null };
}

export async function globalSearch(search?: string) {
  const supabase = await createClient();
  const q = cleanSearch(search);
  if (!q) return { q, groups: {} as Record<string, Row[]>, error: null };
  const [releases, tasks, properties, people, organizations, fans] = await Promise.all([
    supabase.from('releases').select('id,title,featured_artist,release_date,status').ilike('title', `%${q}%`).limit(10),
    supabase.from('tasks').select('id,title,detail,status,due_date').ilike('title', `%${q}%`).limit(10),
    supabase.from('properties').select('id,name,platform,relationship_stage').ilike('name', `%${q}%`).limit(10),
    supabase.from('people').select('id,full_name,role,email,relationship_stage').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(10),
    supabase.from('organizations').select('id,display_name,canonical_name,org_type,relationship_stage').or(`display_name.ilike.%${q}%,canonical_name.ilike.%${q}%`).limit(10),
    supabase.from('contactable_fans').select('id,email,name,segment,consent_status').or(`email.ilike.%${q}%,name.ilike.%${q}%`).limit(10),
  ]);
  return { q, groups: { releases: releases.data ?? [], tasks: tasks.data ?? [], properties: properties.data ?? [], people: people.data ?? [], organizations: organizations.data ?? [], fans: fans.data ?? [] }, error: [releases.error, tasks.error, properties.error, people.error, organizations.error, fans.error].find(Boolean)?.message ?? null };
}

export async function getIntegrations() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const healthRead = await supabase.from('releases').select('id').limit(1);
  const { data: connections, error } = await supabase.from('oauth_connections').select('provider,account_email,provider_account_id,scopes,last_success_at,last_error,updated_at').eq('user_id', user?.id ?? '00000000-0000-0000-0000-000000000000');
  const migrationRequired = error?.code === '42P01' || Boolean(error?.message?.includes('oauth_connections'));
  const byProvider = Object.fromEntries((connections ?? []).map((connection: Row) => [connection.provider, connection]));
  return {
    migrationRequired,
    supabase: { status: healthRead.error ? 'failed' : 'connected', detail: healthRead.error?.message ?? 'Authenticated live-data read succeeded.' },
    google: { status: byProvider.google?.last_success_at ? 'connected' : 'needs_action', connection: byProvider.google ?? null, configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.OAUTH_TOKEN_ENCRYPTION_KEY) },
    spotify: { status: byProvider.spotify?.last_success_at ? 'connected' : 'needs_action', connection: byProvider.spotify ?? null, configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.OAUTH_TOKEN_ENCRYPTION_KEY) },
    ai: { status: process.env.OPENAI_API_KEY ? 'needs_test' : 'needs_action', configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL ?? 'gpt-5' },
  };
}
