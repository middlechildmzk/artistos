begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_workspace_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target
      and m.user_id = auth.uid()
  );
$$;

create or replace function private.can_manage_workspace(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target
      and m.user_id = auth.uid()
      and m.role::text in ('owner','admin','editor')
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.can_manage_workspace(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.can_manage_workspace(uuid) to authenticated, service_role;

drop function if exists public.is_workspace_member(uuid);

-- Remove legacy broad policies from workspace-scoped tables.
do $$
declare
  t text;
  p record;
  tables text[] := array[
    'ai_generations','artist_platform_profiles','artists','assets','campaign_metrics',
    'campaign_targets','campaigns','content_items','fans','import_batches',
    'import_row_actions','interactions','music_coverage_events','music_metric_snapshots',
    'oauth_connections','organizations','outcomes','people','playlist_placements',
    'properties','relationship_signals','release_platform_links','releases','risk_events',
    'source_records','submission_endpoints','suppressions','tasks','verification_events'
  ];
begin
  foreach t in array tables loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_workspace_member(workspace_id))', t || '_workspace_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_manage_workspace(workspace_id))', t || '_workspace_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id))', t || '_workspace_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_manage_workspace(workspace_id))', t || '_workspace_delete', t);
  end loop;
end $$;

-- User-owned tables additionally require the authenticated user to remain owner.
drop policy if exists artist_platform_profiles_workspace_select on public.artist_platform_profiles;
drop policy if exists artist_platform_profiles_workspace_insert on public.artist_platform_profiles;
drop policy if exists artist_platform_profiles_workspace_update on public.artist_platform_profiles;
drop policy if exists artist_platform_profiles_workspace_delete on public.artist_platform_profiles;
create policy artist_platform_profiles_owner_select on public.artist_platform_profiles for select to authenticated using (owner_id=auth.uid() and private.is_workspace_member(workspace_id));
create policy artist_platform_profiles_owner_insert on public.artist_platform_profiles for insert to authenticated with check (owner_id=auth.uid() and private.can_manage_workspace(workspace_id));
create policy artist_platform_profiles_owner_update on public.artist_platform_profiles for update to authenticated using (owner_id=auth.uid() and private.can_manage_workspace(workspace_id)) with check (owner_id=auth.uid() and private.can_manage_workspace(workspace_id));
create policy artist_platform_profiles_owner_delete on public.artist_platform_profiles for delete to authenticated using (owner_id=auth.uid() and private.can_manage_workspace(workspace_id));

drop policy if exists oauth_connections_workspace_select on public.oauth_connections;
drop policy if exists oauth_connections_workspace_insert on public.oauth_connections;
drop policy if exists oauth_connections_workspace_update on public.oauth_connections;
drop policy if exists oauth_connections_workspace_delete on public.oauth_connections;
create policy oauth_connections_owner_select on public.oauth_connections for select to authenticated using (user_id=auth.uid() and private.is_workspace_member(workspace_id));
create policy oauth_connections_owner_insert on public.oauth_connections for insert to authenticated with check (user_id=auth.uid() and private.can_manage_workspace(workspace_id));
create policy oauth_connections_owner_update on public.oauth_connections for update to authenticated using (user_id=auth.uid() and private.can_manage_workspace(workspace_id)) with check (user_id=auth.uid() and private.can_manage_workspace(workspace_id));
create policy oauth_connections_owner_delete on public.oauth_connections for delete to authenticated using (user_id=auth.uid() and private.can_manage_workspace(workspace_id));

-- Workspace directory and membership boundaries.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='workspaces' loop execute format('drop policy if exists %I on public.workspaces',p.policyname); end loop;
  for p in select policyname from pg_policies where schemaname='public' and tablename='workspace_members' loop execute format('drop policy if exists %I on public.workspace_members',p.policyname); end loop;
end $$;

create policy workspaces_member_select on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy workspaces_owner_update on public.workspaces for update to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=auth.uid() and m.role::text='owner')) with check (exists(select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=auth.uid() and m.role::text='owner'));
create policy workspace_members_self_select on public.workspace_members for select to authenticated using (user_id=auth.uid());
create policy workspace_members_owner_select on public.workspace_members for select to authenticated using (exists(select 1 from public.workspace_members me where me.workspace_id=workspace_members.workspace_id and me.user_id=auth.uid() and me.role::text='owner'));

-- Global reference data remains read-only to signed-in users.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='music_platforms' loop execute format('drop policy if exists %I on public.music_platforms',p.policyname); end loop;
end $$;
create policy music_platforms_authenticated_read on public.music_platforms for select to authenticated using (active=true);

-- Lock down the app bucket and require workspace-prefixed object paths.
update storage.buckets set public=false where id='app';
drop policy if exists app_anon_select on storage.objects;
drop policy if exists app_anon_update on storage.objects;
drop policy if exists app_anon_upload on storage.objects;
drop policy if exists app_workspace_select on storage.objects;
drop policy if exists app_workspace_insert on storage.objects;
drop policy if exists app_workspace_update on storage.objects;
drop policy if exists app_workspace_delete on storage.objects;

create policy app_workspace_select on storage.objects for select to authenticated using (
  bucket_id='app' and exists (
    select 1 from public.workspace_members m
    where m.user_id=auth.uid()
      and name like m.workspace_id::text || '/%'
  )
);
create policy app_workspace_insert on storage.objects for insert to authenticated with check (
  bucket_id='app' and exists (
    select 1 from public.workspace_members m
    where m.user_id=auth.uid() and m.role::text in ('owner','admin','editor')
      and name like m.workspace_id::text || '/%'
  )
);
create policy app_workspace_update on storage.objects for update to authenticated using (
  bucket_id='app' and exists (
    select 1 from public.workspace_members m
    where m.user_id=auth.uid() and m.role::text in ('owner','admin','editor')
      and name like m.workspace_id::text || '/%'
  )
) with check (
  bucket_id='app' and exists (
    select 1 from public.workspace_members m
    where m.user_id=auth.uid() and m.role::text in ('owner','admin','editor')
      and name like m.workspace_id::text || '/%'
  )
);
create policy app_workspace_delete on storage.objects for delete to authenticated using (
  bucket_id='app' and exists (
    select 1 from public.workspace_members m
    where m.user_id=auth.uid() and m.role::text in ('owner','admin','editor')
      and name like m.workspace_id::text || '/%'
  )
);

commit;