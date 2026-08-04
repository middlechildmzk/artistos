-- Fails the local pending-migration rehearsal when expected runtime, evidence,
-- Brain, graph, or Network Intelligence safety objects are absent.
-- This file is local-test-only and performs no production writes.

do $$
declare
  required_table text;
  missing_tables text[] := '{}';
  rls_disabled text[] := '{}';
  required_tables text[] := array[
    'capability_idempotency',
    'capability_audit_log',
    'capability_approvals',
    'evidence_records',
    'brain_memories',
    'brain_claims',
    'brain_claim_evidence',
    'brain_learning_observations',
    'knowledge_entities',
    'knowledge_entity_links',
    'opportunity_searches',
    'opportunities',
    'opportunity_source_observations',
    'opportunity_score_features'
  ];
begin
  foreach required_table in array required_tables loop
    if to_regclass(format('public.%I', required_table)) is null then
      missing_tables := array_append(missing_tables, required_table);
      continue;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_table
        and c.relrowsecurity
    ) then
      rls_disabled := array_append(rls_disabled, required_table);
    end if;
  end loop;

  if cardinality(missing_tables) > 0 then
    raise exception 'Pending migration rehearsal is missing required tables: %', array_to_string(missing_tables, ', ');
  end if;

  if cardinality(rls_disabled) > 0 then
    raise exception 'RLS is disabled on pending tables: %', array_to_string(rls_disabled, ', ');
  end if;
end $$;

-- Evidence must remain linkable from source observations.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunity_source_observations'
      and column_name = 'evidence_id'
  ) then
    raise exception 'opportunity_source_observations.evidence_id is required';
  end if;
end $$;

-- Brain v2 must preserve explicit review and contradiction semantics.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'brain_claims' and column_name in ('review_status','contradiction_state')
    group by table_name
    having count(distinct column_name) = 2
  ) then
    raise exception 'brain_claims must expose review_status and contradiction_state';
  end if;
end $$;

-- Network Intelligence must preserve inherited consent history and expose a
-- non-null typed contact permission state after the safety migration.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'people'
      and column_name = 'consent_status_original'
  ) then
    raise exception 'people.consent_status_original is required';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'people'
      and column_name = 'contact_permission_state'
      and is_nullable = 'NO'
  ) then
    raise exception 'people.contact_permission_state must exist and be NOT NULL';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.people'::regclass
      and conname = 'people_contact_permission_state_check'
  ) then
    raise exception 'people contact permission vocabulary constraint is required';
  end if;
end $$;

-- Organization category is normalized separately from the historical display
-- type so filters do not depend on ambiguous free text.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'org_category'
      and is_nullable = 'NO'
  ) then
    raise exception 'organizations.org_category must exist and be NOT NULL';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_org_category_check'
  ) then
    raise exception 'organizations category vocabulary constraint is required';
  end if;
end $$;

-- Contact-state views must inherit caller RLS and remain private from anon.
do $$
declare
  required_view text;
begin
  foreach required_view in array array[
    'industry_people_contact_state',
    'contactable_industry_people',
    'submission_endpoint_contact_state',
    'contactable_submission_endpoints'
  ] loop
    if to_regclass(format('public.%I', required_view)) is null then
      raise exception 'Network Intelligence view is missing: %', required_view;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_view
        and coalesce(c.reloptions, '{}'::text[]) @> array['security_invoker=true']
    ) then
      raise exception 'View % must use security_invoker=true', required_view;
    end if;

    if has_table_privilege('anon', format('public.%I', required_view), 'select') then
      raise exception 'anon must not select from %', required_view;
    end if;

    if not has_table_privilege('authenticated', format('public.%I', required_view), 'select') then
      raise exception 'authenticated must be able to select from %', required_view;
    end if;
  end loop;
end $$;

-- Every network row must carry an explicit workspace after the migration.
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'people',
    'properties',
    'organizations',
    'submission_endpoints',
    'source_records',
    'import_batches',
    'suppressions'
  ] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = required_table
        and column_name = 'workspace_id'
        and is_nullable <> 'NO'
    ) then
      raise exception '%.workspace_id must be NOT NULL', required_table;
    end if;
  end loop;
end $$;
