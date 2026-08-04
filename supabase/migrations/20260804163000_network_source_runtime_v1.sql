-- Network Source Runtime V1
-- Source-controlled only. Replay in isolation before any production application.
-- Adds provider-neutral search runs, source-visible review state, and deterministic
-- identity-match suggestions without authorizing outreach or automatic CRM import.

alter table public.opportunity_searches
  add column if not exists source_plan jsonb not null default '[]'::jsonb,
  add column if not exists last_run_at timestamptz,
  add column if not exists last_run_status text,
  add column if not exists last_run_summary jsonb not null default '{}'::jsonb;


-- Search execution can end in a truthful failed state.
alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_status_check;
alter table public.opportunity_searches
  add constraint opportunity_searches_status_check
  check (status in ('draft','approved','running','paused','completed','failed','cancelled'));

alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_last_run_status_check;
alter table public.opportunity_searches
  add constraint opportunity_searches_last_run_status_check
  check (last_run_status is null or last_run_status in ('planned','running','completed','partial','failed'));

create table if not exists public.opportunity_search_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  search_id uuid not null references public.opportunity_searches(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','running','completed','partial','failed','cancelled')),
  plan_snapshot jsonb not null default '{}'::jsonb,
  source_reports jsonb not null default '[]'::jsonb,
  result_count integer not null default 0 check (result_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  error_summary text,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, search_id, idempotency_key)
);

alter table public.opportunities
  add column if not exists search_run_id uuid references public.opportunity_search_runs(id) on delete set null,
  add column if not exists source_slug text,
  add column if not exists source_policy_disposition text,
  add column if not exists external_id text,
  add column if not exists canonical_url text,
  add column if not exists candidate_kind text not null default 'unknown',
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_disposition text,
  add column if not exists review_note text,
  add column if not exists matched_entity_type text,
  add column if not exists matched_entity_id uuid,
  add column if not exists match_confidence numeric,
  add column if not exists match_reasons jsonb not null default '[]'::jsonb,
  add column if not exists eligibility jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.opportunities
  drop constraint if exists opportunities_candidate_kind_check,
  drop constraint if exists opportunities_review_status_check,
  drop constraint if exists opportunities_review_disposition_check,
  drop constraint if exists opportunities_matched_entity_type_check,
  drop constraint if exists opportunities_match_confidence_check;

alter table public.opportunities
  add constraint opportunities_candidate_kind_check
    check (candidate_kind in ('organization','person','property','submission_route','platform','unknown')),
  add constraint opportunities_review_status_check
    check (review_status in ('pending','accepted','needs_verification','quarantined','rejected','promoted')),
  add constraint opportunities_review_disposition_check
    check (review_disposition is null or review_disposition in ('create_new','enrich_existing','merge_existing','verify_more','quarantine','reject')),
  add constraint opportunities_matched_entity_type_check
    check (matched_entity_type is null or matched_entity_type in ('organization','person','property')),
  add constraint opportunities_match_confidence_check
    check (match_confidence is null or match_confidence between 0 and 1);

alter table public.opportunity_source_observations
  add column if not exists search_run_id uuid references public.opportunity_search_runs(id) on delete set null,
  add column if not exists source_policy_disposition text,
  add column if not exists stored_until timestamptz;

-- Existing observations were unique by entity and source, which made raw evidence mutable.
-- Runtime V1 is append-only per search run.
alter table public.opportunity_source_observations
  drop constraint if exists opportunity_source_observatio_workspace_id_source_type_exte_key;
create unique index if not exists opportunity_observations_run_identity_idx
  on public.opportunity_source_observations (workspace_id, opportunity_id, search_run_id, source_type, external_id)
  where search_run_id is not null;

create table if not exists public.opportunity_match_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  candidate_entity_type text not null check (candidate_entity_type in ('organization','person','property')),
  candidate_entity_id uuid not null,
  match_score numeric not null check (match_score between 0 and 1),
  match_reasons jsonb not null default '[]'::jsonb,
  conflicting_fields jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, opportunity_id, candidate_entity_type, candidate_entity_id)
);

create unique index if not exists opportunities_source_identity_idx
  on public.opportunities (workspace_id, search_id, source_slug, external_id)
  where source_slug is not null and external_id is not null;
create index if not exists opportunity_search_runs_search_idx
  on public.opportunity_search_runs (workspace_id, search_id, created_at desc);
create index if not exists opportunities_review_queue_idx
  on public.opportunities (workspace_id, review_status, fit_score desc nulls last, updated_at desc);
create index if not exists opportunity_matches_opportunity_idx
  on public.opportunity_match_candidates (workspace_id, opportunity_id, match_score desc);

-- Remove the historical single-workspace default. Every writer must stamp the actor workspace explicitly.
alter table public.campaign_targets alter column workspace_id drop default;

alter table public.opportunity_search_runs enable row level security;
alter table public.opportunity_match_candidates enable row level security;

revoke all on public.opportunity_search_runs, public.opportunity_match_candidates from anon;
grant select, insert, update, delete on public.opportunity_search_runs, public.opportunity_match_candidates to authenticated;

drop policy if exists opportunity_search_runs_read on public.opportunity_search_runs;
create policy opportunity_search_runs_read on public.opportunity_search_runs
  for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists opportunity_search_runs_insert on public.opportunity_search_runs;
create policy opportunity_search_runs_insert on public.opportunity_search_runs
  for insert to authenticated with check (
    private.can_manage_workspace(workspace_id)
    and (created_by is null or created_by = (select auth.uid()))
    and exists (
      select 1 from public.opportunity_searches search
      where search.id = search_id and search.workspace_id = opportunity_search_runs.workspace_id
    )
  );
drop policy if exists opportunity_search_runs_update on public.opportunity_search_runs;
create policy opportunity_search_runs_update on public.opportunity_search_runs
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));

drop policy if exists opportunity_match_candidates_read on public.opportunity_match_candidates;
create policy opportunity_match_candidates_read on public.opportunity_match_candidates
  for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists opportunity_match_candidates_insert on public.opportunity_match_candidates;
create policy opportunity_match_candidates_insert on public.opportunity_match_candidates
  for insert to authenticated with check (
    private.can_manage_workspace(workspace_id)
    and exists (
      select 1 from public.opportunities opportunity
      where opportunity.id = opportunity_id and opportunity.workspace_id = opportunity_match_candidates.workspace_id
    )
  );
drop policy if exists opportunity_match_candidates_update on public.opportunity_match_candidates;
create policy opportunity_match_candidates_update on public.opportunity_match_candidates
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));
drop policy if exists opportunity_match_candidates_delete on public.opportunity_match_candidates;
create policy opportunity_match_candidates_delete on public.opportunity_match_candidates
  for delete to authenticated using (private.can_manage_workspace(workspace_id));

-- Source observations are append-only. Score explanations may be refreshed.
revoke update on public.opportunity_source_observations from authenticated;
drop policy if exists opportunity_observations_update on public.opportunity_source_observations;
grant update on public.opportunity_score_features to authenticated;
drop policy if exists opportunity_features_update on public.opportunity_score_features;
create policy opportunity_features_update on public.opportunity_score_features
  for update to authenticated
  using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));

comment on table public.opportunity_search_runs is
  'Auditable executions of provider-neutral opportunity search plans. External reads and internal writes remain human initiated.';
comment on table public.opportunity_match_candidates is
  'Reviewable deterministic identity-match suggestions. No row authorizes an automatic merge.';
comment on column public.opportunities.review_disposition is
  'Human review intent only. CRM creation or merge remains a separately approved capability.';
