begin;

revoke all on function public.handle_artistos_auth_user() from public;
revoke all on function public.handle_artistos_auth_user() from anon;
revoke all on function public.handle_artistos_auth_user() from authenticated;

grant execute on function public.handle_artistos_auth_user() to postgres;

revoke all on function public.ensure_artistos_workspace() from public;
revoke all on function public.ensure_artistos_workspace() from anon;
revoke all on function public.ensure_artistos_workspace() from authenticated;

grant execute on function public.ensure_artistos_workspace() to postgres;
grant execute on function public.ensure_artistos_workspace() to service_role;

commit;