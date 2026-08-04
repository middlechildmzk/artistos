-- Read-only production preflight for migration
-- 20260804143000_network_intelligence_contact_safety.sql.
-- Run against the linked production project before approval and save output.

begin read only;

select current_database() as database_name, now() as checked_at;

select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 10;

with people_state as (
  select
    count(*) filter (where archived_at is null) as active_people,
    count(*) filter (
      where archived_at is null
        and consent_status = 'Active - imported from opt-in/download/old list'
    ) as legacy_consent_to_reclassify,
    count(*) filter (
      where archived_at is null
        and email is not null
        and verification_status is null
    ) as verification_to_backfill,
    count(*) filter (where archived_at is null and workspace_id is null) as null_workspace_people
  from public.people
), property_state as (
  select count(*) filter (where archived_at is null and workspace_id is null) as null_workspace_properties
  from public.properties
), org_state as (
  select count(*) filter (where workspace_id is null) as null_workspace_organizations
  from public.organizations
), endpoint_state as (
  select count(*) filter (where workspace_id is null) as null_workspace_endpoints
  from public.submission_endpoints
), source_state as (
  select count(*) filter (where workspace_id is null) as null_workspace_source_records
  from public.source_records
), batch_state as (
  select count(*) filter (where workspace_id is null) as null_workspace_import_batches
  from public.import_batches
), suppression_state as (
  select count(*) filter (where workspace_id is null) as null_workspace_suppressions
  from public.suppressions
), suppressed_people as (
  select count(*) as active_people_matching_suppression
  from public.people p
  join public.suppressions s
    on s.workspace_id = p.workspace_id
   and lower(trim(s.email)) = lower(trim(p.email))
  where p.archived_at is null
)
select *
from people_state
cross join property_state
cross join org_state
cross join endpoint_state
cross join source_state
cross join batch_state
cross join suppression_state
cross join suppressed_people;

select consent_status, count(*)
from public.people
where archived_at is null
group by consent_status
order by count(*) desc, consent_status;

select verification_status, count(*)
from public.people
where archived_at is null and email is not null
group by verification_status
order by count(*) desc, verification_status;

select submission_status, verification_status, count(*)
from public.submission_endpoints
group by submission_status, verification_status
order by submission_status, verification_status;

-- The migration intentionally fails closed if any result is non-zero.
select 'people' as table_name, count(*) as null_workspace_rows from public.people where workspace_id is null
union all select 'properties', count(*) from public.properties where workspace_id is null
union all select 'organizations', count(*) from public.organizations where workspace_id is null
union all select 'submission_endpoints', count(*) from public.submission_endpoints where workspace_id is null
union all select 'source_records', count(*) from public.source_records where workspace_id is null
union all select 'import_batches', count(*) from public.import_batches where workspace_id is null
union all select 'suppressions', count(*) from public.suppressions where workspace_id is null;

rollback;
