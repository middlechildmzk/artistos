create table if not exists smart_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references releases(id) on delete cascade,
  slug text not null unique,
  mode text not null default 'live' check (mode in ('presave', 'live', 'private')),
  headline text,
  description text,
  capture_email boolean not null default true,
  consent_copy_version text not null default '2026-07-v1',
  meta_pixel_id text,
  tiktok_pixel_id text,
  google_analytics_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, release_id)
);

create table if not exists smart_link_destinations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  smart_link_id uuid not null references smart_links(id) on delete cascade,
  service text not null,
  url text not null,
  position integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (smart_link_id, service)
);

create table if not exists campaign_deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  campaign_target_id uuid references campaign_targets(id) on delete cascade,
  channel text not null,
  deliverable_type text not null,
  description text,
  required_disclosure text,
  due_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'accepted', 'scheduled', 'delivered', 'verified', 'disputed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table evidence_records
  add column if not exists release_id uuid references releases(id) on delete cascade,
  add column if not exists campaign_id uuid references campaigns(id) on delete cascade,
  add column if not exists campaign_target_id uuid references campaign_targets(id) on delete cascade,
  add column if not exists deliverable_id uuid references campaign_deliverables(id) on delete cascade,
  add column if not exists verification_level text not null default 'L6' check (verification_level in ('L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','L11')),
  add column if not exists verification_method text,
  add column if not exists verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed', 'expired', 'superseded')),
  add column if not exists confidence_score numeric(4,3) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  add column if not exists contradiction_state text not null default 'clear' check (contradiction_state in ('clear', 'possible', 'conflicting', 'resolved')),
  add column if not exists expires_at timestamptz;

alter table fans
  add column if not exists source_smart_link_id uuid references smart_links(id) on delete set null,
  add column if not exists last_seen_at timestamptz,
  add column if not exists consent_last_recorded_at timestamptz;

create table if not exists fan_consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  fan_id uuid not null references fans(id) on delete cascade,
  smart_link_id uuid references smart_links(id) on delete set null,
  consent_type text not null check (consent_type in ('email_marketing', 'privacy_terms', 'analytics', 'sms_marketing')),
  granted boolean not null,
  policy_version text not null,
  source_url text,
  ip_hash text,
  user_agent_hash text,
  evidence jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create table if not exists link_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  smart_link_id uuid not null references smart_links(id) on delete cascade,
  fan_id uuid references fans(id) on delete set null,
  event_type text not null check (event_type in ('page_view', 'destination_click', 'fan_signup', 'presave_intent')),
  destination_service text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  country_code text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table smart_links enable row level security;
alter table smart_link_destinations enable row level security;
alter table campaign_deliverables enable row level security;
alter table fan_consents enable row level security;
alter table link_events enable row level security;

DO $$ BEGIN
  create policy "smart_links_workspace_select" on smart_links for select to authenticated using (private.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "smart_links_workspace_insert" on smart_links for insert to authenticated with check (private.can_manage_workspace(workspace_id) and owner_id = (select auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "smart_links_workspace_update" on smart_links for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "smart_links_workspace_delete" on smart_links for delete to authenticated using (private.can_manage_workspace(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "smart_link_destinations_workspace_select" on smart_link_destinations for select to authenticated using (private.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "smart_link_destinations_workspace_manage" on smart_link_destinations for all to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "campaign_deliverables_workspace_select" on campaign_deliverables for select to authenticated using (private.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "campaign_deliverables_workspace_manage" on campaign_deliverables for all to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "fan_consents_workspace_select" on fan_consents for select to authenticated using (private.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "fan_consents_workspace_manage" on fan_consents for all to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "link_events_workspace_select" on link_events for select to authenticated using (private.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "link_events_workspace_manage" on link_events for all to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create unique index if not exists idx_fans_workspace_normalized_email on fans (workspace_id, lower(trim(email))) where archived_at is null;
create index if not exists idx_smart_links_workspace_release on smart_links(workspace_id, release_id);
create index if not exists idx_smart_links_active_slug on smart_links(slug) where is_active = true;
create index if not exists idx_smart_link_destinations_order on smart_link_destinations(smart_link_id, position);
create index if not exists idx_campaign_deliverables_campaign on campaign_deliverables(campaign_id, status);
create index if not exists idx_evidence_release_captured on evidence_records(release_id, captured_at desc) where release_id is not null;
create index if not exists idx_evidence_expiry on evidence_records(expires_at) where expires_at is not null;
create index if not exists idx_fan_consents_fan_recorded on fan_consents(fan_id, recorded_at desc);
create index if not exists idx_link_events_link_occurred on link_events(smart_link_id, occurred_at desc);

comment on table smart_links is 'ArtistOS public release pages and presave/live fan-link configuration.';
comment on table fan_consents is 'Append-only consent evidence. Consent changes create new records rather than overwriting history.';
comment on column evidence_records.verification_level is 'L1 public verification through L11 stale evidence; never infer a stronger level than the recorded method supports.';