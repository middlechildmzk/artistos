-- ArtistOS multi-tenant foundation, Phase A.
-- Additive and idempotent. Introduces workspace tenancy WITHOUT changing any
-- existing RLS policy, so the current apps keep working unchanged.

-- 1. Roles
do $$
begin
  if not exists (select 1 from pg_type where typname='workspace_role') then
    create type public.workspace_role as enum ('owner','admin','editor','contributor','viewer');
  end if;
end $$;

-- 2. Membership
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.workspace_role not null default 'viewer',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
alter table public.workspace_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='workspace_members'
                   and policyname='workspace_members_self_read') then
    create policy workspace_members_self_read on public.workspace_members
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- 3. Seed canonical owner
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, '1117df01-6442-4c59-9d94-3ffa7e15612f'::uuid, 'owner'
from public.workspaces w
where w.name = 'Dan Larson / BVSS FVM'
on conflict (workspace_id, user_id) do update set role = 'owner';

-- 4. Membership helper for future policies. STABLE + security definer so
--    policies can call it without recursive RLS on workspace_members.
create or replace function public.is_workspace_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- 5. Add nullable workspace_id + FK + index to every tenant-owned table,
--    then backfill to the canonical workspace.
--    music_platforms is intentionally excluded: it is a global reference
--    registry, not tenant data.
do $$
declare
  t text;
  canonical uuid;
  tenant_tables text[] := array[
    'artists','assets','campaign_targets','campaigns','fans','import_batches',
    'interactions','organizations','outcomes','people','properties',
    'relationship_signals','releases','risk_events','source_records',
    'submission_endpoints','suppressions','tasks','verification_events',
    'content_items','campaign_metrics','ai_generations','oauth_connections',
    'artist_platform_profiles','music_coverage_events','music_metric_snapshots',
    'playlist_placements','release_platform_links'
  ];
begin
  select id into canonical from public.workspaces where name='Dan Larson / BVSS FVM' limit 1;
  if canonical is null then
    raise exception 'Canonical workspace not found; aborting.';
  end if;

  foreach t in array tenant_tables loop
    if to_regclass('public.'||t) is null then
      raise notice 'skip missing table %', t;
      continue;
    end if;

    execute format('alter table public.%I add column if not exists workspace_id uuid', t);

    if not exists (
      select 1 from pg_constraint
      where conname = t||'_workspace_id_fkey' and conrelid = ('public.'||t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces(id) on delete restrict',
        t, t||'_workspace_id_fkey');
    end if;

    execute format('create index if not exists %I on public.%I(workspace_id)', t||'_workspace_idx', t);
    execute format('update public.%I set workspace_id = $1 where workspace_id is null', t) using canonical;
  end loop;
end $$;