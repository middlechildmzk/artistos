-- Verifies that policy-only SECURITY DEFINER helpers are not callable through
-- the exposed public schema or by anonymous clients. Runs only against the
-- disposable local Supabase replay.

do $$
begin
  if to_regprocedure('public.artistos_is_workspace_member(uuid)') is not null then
    raise exception 'artistos_is_workspace_member must not remain in the public schema';
  end if;

  if to_regprocedure('public.artistos_can_manage_workspace(uuid)') is not null then
    raise exception 'artistos_can_manage_workspace must not remain in the public schema';
  end if;

  if to_regprocedure('private.artistos_is_workspace_member(uuid)') is null then
    raise exception 'private.artistos_is_workspace_member(uuid) is missing';
  end if;

  if to_regprocedure('private.artistos_can_manage_workspace(uuid)') is null then
    raise exception 'private.artistos_can_manage_workspace(uuid) is missing';
  end if;

  if has_schema_privilege('anon', 'private', 'usage') then
    raise exception 'anon must not have USAGE on the private schema';
  end if;

  if has_function_privilege('anon', 'private.artistos_is_workspace_member(uuid)', 'execute') then
    raise exception 'anon must not execute private.artistos_is_workspace_member';
  end if;

  if has_function_privilege('anon', 'private.artistos_can_manage_workspace(uuid)', 'execute') then
    raise exception 'anon must not execute private.artistos_can_manage_workspace';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'usage') then
    raise exception 'authenticated must have USAGE on the private schema for RLS evaluation';
  end if;

  if not has_function_privilege('authenticated', 'private.artistos_is_workspace_member(uuid)', 'execute') then
    raise exception 'authenticated must execute private.artistos_is_workspace_member for RLS evaluation';
  end if;

  if not has_function_privilege('authenticated', 'private.artistos_can_manage_workspace(uuid)', 'execute') then
    raise exception 'authenticated must execute private.artistos_can_manage_workspace for RLS evaluation';
  end if;
end $$;
