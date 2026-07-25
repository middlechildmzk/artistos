'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function parseCsvLine(line: string) {
  const out: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { out.push(value.trim()); value = ''; }
    else value += char;
  }
  out.push(value.trim());
  return out;
}

const numeric = (value: string | undefined) => {
  if (!value) return 0;
  const parsed = Number(value.replace(/[$,%]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function importMusicMetricsCsv(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');

  const csv = String(form.get('csv') ?? '').trim();
  if (!csv) throw new Error('Paste CSV data first');
  const sourceType = String(form.get('source_type') ?? 'export');
  const releaseId = String(form.get('release_id') ?? '') || null;
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV needs a header and at least one row');

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const required = ['platform', 'date'];
  for (const key of required) if (!headers.includes(key)) throw new Error(`Missing required column: ${key}`);

  const { data: platforms, error: platformError } = await supabase.from('music_platforms').select('id,slug,name');
  if (platformError) throw new Error(platformError.message);
  const platformMap = new Map<string, string>();
  for (const platform of platforms ?? []) {
    platformMap.set(String(platform.slug).toLowerCase(), platform.id);
    platformMap.set(String(platform.name).toLowerCase(), platform.id);
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
    const key = String(record.platform).toLowerCase();
    const platformId = platformMap.get(key);
    if (!platformId) throw new Error(`Row ${index + 2}: unknown platform “${record.platform}”`);
    const metricDate = record.date || new Date().toISOString().slice(0, 10);
    return {
      owner_id: user.id,
      platform_id: platformId,
      release_id: releaseId,
      metric_date: metricDate,
      source_type: sourceType,
      source_reference: record.source_reference || record.report || null,
      confidence: record.confidence ? numeric(record.confidence) : sourceType === 'distributor' ? 95 : 85,
      metrics: {
        streams: numeric(record.streams), views: numeric(record.views), followers: numeric(record.followers),
        monthly_listeners: numeric(record.monthly_listeners), saves: numeric(record.saves),
        playlist_adds: numeric(record.playlist_adds), revenue_usd: numeric(record.revenue_usd || record.revenue),
        country: record.country || null, track: record.track || null, store: record.store || record.platform,
      },
    };
  });

  const { error } = await supabase.from('music_metric_snapshots').upsert(rows, {
    onConflict: 'owner_id,platform_id,release_id,profile_id,metric_date,source_type',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
  revalidatePath('/imports/music');
}
