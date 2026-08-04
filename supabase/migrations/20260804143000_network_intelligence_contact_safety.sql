begin;

-- Reconcile legacy import columns that exist in the live database but were
-- originally created by import tooling rather than a tracked migration. This
-- records schema shape only. It does not recreate or infer imported data.
alter table public.people
  add column if not exists normalized_email text,
  add column if not exists contact_type text,
  add column if not exists recommended_segment text,
  add column if not exists consent_status text,
  add column if not exists first_seen text,
  add column if not exists source_category text,
  add column if not exists source_count integer,
  add column if not exists source_files text,
  add column if not exists source_sheets text,
  add column if not exists titles_tracks_playlists text,
  add column if not exists genres text,
  add column if not exists links text,
  add column if not exists engagement_source_notes text,
  add column if not exists relationship_signal text,
  add column if not exists relationship_strength text,
  add column if not exists last_known_interaction text,
  add column if not exists gmail_evidence text,
  add column if not exists source_file text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists source_record_hash text,
  add column if not exists raw_record jsonb,
  add column if not exists imported_at timestamptz;

alter table public.properties
  add column if not exists platform_url text,
  add column if not exists spotify_playlist_id text,
  add column if not exists owner_or_operator text,
  add column if not exists genres text,
  add column if not exists followers_legacy text,
  add column if not exists contact_emails text,
  add column if not exists source text,
  add column if not exists source_file text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists original_source_sheet text,
  add column if not exists original_source_row text,
  add column if not exists canonical_property_key text,
  add column if not exists source_record_hash text,
  add column if not exists raw_record jsonb,
  add column if not exists imported_at timestamptz;

alter table public.import_batches
  add column if not exists imported_count integer default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists error_message text;

-- Preserve the inherited import label before correcting it. The original value
-- remains available for audit and rollback review.
alter table public.people
  add column if not exists consent_status_original text;

alter table public.people
  add column if not exists contact_permission_state text;

update public.people
set consent_status_original = consent_status
where consent_status_original is null
  and consent_status is not null;

-- Normalize email identity before suppression evaluation.
update public.people
set normalized_email = lower(trim(email))
where email is not null
  and (normalized_email is null or normalized_email <> lower(trim(email)));

update public.suppressions
set normalized_email = lower(trim(email))
where normalized_email is null or normalized_email <> lower(trim(email));

-- The historical opt-in label came from mixed import/download sources and is
-- not evidence of industry-outreach consent. Correct the active label while
-- preserving it in consent_status_original.
update public.people
set consent_status = 'Public business contact; outreach not authorized'
where consent_status = 'Active - imported from opt-in/download/old list'
  and archived_at is null;

update public.people p
set contact_permission_state = case
  when exists (
    select 1
    from public.suppressions s
    where s.workspace_id = p.workspace_id
      and s.normalized_email = p.normalized_email
  ) then 'suppressed'
  when p.consent_status = 'Business relationship / direct correspondence' then 'direct_business_relationship'
  when p.consent_status = 'Public business contact; outreach not authorized' then 'public_business_contact'
  when p.email is null then 'unknown'
  else 'outreach_not_authorized'
end
where p.contact_permission_state is null
   or p.contact_permission_state not in (
     'marketing_opt_in',
     'direct_business_relationship',
     'public_business_contact',
     'licensed_business_contact',
     'outreach_not_authorized',
     'suppressed',
     'unknown'
   );

update public.people
set verification_status = 'unverified'
where email is not null
  and verification_status is null;

alter table public.people
  alter column contact_permission_state set default 'unknown';

update public.people
set contact_permission_state = 'unknown'
where contact_permission_state is null;

alter table public.people
  alter column contact_permission_state set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_contact_permission_state_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people
      add constraint people_contact_permission_state_check
      check (contact_permission_state in (
        'marketing_opt_in',
        'direct_business_relationship',
        'public_business_contact',
        'licensed_business_contact',
        'outreach_not_authorized',
        'suppressed',
        'unknown'
      ));
  end if;
end $$;

create index if not exists people_workspace_permission_state_idx
  on public.people (workspace_id, contact_permission_state)
  where archived_at is null;

-- Normalize organization categories without erasing the original display type.
alter table public.organizations
  add column if not exists org_category text;

update public.organizations
set org_category = case
  when lower(coalesce(org_type, '')) ~ '(radio|station|broadcast)' then 'radio'
  when lower(coalesce(org_type, '')) ~ '(playlist|curator)' then 'playlist'
  when lower(coalesce(org_type, '')) ~ '(youtube|tiktok|instagram|creator|influencer|channel)' then 'creator'
  when lower(coalesce(org_type, '')) ~ '(sync|licens|supervisor|music library|trailer)' then 'sync'
  when lower(coalesce(org_type, '')) ~ '(label|publisher|publishing|a&r)' then 'label'
  when lower(coalesce(org_type, '')) ~ '(venue|festival|live music)' then 'live'
  when lower(coalesce(org_type, '')) ~ '(agency|management|manager|booking|promoter|publicity|pr)' then 'agency'
  when lower(coalesce(org_type, '')) ~ '(blog|publication|magazine|media|newsletter|podcast|newspaper|editor)' then 'media'
  when lower(coalesce(org_type, '')) ~ '(platform|marketplace|directory|service)' then 'platform'
  else 'other'
