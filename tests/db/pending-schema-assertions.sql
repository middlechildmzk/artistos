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
    'opportunity_score_features',
    'opportunity_search_runs',
    'opportunity_match_candidates'
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


-- Network Source Runtime must preserve auditable runs, human review state,
-- deterministic match suggestions, and explicit source-policy provenance.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunity_searches'
      and column_name in ('source_plan','last_run_at','last_run_status','last_run_summary')
    group by table_name
    having count(distinct column_name) = 4
  ) then
    raise exception 'opportunity_searches must expose source runtime plan and run summary columns';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunities'
      and column_name in ('source_slug','source_policy_disposition','external_id','canonical_url','review_status','review_disposition','matched_entity_type','matched_entity_id','eligibility')
    group by table_name
    having count(distinct column_name) = 9
  ) then
    raise exception 'opportunities must expose source, review, match, and eligibility state';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_review_status_check'
  ) then
    raise exception 'opportunities review status vocabulary constraint is required';
  end if;

  if has_table_privilege('anon', 'public.opportunity_search_runs', 'select')
     or has_table_privilege('anon', 'public.opportunity_match_candidates', 'select') then
    raise exception 'anon must not read source runtime tables';
  end if;

  if not has_table_privilege('authenticated', 'public.opportunity_search_runs', 'select')
     or not has_table_privilege('authenticated', 'public.opportunity_match_candidates', 'select') then
    raise exception 'authenticated workspace members need source runtime read access';
  end if;
end $$;


-- Source observations remain append-only, YouTube-class data carries an expiry,
-- and campaign targets no longer inherit a single-workspace default.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunity_source_observations'
      and column_name = 'stored_until'
  ) then
    raise exception 'opportunity_source_observations.stored_until is required';
  end if;

  if has_table_privilege('authenticated', 'public.opportunity_source_observations', 'update') then
    raise exception 'source observations must remain append-only';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaign_targets'
      and column_name = 'workspace_id'
      and column_default is not null
  ) then
    raise exception 'campaign_targets.workspace_id must not have a default';
  end if;
end $$;

-- Network Discovery V2 must preserve cross-source identity clusters and request transparency.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunity_search_runs'
      and column_name in ('estimated_request_count','actual_request_count','source_cost_summary')
    group by table_name
    having count(distinct column_name) = 3
  ) then
    raise exception 'opportunity_search_runs must expose estimated and actual request transparency';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunities'
      and column_name in ('discovery_cluster_key','corroborating_sources','corroboration_count','identity_urls','external_identifiers')
    group by table_name
    having count(distinct column_name) = 5
  ) then
    raise exception 'opportunities must expose identity clustering and corroboration state';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunity_source_observations'
      and column_name in ('identity_urls','external_identifiers')
    group by table_name
    having count(distinct column_name) = 2
  ) then
    raise exception 'source observations must preserve identity URLs and external identifiers';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'opportunities'
      and indexname = 'opportunities_discovery_cluster_idx'
  ) then
    raise exception 'cross-source discovery cluster index is required';
  end if;
end $$;

-- Release Fit Sourcing V1 keeps unknown metadata nullable and all review tables isolated.
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'release_similar_artists',
    'release_target_decisions',
    'release_shortlist_items'
  ] loop
    if to_regclass(format('public.%I', required_table)) is null then
      raise exception 'release-fit table % is required', required_table;
    end if;
    if not exists (select 1 from pg_class where oid = format('public.%I', required_table)::regclass and relrowsecurity) then
      raise exception 'RLS must be enabled on %', required_table;
    end if;
    if has_table_privilege('anon', format('public.%I', required_table), 'select') then
      raise exception 'anon must not read %', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_similar_artists' and column_name = 'identity_key' and is_nullable = 'NO'
  ) then
    raise exception 'release_similar_artists.identity_key is required';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'releases'
      and column_name in ('subgenre_tags','mood_tags','lyrical_themes','vocal_type','territory_focus','primary_language','ai_involvement','ai_disclosure_preference','artist_size_band')
      and (is_nullable <> 'YES' or column_default is not null)
  ) then
    raise exception 'release sourcing metadata must remain nullable with no defaults';
  end if;
end $$;
