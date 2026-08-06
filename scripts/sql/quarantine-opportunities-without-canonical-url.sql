-- Quarantine incomplete opportunity identities without deleting source evidence.
-- This is an idempotent operational data correction, not a schema migration.
-- The public homepage count is intentionally outside this script's scope.

begin;

with candidates as (
  select id
  from public.opportunities
  where nullif(btrim(canonical_url), '') is null
    and review_status is distinct from 'quarantined'
),
updated as (
  update public.opportunities as opportunity
  set
    review_status = 'quarantined',
    review_disposition = 'quarantine',
    review_note = case
      when coalesce(opportunity.review_note, '') ilike '%canonical_url missing%'
        then opportunity.review_note
      else concat_ws(
        E'\n',
        nullif(opportunity.review_note, ''),
        'Quarantined 2026-08-06: canonical_url missing; excluded from ArtistOS Network until identity is resolved.'
      )
    end,
    updated_at = now()
  from candidates
  where opportunity.id = candidates.id
  returning opportunity.opportunity_type
)
select opportunity_type, count(*) as quarantined_count
from updated
group by opportunity_type
order by quarantined_count desc, opportunity_type;

commit;

select
  review_status,
  opportunity_type,
  count(*) as record_count
from public.opportunities
where nullif(btrim(canonical_url), '') is null
group by review_status, opportunity_type
order by record_count desc, review_status, opportunity_type;
