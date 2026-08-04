begin;

revoke all on function public.ensure_artistos_workspace() from public;
revoke all on function public.ensure_artistos_workspace() from anon;

grant execute on function public.ensure_artistos_workspace() to authenticated;
grant execute on function public.ensure_artistos_workspace() to service_role;
grant execute on function public.ensure_artistos_workspace() to postgres;

comment on function public.ensure_artistos_workspace() is
  'Authenticated ArtistOS onboarding entrypoint. Uses auth.uid() and creates only the caller''s initial workspace, owner membership, and artist record.';

do $$
begin
  if has_function_privilege('anon', 'public.ensure_artistos_workspace()', 'execute') then
    raise exception 'anonymous users must not execute ArtistOS workspace onboarding';
  end if;

  if not has_function_privilege('authenticated', 'public.ensure_artistos_workspace()', 'execute') then
    raise exception 'authenticated users must be able to execute ArtistOS workspace onboarding';
  end if;
end $$;

commit;