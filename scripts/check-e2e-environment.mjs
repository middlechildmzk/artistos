#!/usr/bin/env node

const required = [
  'E2E_BASE_URL',
  'E2E_OWNER_EMAIL',
  'E2E_OWNER_PASSWORD',
  'E2E_VIEWER_EMAIL',
  'E2E_VIEWER_PASSWORD',
  'E2E_SECOND_WORKSPACE_EMAIL',
  'E2E_SECOND_WORKSPACE_PASSWORD',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error('Authenticated E2E environment is incomplete.');
  for (const name of missing) console.error(`- missing ${name}`);
  process.exit(2);
}

const url = new URL(process.env.E2E_BASE_URL);
if (!['http:', 'https:'].includes(url.protocol)) {
  console.error('E2E_BASE_URL must be an http(s) URL.');
  process.exit(2);
}

const identities = [
  process.env.E2E_OWNER_EMAIL,
  process.env.E2E_VIEWER_EMAIL,
  process.env.E2E_SECOND_WORKSPACE_EMAIL,
].map((value) => value.trim().toLowerCase());

if (new Set(identities).size !== identities.length) {
  console.error('E2E users must be distinct identities.');
  process.exit(2);
}

if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1')) {
  console.error('E2E_BASE_URL must point to the ArtistOS web application, not Supabase.');
  process.exit(2);
}

console.log('Authenticated E2E environment is complete.');
console.log(`Application: ${url.origin}`);
console.log('Fixtures: owner, same-workspace viewer, second-workspace user.');
