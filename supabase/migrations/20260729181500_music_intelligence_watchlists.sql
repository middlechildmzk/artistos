-- Provenance-first competitor watchlists and playlist movement observations.
-- This migration extends Music Intelligence without changing canonical owned-artist records.

begin;

create table if not exists public.music_watchlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  description text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.music_watchlist_artists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  watchlist_id uuid not null references public.music_watchlists(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  relationship_type text not null default 'peer' check (relationship_type in ('similar','peer','aspirational','competitive','adjacent')),
  primary_platform text,
  external_artist_id text,
  profile_url text,
  image_url text,
  genres text[] not null default '{}',
  markets text[] not null default '{}',
  source_url text not null check (source_url ~ '^https?://'),
  source_retrieved_at timestamptz not null default now(),
  freshness_state text not null default 'fresh' check (freshness_state in ('fresh','stale','unknown')),
  confidence numeric(5,4) not null default 0.5 check (confidence between 0 and 1),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed','stale')),
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, display_name)
);

create table if not exists public.music_watchlist_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  watchlist_artist_id uuid not null references public.music_watchlist_artists(id) on delete cascade,
  platform text not null check (length(btrim(platform)) between 1 and 80),
  metric text not null check (length(btrim(metric)) between 1 and 120),
  value numeric not null,
  captured_on date not null,
  source_url text not null check (source_url ~ '^https?://'),
  source_type text not null default 'public_url' check (source_type in ('public_url','api_response','uploaded_file','human_attestation')),
  retrieved_at timestamptz not null default now(),
  freshness_state text not null default 'fresh' check (freshness_state in ('fresh','stale','unknown')),
  confidence numeric(5,4) not null default 0.5 check (confidence between 0 and 1),
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (watchlist_artist_id, platform, metric, captured_on)
);

create table if not exists public.playlist_placement_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  placement_id uuid not null references public.playlist_placements(id) on delete cascade,
  observed_at timestamptz not null default now(),
  present boolean not null,
  followers bigint check (followers is null or followers >= 0),
  track_position integer check (track_position is null or track_position > 0),
  source_url text not null check (source_url ~ '^https?://'),
  source_type text not null default 'public_url' check (source_type in ('public_url','api_response','uploaded_file','human_attestation')),
  freshness_state text not null default 'fresh' check (freshness_state in ('fresh','stale','unknown')),
  confidence numeric(5,4) not null default 0.5 check (confidence between 0 and 1),
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (placement_id, observed_at)
);

create index if not exists music_watchlists_workspace_status_idx on public.music_watchlists(workspace_id, status);
create index if not exists music_watchlists_artist_idx on public.music_watchlists(artist_id);
create index if not exists music_watchlist_artists_workspace_watchlist_idx on public.music_watchlist_artists(workspace_id, watchlist_id);
create index if not exists music_watchlist_artists_platform_external_idx on public.music_watchlist_artists(primary_platform, external_artist_id) where external_artist_id is not null;
create index if not exists music_watchlist_metric_snapshots_series_idx on public.music_watchlist_metric_snapshots(workspace_id, watchlist_artist_id, platform, metric, captured_on desc);
create index if not exists playlist_placement_observations_series_idx on public.playlist_placement_observations(workspace_id, placement_id, observed_at desc);

alter table public.music_watchlists enable row level security;
alter table public.music_watchlist_artists enable row level security;
alter table public.music_watchlist_metric_snapshots enable row level security;
alter table public.playlist_placement_observations enable row level security;

revoke all on public.music_watchlists from anon;
revoke all on public.music_watchlist_artists from anon;
revoke all on public.music_watchlist_metric_snapshots from anon;
revoke all on public.playlist_placement_observations from anon;

grant select, insert, update, delete on public.music_watchlists to authenticated;
grant select, insert, update, delete on public.music_watchlist_artists to authenticated;
grant select, insert, update, delete on public.music_watchlist_metric_snapshots to authenticated;
grant select, insert, update, delete on public.playlist_placement_observations to authenticated;
grant all on public.music_watchlists to service_role;
grant all on public.music_watchlist_artists to service_role;
grant all on public.music_watchlist_metric_snapshots to service_role;
grant all on public.playlist_placement_observations to service_role;

create policy music_watchlists_select_member on public.music_watchlists
  for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy music_watchlists_insert_manager on public.music_watchlists
  for insert to authenticated
  with check (private.can_manage_workspace(workspace_id) and created_by = auth.uid());
create policy music_watchlists_update_manager on public.music_watchlists
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));
create policy music_watchlists_delete_manager on public.music_watchlists
  for delete to authenticated
  using (private.can_manage_workspace(workspace_id));

create policy music_watchlist_artists_select_member on public.music_watchlist_artists
  for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy music_watchlist_artists_insert_manager on public.music_watchlist_artists
  for insert to authenticated
  with check (
    private.can_manage_workspace(workspace_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.music_watchlists watchlist
      where watchlist.id = watchlist_id and watchlist.workspace_id = workspace_id
    )
  );
create policy music_watchlist_artists_update_manager on public.music_watchlist_artists
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));
create policy music_watchlist_artists_delete_manager on public.music_watchlist_artists
  for delete to authenticated
  using (private.can_manage_workspace(workspace_id));

create policy music_watchlist_metric_snapshots_select_member on public.music_watchlist_metric_snapshots
  for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy music_watchlist_metric_snapshots_insert_manager on public.music_watchlist_metric_snapshots
  for insert to authenticated
  with check (
    private.can_manage_workspace(workspace_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.music_watchlist_artists monitored
      where monitored.id = watchlist_artist_id and monitored.workspace_id = workspace_id
    )
  );
create policy music_watchlist_metric_snapshots_update_manager on public.music_watchlist_metric_snapshots
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));
create policy music_watchlist_metric_snapshots_delete_manager on public.music_watchlist_metric_snapshots
  for delete to authenticated
  using (private.can_manage_workspace(workspace_id));

create policy playlist_placement_observations_select_member on public.playlist_placement_observations
  for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy playlist_placement_observations_insert_manager on public.playlist_placement_observations
  for insert to authenticated
  with check (
    private.can_manage_workspace(workspace_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.playlist_placements placement
      where placement.id = placement_id and placement.workspace_id = workspace_id
    )
  );
create policy playlist_placement_observations_update_manager on public.playlist_placement_observations
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));
create policy playlist_placement_observations_delete_manager on public.playlist_placement_observations
  for delete to authenticated
  using (private.can_manage_workspace(workspace_id));

create trigger set_music_watchlists_updated_at
  before update on public.music_watchlists
  for each row execute function public.set_updated_at();
create trigger set_music_watchlist_artists_updated_at
  before update on public.music_watchlist_artists
  for each row execute function public.set_updated_at();

commit;
