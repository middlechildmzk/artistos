-- Keep policy-only SECURITY DEFINER helpers out of the exposed public API
-- schema. PostgreSQL dependencies preserve existing RLS policy references when
-- the functions move schemas, while explicit grants restrict execution to
-- signed-in users and the service role.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

alter function public.artistos_is_workspace_member(uuid) set schema private;
alter function public.artistos_can_manage_workspace(uuid) set schema private;

revoke all on function private.artistos_is_workspace_member(uuid) from public;
revoke all on function private.artistos_is_workspace_member(uuid) from anon;
revoke all on function private.artistos_can_manage_workspace(uuid) from public;
revoke all on function private.artistos_can_manage_workspace(uuid) from anon;

grant execute on function private.artistos_is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.artistos_can_manage_workspace(uuid) to authenticated, service_role;

alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon;

comment on function private.artistos_is_workspace_member(uuid) is
  'Policy-only workspace membership helper. Not exposed through the public API schema.';
comment on function private.artistos_can_manage_workspace(uuid) is
  'Policy-only workspace management helper. Not exposed through the public API schema.';

-- Make the migration fail closed if any future grant/default-privilege behavior
-- leaves these helpers exposed or unusable by authenticated RLS evaluation.
do $$
begin
  if to_regprocedure('public.artistos_is_workspace_member(uuid)') is not null
     or to_regprocedure('public.artistos_can_manage_workspace(uuid)') is not null then
    raise exception 'workspace policy helpers must not remain in the public schema';
  end if;

  if has_schema_privilege('anon', 'private', 'usage')
     or has_function_privilege('anon', 'private.artistos_is_workspace_member(uuid)', 'execute')
     or has_function_privilege('anon', 'private.artistos_can_manage_workspace(uuid)', 'execute') then
    raise exception 'anonymous access to workspace policy helpers was not fully revoked';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'usage')
     or not has_function_privilege('authenticated', 'private.artistos_is_workspace_member(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.artistos_can_manage_workspace(uuid)', 'execute') then
    raise exception 'authenticated RLS evaluation cannot execute workspace policy helpers';
  end if;
end $$;
