-- Read-only post-migration verification for
-- 20260804143000_network_intelligence_contact_safety.sql.
-- Save the complete output as production evidence.

begin read only;

select current_database() as database_name, now() as checked_at;

select version, name
from supabase_migrations.schema_migrations
where version = '20260804143000';

select
  count(*) filter (where archived_at is null) as active_people,
  count(*) filter (
    where archived_at is null
      and consent_status = 'Active - imported from opt-in/download/old list'
  ) as remaining_legacy_consent_labels,
  count(*) filter (
    where archived_at is null
      and consent_status_original = 'Active - imported from opt-in/download/old list'
  ) as preserved_legacy_consent_history,
  count(*) filter (
    where archived_at is null
      and consent_status = 'Public business contact; outreach not authorized'
  ) as public_business_contacts,
  count(*) filter (
    where archived_at is null
      and email is not null
      and verification_status is null
  ) as remaining_null_email_verification
from public.people;

select contact_permission_state, count(*)
from public.people
where archived_at is null
group by contact_permission_state
order by count(*) desc, contact_permission_state;

select
  count(*) filter (where is_suppressed) as suppressed_people,
  count(*) filter (where route_action_state = 'human_review_required') as human_review_required,
  count(*) filter (where route_action_state = 'authorized_individual') as individually_authorized,
  count(*) filter (where route_action_state = 'outreach_not_authorized') as outreach_not_authorized
from public.industry_people_contact_state;

select route_action_state, count(*)
from public.submission_endpoint_contact_state
group by route_action_state
order by route_action_state;

select org_category, count(*)
from public.organizations
group by org_category
order by count(*) desc, org_category;

select 'people' as table_name, count(*) as null_workspace_rows from public.people where workspace_id is null
union all select 'properties', count(*) from public.properties where workspace_id is null
union all select 'organizations', count(*) from public.organizations where workspace_id is null
union all select 'submission_endpoints', count(*) from public.submission_endpoints where workspace_id is null
union all select 'source_records', count(*) from public.source_records where workspace_id is null
union all select 'import_batches', count(*) from public.import_batches where workspace_id is null
union all select 'suppressions', count(*) from public.suppressions where workspace_id is null;

select
  c.relname as view_name,
  coalesce(array_to_string(c.reloptions, ','), '') as relation_options,
  has_table_privilege('anon', format('public.%I', c.relname), 'select') as anon_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'select') as authenticated_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'industry_people_contact_state',
    'contactable_industry_people',
    'submission_endpoint_contact_state',
    'contactable_submission_endpoints'
  )
order by c.relname;

rollback;
