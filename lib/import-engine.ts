import { normalizeEmail, normalizeNumber, normalizeText, normalizeUrl } from '@/lib/normalize';

export type ImportEntity = 'fans' | 'people' | 'properties';
export type ImportAction = 'create' | 'update' | 'skip' | 'invalid' | 'suppressed';
export type RawRow = Record<string, unknown>;
export type FieldMap = Record<string, string>;

export type PlannedRow = {
  rowNumber: number;
  action: ImportAction;
  key: string | null;
  data: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  raw: RawRow;
};

export type ImportPlan = {
  entity: ImportEntity;
  rows: PlannedRow[];
  counts: Record<ImportAction, number>;
  headers: string[];
};

export const ENTITY_FIELDS: Record<ImportEntity, { required: string[]; fields: string[] }> = {
  fans: {
    required: ['email'],
    fields: ['email', 'name', 'first_name', 'segment', 'location', 'consent_status', 'consent_source', 'source'],
  },
  people: {
    required: ['full_name'],
    fields: ['full_name', 'first_name', 'last_name', 'email', 'role', 'role_type', 'location', 'organization', 'source'],
  },
  properties: {
    required: ['name'],
    fields: ['name', 'property_type', 'platform', 'url', 'genres', 'followers_estimate', 'owner_or_operator', 'contact_email', 'source'],
  },
};

const ALIASES: Record<string, string[]> = {
  email: ['email', 'email address', 'e-mail', 'mail'],
  name: ['name', 'full name', 'display name', 'fan name'],
  full_name: ['full name', 'name', 'contact name'],
  first_name: ['first name', 'firstname', 'given name'],
  last_name: ['last name', 'lastname', 'surname', 'family name'],
  segment: ['segment', 'list', 'audience', 'tag'],
  location: ['location', 'city', 'region', 'market'],
  consent_status: ['consent status', 'consent', 'marketing status'],
  consent_source: ['consent source', 'signup source', 'opt in source'],
  role: ['role', 'title', 'job title'],
  role_type: ['role type', 'contact type'],
  organization: ['organization', 'company', 'org'],
  property_type: ['property type', 'type', 'channel type'],
  platform: ['platform', 'network', 'service'],
  url: ['url', 'link', 'website', 'profile url'],
  genres: ['genres', 'genre', 'style'],
  followers_estimate: ['followers', 'follower count', 'audience size'],
  owner_or_operator: ['owner', 'operator', 'curator', 'owner or operator'],
  contact_email: ['contact email', 'submission email', 'email'],
  source: ['source', 'source file', 'origin'],
};

export function parseCsv(text: string): RawRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value, index) => normalizeHeader(value) || `column_${index + 1}`);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function detectFieldMap(headers: string[], entity: ImportEntity): FieldMap {
  const normalized = headers.map((header) => ({ original: header, normalized: normalizeHeader(header) }));
  const map: FieldMap = {};
  for (const field of ENTITY_FIELDS[entity].fields) {
    const aliases = [field.replaceAll('_', ' '), ...(ALIASES[field] ?? [])];
    const match = normalized.find((header) => aliases.includes(header.normalized));
    if (match) map[field] = match.original;
  }
  return map;
}

function cleanValue(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized.slice(0, 500) : null;
}

function mapRow(raw: RawRow, fieldMap: FieldMap): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fieldMap).map(([field, source]) => [field, raw[source]]));
}

