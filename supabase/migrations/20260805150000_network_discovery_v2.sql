-- Network Discovery V2
-- Source-controlled only. Replay after Network Source Runtime V1 in a disposable database.
-- Adds request transparency and cross-source identity clustering without authorizing
-- automatic merge, outreach, provider configuration, or production import.

alter table public.opportunity_search_runs
  add column if not exists estimated_request_count integer not null default 0,
  add column if not exists actual_request_count integer not null default 0,
  add column if not exists source_cost_summary jsonb not null default '{}'::jsonb;

alter table public.opportunity_search_runs
  drop constraint if exists opportunity_search_runs_estimated_request_count_check,
  drop constraint if exists opportunity_search_runs_actual_request_count_check,
  drop constraint if exists opportunity_search_runs_source_cost_summary_check;

alter table public.opportunity_search_runs
  add constraint opportunity_search_runs_estimated_request_count_check
    check (estimated_request_count >= 0),
  add constraint opportunity_search_runs_actual_request_count_check
    check (actual_request_count >= 0),
  add constraint opportunity_search_runs_source_cost_summary_check
    check (jsonb_typeof(source_cost_summary) = 'object');

alter table public.opportunities
  add column if not exists discovery_cluster_key text,
  add column if not exists corroborating_sources jsonb not null default '[]'::jsonb,
  add column if not exists corroboration_count integer not null default 1,
  add column if not exists identity_urls jsonb not null default '[]'::jsonb,
  add column if not exists external_identifiers jsonb not null default '{}'::jsonb;

alter table public.opportunities
  drop constraint if exists opportunities_corroborating_sources_check,
  drop constraint if exists opportunities_corroboration_count_check,
  drop constraint if exists opportunities_identity_urls_check,
  drop constraint if exists opportunities_external_identifiers_check;

alter table public.opportunities
  add constraint opportunities_corroborating_sources_check
    check (jsonb_typeof(corroborating_sources) = 'array'),
  add constraint opportunities_corroboration_count_check
    check (corroboration_count >= 1),
  add constraint opportunities_identity_urls_check
    check (jsonb_typeof(identity_urls) = 'array'),
  add constraint opportunities_external_identifiers_check
    check (jsonb_typeof(external_identifiers) = 'object');

alter table public.opportunity_source_observations
  add column if not exists identity_urls jsonb not null default '[]'::jsonb,
  add column if not exists external_identifiers jsonb not null default '{}'::jsonb;

alter table public.opportunity_source_observations
  drop constraint if exists opportunity_observations_identity_urls_check,
  drop constraint if exists opportunity_observations_external_identifiers_check;

alter table public.opportunity_source_observations
  add constraint opportunity_observations_identity_urls_check
    check (jsonb_typeof(identity_urls) = 'array'),
  add constraint opportunity_observations_external_identifiers_check
    check (jsonb_typeof(external_identifiers) = 'object');

create unique index if not exists opportunities_discovery_cluster_idx
  on public.opportunities (workspace_id, search_id, discovery_cluster_key)
  where discovery_cluster_key is not null;

create index if not exists opportunities_corroboration_review_idx
  on public.opportunities (workspace_id, corroboration_count desc, review_status, updated_at desc);

create index if not exists opportunity_runs_request_usage_idx
  on public.opportunity_search_runs (workspace_id, created_at desc, actual_request_count desc);

comment on column public.opportunity_search_runs.estimated_request_count is
  'Plan-time estimate of official API and directory requests. It is a transparency aid, not a billing promise.';
comment on column public.opportunity_search_runs.actual_request_count is
  'Requests reported by source adapters for this execution. Failed network attempts may be undercounted unless the adapter reports them.';
comment on column public.opportunities.discovery_cluster_key is
  'Deterministic candidate cluster key based on an approved stable identity URL or source-specific external ID.';
comment on column public.opportunities.corroborating_sources is
  'Approved sources that independently returned the clustered identity. Corroboration strengthens identity confidence only.';
comment on column public.opportunities.external_identifiers is
  'Source-visible stable external identifiers. These do not imply consent, submission eligibility, or verified ownership.';
