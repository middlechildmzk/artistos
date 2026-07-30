begin;

-- Platform profile identity is workspace data. Keep the creating owner for
-- provenance, but allow all workspace members to read it and workspace
-- managers to maintain it. OAuth tokens remain user-specific.

drop policy if exists "artist_platform_profiles_owner_select" on public.artist_platform_profiles;
drop policy if exists "artist_platform_profiles_owner_update" on public.artist_platform_profiles;
drop policy if exists "artist_platform_profiles_owner_delete" on public.artist_platform_profiles;

create policy "artist_platform_profiles_workspace_select"
on public.artist_platform_profiles
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "artist_platform_profiles_workspace_update"
on public.artist_platform_profiles
for update
to authenticated
using (private.can_manage_workspace(workspace_id))
with check (private.can_manage_workspace(workspace_id));

create policy "artist_platform_profiles_workspace_delete"
on public.artist_platform_profiles
for delete
to authenticated
using (private.can_manage_workspace(workspace_id));

commit;
