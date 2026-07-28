-- ArtistOS workspace isolation regression test.
-- Runs only against a disposable local/preview database.
-- All fixture rows and mutations are rolled back.

begin;

-- Seed deterministic identities and workspaces as the database owner before
-- switching into the authenticated role where RLS is enforced.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner@artistos.invalid', crypt('local-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-viewer@artistos.invalid', crypt('local-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-outsider@artistos.invalid', crypt('local-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.workspaces (id, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLS Workspace A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'RLS Workspace B')
on conflict (id) do update set name = excluded.name;

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'viewer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner')
on conflict (workspace_id, user_id) do update set role = excluded.role;

insert into public.artists (id, workspace_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A Artist')
on conflict (id) do nothing;

insert into public.people (id, workspace_id, full_name)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A Person')
on conflict (id) do nothing;

insert into public.releases (id, workspace_id, artist_id, title, status)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000000',
  'Workspace A Release',
  'upcoming'
)
on conflict (id) do nothing;

-- Owner in workspace A can read and write workspace A.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);

do $$
begin
  if (select count(*) from public.workspaces where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'owner cannot read their workspace';
  end if;
end $$;

insert into public.tasks (workspace_id, title, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-owner-write-test', 'open');

-- Viewer in workspace A can read, but cannot write.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);

do $$
begin
  if (select count(*) from public.workspaces where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'viewer cannot read their workspace';
  end if;

  begin
    insert into public.tasks (workspace_id, title, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-viewer-write-must-fail', 'open');
    raise exception 'viewer write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- Member of workspace B cannot read or write workspace A data.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', true);

do $$
begin
  if (select count(*) from public.workspaces where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 0 then
    raise exception 'cross-workspace workspace read leaked';
  end if;
  if (select count(*) from public.people where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 0 then
    raise exception 'cross-workspace people read leaked';
  end if;
  if (select count(*) from public.releases where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 0 then
    raise exception 'cross-workspace releases read leaked';
  end if;

  begin
    insert into public.tasks (workspace_id, title, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-outsider-write-must-fail', 'open');
    raise exception 'cross-workspace task write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;