end
where org_category is null
   or org_category not in ('playlist','creator','media','radio','sync','label','agency','live','platform','other');

alter table public.organizations
  alter column org_category set default 'other';

alter table public.organizations
  alter column org_category set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_org_category_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_org_category_check
      check (org_category in ('playlist','creator','media','radio','sync','label','agency','live','platform','other'));
  end if;
end $$;

create index if not exists organizations_workspace_category_idx
  on public.organizations (workspace_id, org_category);

-- RLS-invoker views make suppression and route state explicit at read time.
create or replace view public.industry_people_contact_state
with (security_invoker = true)
as
select
  p.*,
  exists (
    select 1
    from public.suppressions s
    where s.workspace_id = p.workspace_id
      and s.normalized_email = p.normalized_email
  ) as is_suppressed,
  case
    when exists (
      select 1
      from public.suppressions s
      where s.workspace_id = p.workspace_id
        and s.normalized_email = p.normalized_email
    ) then 'blocked_suppressed'
    when p.email is null then 'no_email'
    when p.contact_permission_state in ('direct_business_relationship','licensed_business_contact') then 'authorized_individual'
    when p.contact_permission_state = 'public_business_contact' then 'human_review_required'
    else 'outreach_not_authorized'
  end as route_action_state
from public.people p
where p.archived_at is null;

create or replace view public.contactable_industry_people
with (security_invoker = true)
as
select *
from public.industry_people_contact_state
where is_suppressed is false
  and email is not null
  and contact_permission_state in (
    'direct_business_relationship',
    'public_business_contact',
    'licensed_business_contact'
  );

create or replace view public.submission_endpoint_contact_state
with (security_invoker = true)
as
select
  e.*,
  exists (
    select 1
    from public.suppressions s
    where s.workspace_id = e.workspace_id
      and e.submission_email is not null
      and s.normalized_email = lower(trim(e.submission_email))
  ) as is_suppressed,
  case
    when exists (
      select 1
      from public.suppressions s
      where s.workspace_id = e.workspace_id
        and e.submission_email is not null
        and s.normalized_email = lower(trim(e.submission_email))
    ) then 'blocked_suppressed'
    when e.submission_status = 'needs_verification' then 'needs_verification'
    when e.submission_status = 'open'
      and (e.submission_email is not null or e.submission_url is not null) then 'open'
    else 'unavailable'
  end as route_action_state
from public.submission_endpoints e;

create or replace view public.contactable_submission_endpoints
with (security_invoker = true)
as
select *
from public.submission_endpoint_contact_state
where route_action_state = 'open';

revoke all on public.industry_people_contact_state from anon;
revoke all on public.contactable_industry_people from anon;
revoke all on public.submission_endpoint_contact_state from anon;
revoke all on public.contactable_submission_endpoints from anon;

grant select on public.industry_people_contact_state to authenticated;
grant select on public.contactable_industry_people to authenticated;
grant select on public.submission_endpoint_contact_state to authenticated;
grant select on public.contactable_submission_endpoints to authenticated;

comment on view public.contactable_industry_people is
  'Workspace-private, suppression-safe industry contacts. Public business contact status still requires human review and never authorizes bulk outreach.';

comment on view public.contactable_submission_endpoints is
  'Workspace-private submission routes that are open and not suppressed. Human approval remains required before submission.';

-- Fail closed on accidental unscoped rows. Live verification showed no nulls.
do $$
begin
  if exists (select 1 from public.people where workspace_id is null)
     or exists (select 1 from public.properties where workspace_id is null)
     or exists (select 1 from public.organizations where workspace_id is null)
     or exists (select 1 from public.submission_endpoints where workspace_id is null)
     or exists (select 1 from public.source_records where workspace_id is null)
     or exists (select 1 from public.import_batches where workspace_id is null)
     or exists (select 1 from public.suppressions where workspace_id is null) then
    raise exception 'network workspace_id backfill required before NOT NULL enforcement';
  end if;
end $$;

alter table public.people alter column workspace_id set not null;
alter table public.properties alter column workspace_id set not null;
alter table public.organizations alter column workspace_id set not null;
alter table public.submission_endpoints alter column workspace_id set not null;
alter table public.source_records alter column workspace_id set not null;
alter table public.import_batches alter column workspace_id set not null;
alter table public.suppressions alter column workspace_id set not null;

commit;
