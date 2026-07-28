-- Parity sprint schema. Additive except four index rebuilds and one view
-- replacement, both fully reversible. Phase B RLS remains unapplied.

-- ---------------------------------------------------------------
-- 1. Workspace-scoped uniqueness
-- ---------------------------------------------------------------
drop index if exists public.fans_email_idx;
drop index if exists public.suppressions_email_idx;
drop index if exists public.people_normalized_email_unique;
drop index if exists public.properties_canonical_key_unique;

drop index if exists public.fans_email_lower_uidx;
create unique index fans_ws_email_uidx
  on public.fans (workspace_id, lower(email));

drop index if exists public.suppressions_email_lower_uidx;
create unique index suppressions_ws_email_uidx
  on public.suppressions (workspace_id, lower(email));

drop index if exists public.people_normalized_email_full_uniq;
create unique index people_ws_email_uidx
  on public.people (workspace_id, normalized_email)
  where normalized_email is not null and normalized_email <> '';

drop index if exists public.properties_canonical_key_full_uniq;
create unique index properties_ws_key_uidx
  on public.properties (workspace_id, canonical_property_key)
  where canonical_property_key is not null and canonical_property_key <> '';

-- ---------------------------------------------------------------
-- 2. Suppression audit fields.
--    `reason` stays free text and is NOT rewritten: all 421 existing
--    rows carry provenance from the original master-list import.
--    `reason_code` is the new constrained vocabulary, left NULL for
--    historical rows because their true category is unknown.
-- ---------------------------------------------------------------
alter table public.suppressions
  add column if not exists suppressed_by    uuid references auth.users(id),
  add column if not exists notes            text,
  add column if not exists normalized_email text,
  add column if not exists reason_code      text;

alter table public.suppressions alter column suppressed_at set default current_date;

update public.suppressions
set normalized_email = lower(btrim(email))
where normalized_email is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='suppressions_reason_code_check') then
    alter table public.suppressions add constraint suppressions_reason_code_check
      check (reason_code is null or reason_code in
        ('unsubscribe','manual','bounce','complaint','role_address','invalid','import','other'));
  end if;
end $$;

create index if not exists suppressions_normalized_idx
  on public.suppressions (workspace_id, normalized_email);

-- ---------------------------------------------------------------
-- 3. Creator provenance and soft archive
-- ---------------------------------------------------------------
alter table public.fans           add column if not exists created_by uuid references auth.users(id);
alter table public.people         add column if not exists created_by uuid references auth.users(id);
alter table public.properties     add column if not exists created_by uuid references auth.users(id);
alter table public.import_batches add column if not exists created_by uuid references auth.users(id);

alter table public.fans       add column if not exists archived_at timestamptz;
alter table public.people     add column if not exists archived_at timestamptz;
alter table public.properties add column if not exists archived_at timestamptz;

-- ---------------------------------------------------------------
-- 4. Import batch enrichment
-- ---------------------------------------------------------------
alter table public.import_batches
  add column if not exists entity_type      text,
  add column if not exists started_at       timestamptz default now(),
  add column if not exists created_count    integer default 0,
  add column if not exists updated_count    integer default 0,
  add column if not exists skipped_count    integer default 0,
  add column if not exists suppressed_count integer default 0,
  add column if not exists invalid_count    integer default 0,
  add column if not exists failed_count     integer default 0,
  add column if not exists rolled_back_by   uuid references auth.users(id),
  add column if not exists file_hash        text;

do $$
declare bad int;
begin
  if not exists (select 1 from pg_constraint where conname='import_batches_entity_type_check') then
    alter table public.import_batches add constraint import_batches_entity_type_check
      check (entity_type is null or entity_type in
        ('fans','people','properties','suppressions','music_metrics'));
  end if;

  select count(*) into bad from public.import_batches
   where status not in ('pending','validating','importing','imported','partial','failed','rolled_back');
  if bad > 0 then
    raise notice 'Skipping status check constraint: % rows hold values outside the vocabulary', bad;
  else
    alter table public.import_batches drop constraint if exists import_batches_status_check;
    alter table public.import_batches add constraint import_batches_status_check
      check (status in ('pending','validating','importing','imported','partial','failed','rolled_back'));
  end if;
end $$;

-- ---------------------------------------------------------------
-- 5. Row-level action log
-- ---------------------------------------------------------------
create table if not exists public.import_row_actions (
  id           bigserial primary key,
  batch_id     uuid not null references public.import_batches(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id),
  target_table text not null,
  target_id    uuid,
  action       text not null check (action in
                 ('created','updated','skipped','suppressed','invalid','failed',
                  'reverted','skipped_modified_since','skipped_referenced','already_gone')),
  source_row   integer,
  before_data  jsonb,
  error_detail text,
  created_at   timestamptz not null default now()
);
create index if not exists import_row_actions_batch_idx  on public.import_row_actions(batch_id);
create index if not exists import_row_actions_target_idx on public.import_row_actions(target_table, target_id);
create index if not exists import_row_actions_ws_idx     on public.import_row_actions(workspace_id);

alter table public.import_row_actions enable row level security;
alter table public.import_row_actions
  alter column workspace_id set default '7fe2a999-41d0-4ba7-af23-98f1e58a5982'::uuid;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='import_row_actions'
                   and policyname='auth_all') then
    create policy auth_all on public.import_row_actions
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------------------------------------------------------------
-- 6. contactable_fans: correlate workspace, expose workspace_id,
--    honour soft archive, restate security_invoker.
-- ---------------------------------------------------------------
drop view if exists public.contactable_fans;

create view public.contactable_fans
with (security_invoker = true) as
select f.id, f.email, f.name, f.first_name, f.segment, f.consent_status,
       f.consent_source, f.first_seen, f.location, f.source_files,
       f.verification_status, f.import_batch_id, f.source_record_id,
       f.created_at, f.workspace_id
from public.fans f
where f.archived_at is null
  and not exists (
    select 1 from public.suppressions s
    where s.workspace_id = f.workspace_id
      and lower(s.email) = lower(f.email)
  );

grant select on public.contactable_fans to authenticated;