-- Release Fit Sourcing V1
-- Source-controlled only. Replay in isolation before any production application.
--
-- Extends the EXISTING releases row with release-level sourcing metadata rather than
-- introducing a second release-profile object. Every added column is nullable with no
-- default so that absent metadata remains explicitly unknown and never scores positively.
--
-- Adds three reviewable, workspace-scoped tables:
--   release_similar_artists  reviewable comparable-artist layer with provenance
--   release_target_decisions non-consequential human decisions about a discovery
--   release_shortlist_items  focused per-release shortlist with rank and readiness
--
-- No table here authorizes outreach, submission, spending, or CRM promotion.

-- ---------------------------------------------------------------------------
-- 1. Release-level sourcing metadata on the existing releases row
-- ---------------------------------------------------------------------------

alter table public.releases
  add column if not exists subgenre_tags text[],
  add column if not exists mood_tags text[],
  add column if not exists lyrical_themes text[],
  add column if not exists vocal_type text,
  add column if not exists territory_focus text[],
  add column if not exists primary_language text,
  add column if not exists ai_involvement text,
  add column if not exists ai_disclosure_preference text,
  add column if not exists artist_size_band text,
  add column if not exists sourcing_metadata_updated_at timestamptz;

alter table public.releases
  drop constraint if exists releases_vocal_type_check,
  drop constraint if exists releases_ai_involvement_check,
  drop constraint if exists releases_ai_disclosure_check,
  drop constraint if exists releases_artist_size_band_check;

-- Null means "not recorded". It never means "no" and never means "none".
alter table public.releases
  add constraint releases_vocal_type_check
    check (vocal_type is null or vocal_type in ('vocal','instrumental','mixed')),
  add constraint releases_ai_involvement_check
    check (ai_involvement is null or ai_involvement in ('none','assisted','generated','undisclosed')),
  add constraint releases_ai_disclosure_check
    check (ai_disclosure_preference is null or ai_disclosure_preference in ('always_disclose','disclose_on_request','not_applicable')),
  add constraint releases_artist_size_band_check
    check (artist_size_band is null or artist_size_band in ('emerging','developing','established'));

comment on column public.releases.vocal_type is
  'Null means not recorded. Absence is never treated as instrumental.';
comment on column public.releases.ai_involvement is
  'Null means not recorded. Absence is never treated as a claim that no AI was involved.';

-- ---------------------------------------------------------------------------
-- 2. Reviewable similar-artist layer
-- ---------------------------------------------------------------------------

create table if not exists public.release_similar_artists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  identity_key text not null,
  artist_name text not null,
  normalized_name text not null,
  source_slug text,
  canonical_url text,
  external_identifiers jsonb not null default '{}'::jsonb,
  confirmation_state text not null default 'inferred'
    check (confirmation_state in ('user_confirmed','inferred','rejected')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  evidence_id uuid references public.evidence_records(id) on delete set null,
  observed_at timestamptz,
  freshness_status text
    check (freshness_status is null or freshness_status in ('current','aging','stale','unknown')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, release_id, identity_key)
);

comment on table public.release_similar_artists is
  'Reviewable comparable-artist records. A row with confirmation_state = inferred is a lead, not a fact. Name-only rows carry no external identity and must never be used as match evidence.';

-- ---------------------------------------------------------------------------
-- 3. Non-consequential human decisions about a discovery, per release
-- ---------------------------------------------------------------------------

create table if not exists public.release_target_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  decision text not null
    check (decision in ('saved','shortlisted','hidden','not_relevant','verify_later','do_not_recommend')),
  note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, release_id, opportunity_id)
);

comment on table public.release_target_decisions is
  'Workspace-scoped human sourcing decisions. No row here creates a CRM record, queues outreach, or authorizes sending.';

-- ---------------------------------------------------------------------------
-- 4. Focused per-release shortlist
-- ---------------------------------------------------------------------------

create table if not exists public.release_shortlist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  rank integer not null default 0,
  note text,
  readiness_state text not null default 'needs_review'
    check (readiness_state in ('needs_review','evidence_missing','route_unverified','ready_to_propose','blocked')),
  blocking_reasons jsonb not null default '[]'::jsonb,
  proposed_campaign_id uuid references public.campaigns(id) on delete set null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, release_id, opportunity_id)
);

comment on table public.release_shortlist_items is
  'A shortlist is a reviewable proposal surface. proposed_campaign_id records intent only. Campaign assignment and CRM promotion remain separately approved capabilities.';

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------

create index if not exists release_similar_artists_release_idx
  on public.release_similar_artists (workspace_id, release_id, confirmation_state);
create index if not exists release_target_decisions_lookup_idx
  on public.release_target_decisions (workspace_id, release_id, decision);
