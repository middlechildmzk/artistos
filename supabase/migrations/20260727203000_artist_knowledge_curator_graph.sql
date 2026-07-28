-- ArtistOS Artist Knowledge Graph + Curator Graph foundation
-- Source-controlled only. Replay locally before any production application.

create table if not exists public.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'artist','alias','recording','release','asset','campaign','content','person','organization',
    'channel','playlist','opportunity','submission_route','contact_point','social_profile',
    'relationship','interaction','usage','metric','right','territory','platform_account'
  )),
  canonical_name text not null,
  display_name text,
  canonical_key text,
  attributes jsonb not null default '{}'::jsonb,
  source_kind text not null default 'human' check (source_kind in ('human','import','capability','integration','open_web','inference')),
  confidence text not null default 'supported' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  freshness_status text not null default 'current' check (freshness_status in ('current','aging','stale','unknown')),
  observed_at timestamptz,
  last_verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (workspace_id, entity_type, canonical_key)
);

create table if not exists public.knowledge_entity_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  to_entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  relationship_type text not null,
  directionality text not null default 'directed' check (directionality in ('directed','bidirectional')),
  attributes jsonb not null default '{}'::jsonb,
  confidence text not null default 'supported' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  evidence_ids uuid[] not null default '{}',
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, from_entity_id, to_entity_id, relationship_type)
);

create table if not exists public.opportunity_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  title text not null,
  objective text not null,
  intake jsonb not null default '{}'::jsonb,
  search_lanes jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','running','paused','completed','cancelled')),
  execution_mode text not null default 'plan_only' check (execution_mode in ('plan_only','human_operated')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  search_id uuid references public.opportunity_searches(id) on delete set null,
  entity_id uuid references public.knowledge_entities(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  opportunity_type text not null check (opportunity_type in (
    'playlist','publication','youtube_channel','creator','radio','dj','podcast','sync','music_library',
    'label','manager','booking','collaborator','visual_creator','producer','vocalist','other'
  )),
  title text not null,
  summary text,
  source_url text,
  status text not null default 'discovered' check (status in ('discovered','qualifying','qualified','rejected','promoted_to_crm','contacted','won','lost','stale')),
  freshness_status text not null default 'unknown' check (freshness_status in ('current','aging','stale','unknown')),
  legitimacy_status text not null default 'unreviewed' check (legitimacy_status in ('unreviewed','credible','mixed','suspicious','blocked')),
  confidence text not null default 'weak' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  fit_score numeric check (fit_score between 0 and 100),
  legitimacy_score numeric check (legitimacy_score between 0 and 100),
  reach_quality_score numeric check (reach_quality_score between 0 and 100),
  accessibility_score numeric check (accessibility_score between 0 and 100),
  relationship_score numeric check (relationship_score between 0 and 100),
  risk_score numeric check (risk_score between 0 and 100),
  score_explanation jsonb not null default '{}'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  evidence_ids uuid[] not null default '{}',
  discovered_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_source_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  source_type text not null,
  source_url text,
  external_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  normalization_version text,
  observed_at timestamptz,
  retrieved_at timestamptz not null default now(),
  freshness_status text not null default 'unknown' check (freshness_status in ('current','aging','stale','unknown')),
  confidence text not null default 'weak' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  evidence_id uuid references public.evidence_records(id) on delete set null,
  unique nulls not distinct (workspace_id, source_type, external_id, opportunity_id)
);

create table if not exists public.opportunity_score_features (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  feature_key text not null,
  feature_value numeric,
  feature_label text,
  weight numeric not null default 1,
  contribution numeric,
  explanation text not null,
  confidence text not null default 'weak' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id, opportunity_id, feature_key)
);

