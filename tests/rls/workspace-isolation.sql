-- ArtistOS workspace isolation regression test
-- Run against a disposable Supabase branch/local database after seeding two auth users
-- and two workspaces. Replace the UUID placeholders before execution.
-- The test intentionally rolls back all mutations.

begin;

-- Existing owner should see their workspace data.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

-- Expected: 1
select count(*) as owner_visible_workspace
from public.workspaces
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: succeeds for an owner/admin/editor workspace member.
insert into public.tasks (workspace_id, title, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-owner-write-test', 'open');

-- Switch to unrelated authenticated user.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

-- Expected: 0 for every protected dataset.
select count(*) as outsider_visible_workspace
from public.workspaces
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select count(*) as outsider_visible_people
from public.people
where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select count(*) as outsider_visible_releases
from public.releases
where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: RLS violation. Run separately when automating because the error aborts
-- the current transaction.
-- insert into public.tasks (workspace_id, title, status)
-- values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-outsider-write-test', 'open');

rollback;