export function normalizeEntityRow(entity: ImportEntity, mapped: Record<string, unknown>): { data: Record<string, unknown>; key: string | null; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const data: Record<string, unknown> = {};
  if (entity === 'fans') {
    const email = normalizeEmail(mapped.email);
    if (!email.value) errors.push('Email is required.');
    else if (!email.valid) errors.push('Email format is invalid.');
    data.email = email.value;
    data.normalized_email = email.value;
    data.name = cleanValue(mapped.name);
    data.first_name = cleanValue(mapped.first_name) ?? (data.name ? String(data.name).split(/\s+/)[0] : null);
    data.segment = cleanValue(mapped.segment);
    data.location = cleanValue(mapped.location);
    data.consent_status = cleanValue(mapped.consent_status) ?? 'unknown';
    data.consent_source = cleanValue(mapped.consent_source);
    data.source = cleanValue(mapped.source) ?? 'artistos-import';
    return { data, key: email.value, warnings, errors };
  }
  if (entity === 'people') {
    const fullName = cleanValue(mapped.full_name);
    if (!fullName) errors.push('Full name is required.');
    const email = normalizeEmail(mapped.email);
    if (email.value && !email.valid) warnings.push('Email format appears invalid and will be omitted.');
    data.full_name = fullName;
    data.first_name = cleanValue(mapped.first_name) ?? (fullName ? fullName.split(/\s+/)[0] : null);
    data.last_name = cleanValue(mapped.last_name) ?? (fullName && fullName.includes(' ') ? fullName.split(/\s+/).slice(-1)[0] : null);
    data.email = email.valid ? email.value : null;
    data.normalized_email = email.valid ? email.value : null;
    data.role = cleanValue(mapped.role);
    data.role_type = cleanValue(mapped.role_type);
    data.location = cleanValue(mapped.location);
    data.organization_name = cleanValue(mapped.organization);
    data.source = cleanValue(mapped.source) ?? 'artistos-import';
    return { data, key: email.valid ? email.value : fullName?.toLowerCase() ?? null, warnings, errors };
  }
  const name = cleanValue(mapped.name);
  if (!name) errors.push('Property name is required.');
  const url = normalizeUrl(mapped.url);
  if (mapped.url && !url) warnings.push('URL could not be normalized and will be omitted.');
  const platform = cleanValue(mapped.platform)?.toLowerCase() ?? null;
  data.name = name;
  data.property_type = cleanValue(mapped.property_type) ?? 'playlist';
  data.platform = platform;
  data.url = url;
  data.platform_url = url;
  data.genres = cleanValue(mapped.genres);
  data.followers_estimate = normalizeNumber(mapped.followers_estimate);
  data.owner_or_operator = cleanValue(mapped.owner_or_operator);
  const contact = normalizeEmail(mapped.contact_email);
  data.contact_emails = contact.valid && contact.value ? [contact.value] : null;
  data.source = cleanValue(mapped.source) ?? 'artistos-import';
  return { data, key: url ?? (name ? `${platform ?? 'property'}:${name.toLowerCase()}` : null), warnings, errors };
}

export function planImport(args: {
  entity: ImportEntity;
  rawRows: RawRow[];
  fieldMap: FieldMap;
  existingKeys?: Iterable<string>;
  suppressedKeys?: Iterable<string>;
}): ImportPlan {
  const existing = new Set(args.existingKeys ?? []);
  const suppressed = new Set(args.suppressedKeys ?? []);
  const seen = new Set<string>();
  const rows = args.rawRows.map((raw, index): PlannedRow => {
    const mapped = mapRow(raw, args.fieldMap);
    const normalized = normalizeEntityRow(args.entity, mapped);
    let action: ImportAction = normalized.errors.length ? 'invalid' : 'create';
    if (!normalized.errors.length && normalized.key) {
      if (args.entity === 'fans' && suppressed.has(normalized.key)) action = 'suppressed';
      else if (seen.has(normalized.key)) { action = 'skip'; normalized.warnings.push('Duplicate row in this file.'); }
      else if (existing.has(normalized.key)) action = 'update';
      seen.add(normalized.key);
    }
    return { rowNumber: index + 2, action, key: normalized.key, data: normalized.data, warnings: normalized.warnings, errors: normalized.errors, raw };
  });
  const counts: Record<ImportAction, number> = { create: 0, update: 0, skip: 0, invalid: 0, suppressed: 0 };
  for (const row of rows) counts[row.action] += 1;
  return { entity: args.entity, rows, counts, headers: args.rawRows.length ? Object.keys(args.rawRows[0]) : [] };
}

export function chunkRows<T>(rows: T[], size = 250): T[][] {
  if (!Number.isFinite(size) || size < 1) throw new Error('Chunk size must be at least 1.');
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}