create index if not exists knowledge_entities_workspace_type_idx on public.knowledge_entities(workspace_id, entity_type, updated_at desc);
create index if not exists knowledge_entities_artist_idx on public.knowledge_entities(artist_id, entity_type);
create index if not exists knowledge_links_workspace_from_idx on public.knowledge_entity_links(workspace_id, from_entity_id);
create index if not exists knowledge_links_workspace_to_idx on public.knowledge_entity_links(workspace_id, to_entity_id);
create index if not exists opportunity_searches_workspace_status_idx on public.opportunity_searches(workspace_id, status, updated_at desc);
create index if not exists opportunities_workspace_status_idx on public.opportunities(workspace_id, status, fit_score desc nulls last);
create index if not exists opportunities_search_idx on public.opportunities(search_id, status);
create index if not exists opportunity_observations_opportunity_idx on public.opportunity_source_observations(opportunity_id, retrieved_at desc);
create index if not exists opportunity_features_opportunity_idx on public.opportunity_score_features(opportunity_id);

alter table public.knowledge_entities enable row level security;
alter table public.knowledge_entity_links enable row level security;
alter table public.opportunity_searches enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_source_observations enable row level security;
alter table public.opportunity_score_features enable row level security;

revoke all on public.knowledge_entities, public.knowledge_entity_links, public.opportunity_searches, public.opportunities, public.opportunity_source_observations, public.opportunity_score_features from anon;
grant select, insert, update on public.knowledge_entities, public.knowledge_entity_links, public.opportunity_searches, public.opportunities to authenticated;
grant select, insert on public.opportunity_source_observations, public.opportunity_score_features to authenticated;

create policy knowledge_entities_read on public.knowledge_entities for select to authenticated using (private.is_workspace_member(workspace_id));
create policy knowledge_entities_insert on public.knowledge_entities for insert to authenticated with check (private.is_workspace_member(workspace_id) and (created_by is null or created_by = (select auth.uid())));
create policy knowledge_entities_update on public.knowledge_entities for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));

create policy knowledge_links_read on public.knowledge_entity_links for select to authenticated using (private.is_workspace_member(workspace_id));
create policy knowledge_links_insert on public.knowledge_entity_links for insert to authenticated with check (
  private.is_workspace_member(workspace_id)
  and exists (select 1 from public.knowledge_entities e where e.id = from_entity_id and e.workspace_id = knowledge_entity_links.workspace_id)
  and exists (select 1 from public.knowledge_entities e where e.id = to_entity_id and e.workspace_id = knowledge_entity_links.workspace_id)
);
create policy knowledge_links_update on public.knowledge_entity_links for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));

create policy opportunity_searches_read on public.opportunity_searches for select to authenticated using (private.is_workspace_member(workspace_id));
create policy opportunity_searches_insert on public.opportunity_searches for insert to authenticated with check (private.is_workspace_member(workspace_id) and (created_by is null or created_by = (select auth.uid())));
create policy opportunity_searches_update on public.opportunity_searches for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));

create policy opportunities_read on public.opportunities for select to authenticated using (private.is_workspace_member(workspace_id));
create policy opportunities_insert on public.opportunities for insert to authenticated with check (private.is_workspace_member(workspace_id));
create policy opportunities_update on public.opportunities for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));

create policy opportunity_observations_read on public.opportunity_source_observations for select to authenticated using (private.is_workspace_member(workspace_id));
create policy opportunity_observations_insert on public.opportunity_source_observations for insert to authenticated with check (
  private.is_workspace_member(workspace_id)
  and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.workspace_id = opportunity_source_observations.workspace_id)
);

create policy opportunity_features_read on public.opportunity_score_features for select to authenticated using (private.is_workspace_member(workspace_id));
create policy opportunity_features_insert on public.opportunity_score_features for insert to authenticated with check (
  private.is_workspace_member(workspace_id)
  and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.workspace_id = opportunity_score_features.workspace_id)
);

comment on table public.knowledge_entities is 'Canonical workspace-scoped nodes in the Artist Knowledge Graph.';
comment on table public.knowledge_entity_links is 'Evidence-backed relationships between canonical ArtistOS entities.';
comment on table public.opportunity_searches is 'Approved multi-lane discovery plans. Execution remains plan-only or explicitly human-operated.';
comment on table public.opportunities is 'Curator, creator, media, sync, collaborator, and industry opportunities with explainable fit and legitimacy scores.';
comment on table public.opportunity_source_observations is 'Append-oriented source observations preserving raw payload, normalized payload, retrieval time, freshness, confidence, and evidence.';
comment on table public.opportunity_score_features is 'Feature-level explanations and evidence contributions behind opportunity scores.';
