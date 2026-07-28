create or replace function public.ensure_artistos_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_email text;
  v_workspace_name text;
  v_artist_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select wm.workspace_id
    into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = v_user_id
  order by wm.created_at
  limit 1;

  if v_workspace_id is not null then
    return v_workspace_id;
  end if;

  select email into v_email from auth.users where id = v_user_id;
  v_workspace_name := coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'My Artist') || ' / ArtistOS';
  v_artist_name := coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'My Artist');

  insert into public.workspaces (name)
  values (v_workspace_name)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner'::public.workspace_role);

  insert into public.artists (workspace_id, name, aliases, genre_tags, notes)
  values (
    v_workspace_id,
    v_artist_name,
    '{}'::text[],
    '{}'::text[],
    'Created automatically during ArtistOS onboarding.'
  );

  return v_workspace_id;
end;
$$;

revoke all on function public.ensure_artistos_workspace() from public;
revoke all on function public.ensure_artistos_workspace() from anon;
grant execute on function public.ensure_artistos_workspace() to authenticated;
