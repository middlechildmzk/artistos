begin;

alter table public.oauth_connections
  drop constraint if exists oauth_connections_provider_check;

alter table public.oauth_connections
  add constraint oauth_connections_provider_check
  check (provider = any (array[
    'google'::text,
    'spotify'::text,
    'soundcharts'::text,
    'kit'::text,
    'lastfm'::text,
    'ticketmaster'::text
  ]));

create table if not exists public.artist_external_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  provider text not null check (provider = any (array[
    'musicbrainz'::text,
    'listenbrainz'::text,
    'lastfm'::text,
    'ticketmaster'::text,
    'soundcharts'::text
  ])),
  external_id text not null,
  display_name text,
  profile_url text,
  source_type text not null default 'manual' check (source_type = any (array['manual'::text, 'api'::text, 'public'::text])),
  verification_status text not null default 'pending' check (verification_status = any (array['pending'::text, 'supported'::text, 'verified'::text, 'failed'::text, 'conflicting'::text])),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  contradiction_state text not null default 'clear' check (contradiction_state = any (array['clear'::text, 'possible'::text, 'conflicting'::text, 'resolved'::text])),
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, artist_id, provider),
  unique (workspace_id, provider, external_id)
);

create index if not exists artist_external_identities_workspace_artist_idx
  on public.artist_external_identities (workspace_id, artist_id);

create index if not exists artist_external_identities_provider_external_idx
  on public.artist_external_identities (provider, external_id);

alter table public.artist_external_identities enable row level security;

create policy artist_external_identities_workspace_select
  on public.artist_external_identities
  for select
  using (private.is_workspace_member(workspace_id));

create policy artist_external_identities_workspace_insert
  on public.artist_external_identities
  for insert
  with check (private.can_manage_workspace(workspace_id));

create policy artist_external_identities_workspace_update
  on public.artist_external_identities
  for update
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));

create policy artist_external_identities_workspace_delete
  on public.artist_external_identities
  for delete
  using (private.can_manage_workspace(workspace_id));

commit;
