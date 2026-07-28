-- Transitional: default new rows to the canonical workspace so writes from the
-- legacy app (which does not yet set workspace_id) stay tenant-correct.
-- Phase B removes these defaults once all app code sets workspace_id explicitly
-- and policies enforce membership.
do $$
declare t text; canonical uuid;
begin
  select id into canonical from public.workspaces where name='Dan Larson / BVSS FVM' limit 1;
  if canonical is null then raise exception 'Canonical workspace missing; aborting.'; end if;

  for t in select table_name from information_schema.columns
           where table_schema='public' and column_name='workspace_id'
             and table_name <> 'workspace_members'
  loop
    execute format('alter table public.%I alter column workspace_id set default %L', t, canonical);
  end loop;
end $$;

comment on function public.is_workspace_member(uuid) is
  'Phase A tenancy helper. Returns true when the calling user is a member of the given workspace. Intended as the USING/WITH CHECK predicate for Phase B workspace-scoped RLS policies.';