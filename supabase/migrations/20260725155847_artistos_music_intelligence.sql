begin;

create table if not exists public.music_platforms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  priority text not null default 'coverage',
  supported_modes text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_platform_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform_id uuid not null references public.music_platforms(id) on delete cascade,
  artist_name text not null,
  external_artist_id text,
  profile_url text,
  connection_state text not null default 'unconnected',
  source_type text not null default 'manual',
  last_synced_at timestamptz,
  last_verified_at timestamptz,
  freshness_status text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, platform_id, artist_name)
);

create table if not exists public.release_platform_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade,
  platform_id uuid not null references public.music_platforms(id) on delete cascade,
  external_release_id text,
  external_track_id text,
  release_url text,
  release_status text not null default 'unknown',
  source_type text not null default 'manual',
  last_verified_at timestamptz,
  evidence_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, release_id, platform_id)
);

create table if not exists public.music_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform_id uuid not null references public.music_platforms(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  profile_id uuid references public.artist_platform_profiles(id) on delete set null,
  metric_date date not null,
  source_type text not null,
  source_reference text,
  metrics jsonb not null default '{}'::jsonb,
  confidence numeric(5,2),
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(owner_id, platform_id, release_id, profile_id, metric_date, source_type)
);

create table if not exists public.music_coverage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  platform_id uuid references public.music_platforms(id) on delete set null,
  coverage_type text not null,
  outlet_name text not null,
  title text,
  url text,
  contact_name text,
  contact_method text,
  occurred_at timestamptz,
  audience_estimate bigint,
  source_type text not null default 'public',
  confidence numeric(5,2),
  verification_state text not null default 'unverified',
  last_verified_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_placements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  platform_id uuid references public.music_platforms(id) on delete set null,
  playlist_name text not null,
  playlist_url text,
  external_playlist_id text,
  owner_name text,
  owner_url text,
  followers bigint,
  track_position integer,
  added_at timestamptz,
  removed_at timestamptz,
  last_activity_at timestamptz,
  contact_name text,
  contact_email text,
  submission_url text,
  source_type text not null default 'public',
  confidence numeric(5,2),
  risk_state text not null default 'unknown',
  verification_state text not null default 'unverified',
  last_verified_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.music_platforms enable row level security;
alter table public.artist_platform_profiles enable row level security;
alter table public.release_platform_links enable row level security;
alter table public.music_metric_snapshots enable row level security;
alter table public.music_coverage_events enable row level security;
alter table public.playlist_placements enable row level security;

drop policy if exists "music_platforms readable" on public.music_platforms;
drop policy if exists "profiles owner all" on public.artist_platform_profiles;
drop policy if exists "release links owner all" on public.release_platform_links;
drop policy if exists "metric snapshots owner all" on public.music_metric_snapshots;
drop policy if exists "coverage owner all" on public.music_coverage_events;
drop policy if exists "placements owner all" on public.playlist_placements;

create policy "music_platforms readable" on public.music_platforms for select to authenticated using (true);
create policy "profiles owner all" on public.artist_platform_profiles for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "release links owner all" on public.release_platform_links for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "metric snapshots owner all" on public.music_metric_snapshots for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "coverage owner all" on public.music_coverage_events for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "placements owner all" on public.playlist_placements for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create index if not exists artist_platform_profiles_owner_idx on public.artist_platform_profiles(owner_id);
create index if not exists release_platform_links_release_idx on public.release_platform_links(release_id);
create index if not exists music_metric_snapshots_date_idx on public.music_metric_snapshots(metric_date desc);
create index if not exists music_coverage_events_release_idx on public.music_coverage_events(release_id, occurred_at desc);
create index if not exists playlist_placements_release_idx on public.playlist_placements(release_id, added_at desc);

grant select on public.music_platforms to authenticated;
grant select, insert, update, delete on public.artist_platform_profiles, public.release_platform_links, public.music_metric_snapshots, public.music_coverage_events, public.playlist_placements to authenticated;

insert into public.music_platforms (slug,name,category,priority,supported_modes) values
('spotify','Spotify','DSP','core',array['oauth','api','export']),
('apple-music','Apple Music / iTunes','DSP','core',array['api','export','distributor']),
('youtube','YouTube / YouTube Music','DSP','core',array['oauth','api','export']),
('amazon-music','Amazon Music','DSP','core',array['export','distributor','public']),
('tidal','TIDAL','DSP','growth',array['api','export','distributor']),
('deezer','Deezer','DSP','growth',array['api','export','distributor']),
('pandora','Pandora','Radio','growth',array['export','distributor','public']),
('soundcloud','SoundCloud','Discovery','core',array['oauth','api','export']),
('audiomack','Audiomack','Discovery','growth',array['export','public','distributor']),
('qobuz','Qobuz','DSP','coverage',array['distributor','public']),
('iheartradio','iHeartRadio','Radio','growth',array['distributor','public','manual']),
('tiktok','TikTok / CapCut','Social','core',array['oauth','export','distributor']),
('instagram','Instagram / Facebook','Social','core',array['oauth','api','export','distributor']),
('snapchat','Snapchat','Social','coverage',array['export','distributor','public']),
('boomplay','Boomplay','International','growth',array['distributor','export','public']),
('anghami','Anghami','International','growth',array['distributor','export','public']),
('jiosaavn','JioSaavn','International','coverage',array['distributor','public']),
('joox','Joox','International','coverage',array['distributor','public']),
('netease','NetEase Cloud Music','International','coverage',array['distributor','public']),
('tencent','Tencent Music','International','coverage',array['distributor','public']),
('claro','Claro Música','International','coverage',array['distributor','public']),
('touch-tunes','TouchTunes','Radio','coverage',array['distributor','manual']),
('bandcamp','Bandcamp','Direct-to-fan','growth',array['public','export','manual']),
('shazam','Shazam','Discovery','growth',array['export','public']),
('radio-press','Blogs, Radio, Podcasts & Channels','Radio','core',array['public','manual'])
on conflict (slug) do update set name = excluded.name, category = excluded.category, priority = excluded.priority, supported_modes = excluded.supported_modes, updated_at = now();

commit;