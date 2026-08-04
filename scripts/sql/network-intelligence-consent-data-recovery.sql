-- DATA-ONLY recovery procedure for migration
-- 20260804143000_network_intelligence_contact_safety.sql.
--
-- This intentionally does not drop additive columns, constraints, indexes, or
-- views. It restores only the preserved consent label and recomputes safe
-- permission states. Review exact row counts before executing in production.
-- Suppression remains authoritative and is never reversed by this script.

begin;

-- Operator must replace this assertion with the approved expected count from
-- the saved preflight. It prevents accidental execution against an unexpected
-- dataset. Current read-only preflight on 2026-08-04 returned 5,628.
do $$
declare
  expected_rows constant integer := 5628;
  actual_rows integer;
begin
  select count(*)
  into actual_rows
  from public.people
  where archived_at is null
    and consent_status_original = 'Active - imported from opt-in/download/old list';

  if actual_rows <> expected_rows then
    raise exception 'Recovery row-count mismatch. Expected %, found %', expected_rows, actual_rows;
  end if;
end $$;

update public.people
set consent_status = consent_status_original
where archived_at is null
  and consent_status_original = 'Active - imported from opt-in/download/old list'
  and consent_status = 'Public business contact; outreach not authorized';

-- Even after restoring the historical text, the typed execution state remains
-- fail-closed. A legacy label is not converted into send authority.
update public.people p
set contact_permission_state = case
  when exists (
    select 1
    from public.suppressions s
    where s.workspace_id = p.workspace_id
      and s.normalized_email = p.normalized_email
  ) then 'suppressed'
  when p.consent_status = 'Business relationship / direct correspondence' then 'direct_business_relationship'
  when p.email is null then 'unknown'
  else 'outreach_not_authorized'
end
where p.archived_at is null;

commit;

-- Required after execution:
-- select consent_status, contact_permission_state, count(*)
-- from public.people where archived_at is null group by 1,2 order by 3 desc;
