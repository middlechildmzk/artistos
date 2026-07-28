-- ArtistOS Core Foundation
-- Rules encoded: provenance on everything, unknown != false, historical != current,
-- fans separate from industry, suppression overrides, rollback via import batches.

create extension if not exists "pgcrypto";

-- ============ WORKSPACE / IDENTITY ============
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table artists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  aliases text[] default '{}',
  genre_tags text[] default '{}',
  spotify_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table releases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id),
  title text not null,
  featured_artist text,
  release_date date,
  distributor text,
  label text,
  isrc text,
  upc text,
  status text not null default 'upcoming', -- upcoming | released | catalog
  spotify_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references releases(id),
  artist_id uuid references artists(id),
  name text not null,
  asset_type text not null, -- press_kit | cover_art | teaser_video | canvas | epk | one_sheet | link | audio | other
  url text,
  location_note text, -- where it lives if not a URL
  status text not null default 'ready', -- ready | needs_creation | draft
  notes text,
  created_at timestamptz not null default now()
);

-- ============ IMPORT / PROVENANCE (rollback backbone) ============
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_sheet text,
  description text,
  status text not null default 'imported', -- imported | rolled_back | dry_run
  row_count int default 0,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

create table source_records (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references import_batches(id),
  source_file text not null,
  source_sheet text,
  source_row int,
  raw jsonb not null,
  created_at timestamptz not null default now()
);

-- ============ INDUSTRY GRAPH ============
create table organizations (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  display_name text,
  org_type text, -- blog | playlist_network | label | radio | press | sync | curator_collective | platform | unknown
  website text,
  location text,
  activity_status text default 'unknown', -- active | inactive | stale | unknown
  trust_tier text default 'unknown',      -- high | medium | low | unknown
  risk_tier text default 'unknown',       -- low | medium | high | blocked | unknown
  verification_status text default 'unverified', -- verified | partially_verified | unverified | conflicting
  verification_date date,
  evidence_strength int default 1, -- 1 weak .. 5 strong; importer must not overwrite higher with lower
  primary_source_url text,
  notes text,
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index organizations_canonical_idx on organizations (lower(canonical_name));

create table people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  full_name text,
  first_name text,
  last_name text,
  role text,
  role_type text, -- editor | curator | dj | manager | supervisor | creator | unknown
  email text,
  email_status text default 'unknown', -- valid | bounced | unverified | unknown
  linkedin_url text,
  instagram_url text,
  x_url text,
  location text,
  relationship_relevance text,
  verification_status text default 'unverified',
  evidence_strength int default 1,
  notes text,
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index people_email_idx on people (lower(email));

create table properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  owner_person_id uuid references people(id),
  name text not null,
  property_type text, -- playlist | blog | youtube_channel | radio_show | tiktok | instagram | podcast | publication | unknown
  platform text,
  url text,
  genre_tags text[] default '{}',
  followers_estimate text, -- kept as text: legacy numbers are historical, not current
  followers_asof date,
  activity_status text default 'unknown',
  verification_status text default 'unverified',
  evidence_strength int default 1,
  notes text,
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table submission_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  property_id uuid references properties(id),
  endpoint_type text, -- form | email | submithub | groover | platform | dm | unknown
  submission_url text,
  submission_email text,
  submission_status text default 'unknown', -- open | closed | paused | unknown
  accepts_unreleased boolean, -- null = unknown, never inferred
  requires_live_url boolean,
  free_or_paid text default 'unknown', -- free | paid | both | unknown
  price_or_fee text,
  accepted_assets text,
  submission_rules text,
  typical_turnaround text,
  rights_terms text,
  verification_status text default 'unverified',
  evidence_strength int default 1,
  notes text,
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ CAMPAIGN / EXECUTION ============
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id),
  name text not null,
  status text not null default 'active', -- planning | active | wrapped
  start_date date,
  end_date date,
  goals text,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  release_id uuid references releases(id),
  title text not null,
  detail text,
  classification text not null default 'spine', -- spine | upside
  status text not null default 'open', -- open | in_progress | done | skipped
  due_date date,
  sort_order int default 100,
  blocked_by text, -- freeform blocker description
  blocker_cleared boolean default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  organization_id uuid references organizations(id),
  person_id uuid references people(id),
  property_id uuid references properties(id),
  endpoint_id uuid references submission_endpoints(id),
  direction text not null default 'outbound', -- outbound | inbound
  channel text, -- email | form | submithub | groover | dm | other
  subject text,
  body text,
  asset_link text,
  occurred_at timestamptz not null default now(),
  reply_status text default 'none', -- none | replied_positive | replied_negative | replied_neutral | bounced
  follow_up_due date,
  follow_up_done boolean default false,
  notes text,
  created_at timestamptz not null default now()
);

create table outcomes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  release_id uuid references releases(id),
  organization_id uuid references organizations(id),
  property_id uuid references properties(id),
  outcome_type text not null, -- playlist_add | blog_feature | radio_spin | sync_placement | creator_use | press_mention | other
  outcome_date date,
  evidence_summary text,
  url text,
  confidence text default 'unknown', -- confirmed | probable | unknown
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now()
);

create table relationship_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  person_id uuid references people(id),
  email text,
  entity_label text,
  signal text, -- positive | negative | neutral | historical
  relationship_status text,
  interaction_date date,
  evidence_summary text,
  source text,
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now()
);

create table risk_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  property_id uuid references properties(id),
  entity_label text,
  event_type text,
  event_date text, -- kept text: source data mixes dates and statuses
  measured_outcome text,
  evidence text,
  url text,
  risk_classification text, -- avoid | caution | monitor | cleared
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now()
);

create table verification_events (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  field_name text,
  old_value text,
  new_value text,
  verification_method text, -- manual | web | email_bounce | reply | import
  verified_at timestamptz not null default now(),
  notes text
);

-- ============ FAN CRM (strictly separate) ============
create table fans (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  first_name text,
  segment text, -- fan_listener | engaged | vip | unknown
  consent_status text default 'unknown', -- opted_in | implied | unknown  (never inferred upward)
  consent_source text,
  first_seen date,
  location text,
  source_files text,
  verification_status text default 'unverified',
  import_batch_id uuid references import_batches(id),
  source_record_id uuid references source_records(id),
  created_at timestamptz not null default now()
);
create unique index fans_email_idx on fans (lower(email));

create table suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text, -- unsubscribed | bounced | invalid | do_not_contact | complaint | removed
  suppressed_at date,
  source text,
  import_batch_id uuid references import_batches(id),
  created_at timestamptz not null default now()
);
create unique index suppressions_email_idx on suppressions (lower(email));

-- Suppression always wins: convenience view
create view contactable_fans as
select f.* from fans f
where not exists (
  select 1 from suppressions s where lower(s.email) = lower(f.email)
);