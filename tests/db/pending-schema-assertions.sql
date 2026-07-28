-- Fails the local pending-migration rehearsal when the expected runtime,
-- evidence, Brain v2, or Knowledge Graph objects are absent or RLS is disabled.
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