create index if not exists release_shortlist_rank_idx
  on public.release_shortlist_items (workspace_id, release_id, rank, created_at);

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- Reads: any workspace member. Writes: workspace managers only.
-- ---------------------------------------------------------------------------

alter table public.release_similar_artists enable row level security;
alter table public.release_target_decisions enable row level security;
alter table public.release_shortlist_items enable row level security;

revoke all on
  public.release_similar_artists,
  public.release_target_decisions,
  public.release_shortlist_items
  from anon;

grant select, insert, update, delete on
  public.release_similar_artists,
  public.release_target_decisions,
  public.release_shortlist_items
  to authenticated;

-- Explicit policies keep cross-workspace reference checks visible and ensure
-- UPDATE cannot move a row to foreign release, opportunity, or campaign IDs.

drop policy if exists release_similar_artists_read on public.release_similar_artists;
create policy release_similar_artists_read on public.release_similar_artists
  for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists release_similar_artists_insert on public.release_similar_artists;
create policy release_similar_artists_insert on public.release_similar_artists
  for insert to authenticated with check (
    private.can_manage_workspace(workspace_id)
    and exists (select 1 from public.releases r where r.id = release_id and r.workspace_id = release_similar_artists.workspace_id)
    and (evidence_id is null or exists (select 1 from public.evidence_records e where e.id = evidence_id and e.workspace_id = release_similar_artists.workspace_id))
  );
drop policy if exists release_similar_artists_update on public.release_similar_artists;
create policy release_similar_artists_update on public.release_similar_artists
  for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (
    private.can_manage_workspace(workspace_id)
    and exists (select 1 from public.releases r where r.id = release_id and r.workspace_id = release_similar_artists.workspace_id)
    and (evidence_id is null or exists (select 1 from public.evidence_records e where e.id = evidence_id and e.workspace_id = release_similar_artists.workspace_id))
  );
drop policy if exists release_similar_artists_delete on public.release_similar_artists;
create policy release_similar_artists_delete on public.release_similar_artists
  for delete to authenticated using (private.can_manage_workspace(workspace_id));

drop policy if exists release_target_decisions_read on public.release_target_decisions;
create policy release_target_decisions_read on public.release_target_decisions
  for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists release_target_decisions_insert on public.release_target_decisions;
create policy release_target_decisions_insert on public.release_target_decisions
  for insert to authenticated with check (
    private.can_manage_workspace(workspace_id)
    and exists (select 1 from public.releases r where r.id = release_id and r.workspace_id = release_target_decisions.workspace_id)
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.workspace_id = release_target_decisions.workspace_id)
  );
drop policy if exists release_target_decisions_update on public.release_target_decisions;
create policy release_target_decisions_update on public.release_target_decisions
  for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (
    private.can_manage_workspace(workspace_id)
    and exists (select 1 from public.releases r where r.id = release_id and r.workspace_id = release_target_decisions.workspace_id)
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.workspace_id = release_target_decisions.workspace_id)
  );
drop policy if exists release_target_decisions_delete on public.release_target_decisions;
create policy release_target_decisions_delete on public.release_target_decisions
  for delete to authenticated using (private.can_manage_workspace(workspace_id));

drop policy if exists release_shortlist_items_read on public.release_shortlist_items;
create policy release_shortlist_items_read on public.release_shortlist_items
  for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists release_shortlist_items_insert on public.release_shortlist_items;
create policy release_shortlist_items_insert on public.release_shortlist_items
  for insert to authenticated with check (
    private.can_manage_workspace(workspace_id)
    and exists (select 1 from public.releases r where r.id = release_id and r.workspace_id = release_shortlist_items.workspace_id)
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.workspace_id = release_shortlist_items.workspace_id)
    and (proposed_campaign_id is null or exists (
      select 1 from public.campaigns c where c.id = proposed_campaign_id
        and c.workspace_id = release_shortlist_items.workspace_id and c.release_id = release_shortlist_items.release_id))
  );
drop policy if exists release_shortlist_items_update on public.release_shortlist_items;
create policy release_shortlist_items_update on public.release_shortlist_items
  for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (
    private.can_manage_workspace(workspace_id)
    and exists (select 1 from public.releases r where r.id = release_id and r.workspace_id = release_shortlist_items.workspace_id)
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.workspace_id = release_shortlist_items.workspace_id)
    and (proposed_campaign_id is null or exists (
      select 1 from public.campaigns c where c.id = proposed_campaign_id
        and c.workspace_id = release_shortlist_items.workspace_id and c.release_id = release_shortlist_items.release_id))
  );
drop policy if exists release_shortlist_items_delete on public.release_shortlist_items;
create policy release_shortlist_items_delete on public.release_shortlist_items
  for delete to authenticated using (private.can_manage_workspace(workspace_id));
