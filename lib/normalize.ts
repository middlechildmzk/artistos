/**
 * Deterministic normalization shared by import and manual entry.
 *
 * Verified against production 2026-07-26:
 * people.normalized_email === lower(btrim(email)) for all existing rows.
 */

export type NormalizedEmail = { value: string | null; valid: boolean; reason?: string };

const ROLE_PREFIXES = new Set([
  'admin', 'info', 'support', 'contact', 'sales', 'hello', 'noreply',
  'no-reply', 'postmaster', 'webmaster', 'abuse',
]);

export function normalizeEmail(raw: unknown): NormalizedEmail {
  if (typeof raw !== 'string') return { value: null, valid: false, reason: 'not_a_string' };
  let value = raw.trim();
  const angled = value.match(/<([^>]+)>\s*$/);
  if (angled) value = angled[1];
  value = value.trim().replace(/\s+/g, '').toLowerCase();

  if (!value) return { value: null, valid: false, reason: 'empty' };
  if (value.length > 254) return { value: null, valid: false, reason: 'too_long' };

  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return { value, valid: false, reason: 'missing_at' };
  const domain = value.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return { value, valid: false, reason: 'bad_domain' };
  }
  if (value.includes('..')) return { value, valid: false, reason: 'double_dot' };
  return { value, valid: true };
}

export function isRoleAddress(email: string): boolean {
  return ROLE_PREFIXES.has(email.split('@')[0] ?? '');
}

const TRACKING_PARAMS = new Set(['si', 'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', 'ref', 'ref_src']);

export function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.includes('://') ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) parsed.searchParams.delete(key);
  }
  let out = parsed.toString();
  if (out.endsWith('?')) out = out.slice(0, -1);
  if (out.endsWith('/') && parsed.pathname === '/') out = out.slice(0, -1);
  return out;
}

const SPOTIFY_PLAYLIST = /(?:playlist[/:])([A-Za-z0-9]{22})/;
export function spotifyPlaylistId(raw: unknown): string | null {
  return typeof raw === 'string' ? raw.match(SPOTIFY_PLAYLIST)?.[1] ?? null : null;
}

export function canonicalPropertyKey(input: { url?: unknown; name?: unknown; spotifyPlaylistId?: unknown }): string | null {
  const direct = typeof input.spotifyPlaylistId === 'string' ? input.spotifyPlaylistId.trim() : '';
  const spotify = direct || spotifyPlaylistId(input.url);
  if (spotify) return `spotify:${spotify}`;
  const url = normalizeUrl(input.url);
  if (url) return url;
  const name = normalizeText(input.name);
  return name ? name.toLowerCase() : null;
}

export function normalizeText(raw: unknown): string | null {
  if (typeof raw === 'number') return String(raw);
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value || null;
}

export type DateFormat = 'iso' | 'mdy' | 'dmy';
export function normalizeDate(raw: unknown, format: DateFormat = 'iso'): string | null {
  const value = normalizeText(raw);
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return padDate(iso[1], iso[2], iso[3]);
  const slash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!slash || format === 'iso') return null;
  const [, a, b, year] = slash;
  return format === 'mdy' ? padDate(year, a, b) : padDate(year, b, a);
}

function padDate(year: string, month: string, day: string): string | null {
  const mm = Number(month);
  const dd = Number(day);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function normalizeNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const value = normalizeText(raw);
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
