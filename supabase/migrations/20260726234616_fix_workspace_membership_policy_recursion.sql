begin;
create or replace function private.is_workspace_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.workspace_members m
    where m.workspace_id=target
      and m.user_id=auth.uid()
      and m.role::text='owner'
  );
$$;
revoke all on function private.is_workspace_owner(uuid) from public, anon;
grant execute on function private.is_workspace_owner(uuid) to authenticated, service_role;

drop policy if exists workspace_members_owner_select on public.workspace_members;
create policy workspace_members_owner_select on public.workspace_members
for select to authenticated
using (private.is_workspace_owner(workspace_id));

drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_owner_update on public.workspaces
for update to authenticated
using (private.is_workspace_owner(id))
with check (private.is_workspace_owner(id));
commit;
