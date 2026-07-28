-- ArtistOS integration and content support.
-- Non-destructive: creates new tables only. Existing release, CRM, fan, campaign, and import data is unchanged.

create table if not exists public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'spotify')),
  provider_account_id text,
  account_email text,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_type text not null default 'Bearer',
  expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_connections enable row level security;
revoke all on public.oauth_connections from anon;
grant select, insert, update, delete on public.oauth_connections to authenticated;

drop policy if exists "Users manage their own OAuth connections" on public.oauth_connections;
create policy "Users manage their own OAuth connections"
on public.oauth_connections
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null,
  content_type text,
  platform text,
  status text not null default 'idea' check (status in ('idea','drafted','ready','scheduled','published','blocked')),
  scheduled_for timestamptz,
  published_url text,
  cta text,
  copy text,
  asset_id uuid references public.assets(id) on delete set null,
  owner text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_items enable row level security;
revoke all on public.content_items from anon;
grant select, insert, update, delete on public.content_items to authenticated;

drop policy if exists "Users manage their own content items" on public.content_items;
create policy "Users manage their own content items"
on public.content_items
for all
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create index if not exists oauth_connections_user_provider_idx on public.oauth_connections (user_id, provider);
create index if not exists content_items_release_schedule_idx on public.content_items (release_id, scheduled_for);