create or replace function public.artistos_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.artistos_can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner','admin','editor')
  );
$$;
revoke all on function public.artistos_is_workspace_member(uuid) from public;
revoke all on function public.artistos_can_manage_workspace(uuid) from public;
grant execute on function public.artistos_is_workspace_member(uuid) to authenticated;
grant execute on function public.artistos_can_manage_workspace(uuid) to authenticated;

create table public.artist_brain_facts (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade, release_id uuid references public.releases(id) on delete cascade,
  category text not null default 'identity', fact text not null,
  confidence text not null default 'verified' check (confidence in ('verified','supported','weak','unknown','conflicting')),
  source text, freshness_date date, locked boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.manager_requests (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null, request_text text not null, intent text not null default 'general',
  status text not null default 'planned' check (status in ('planned','in_progress','blocked','done','cancelled')),
  plan jsonb not null default '[]'::jsonb, result_summary text, created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.opportunity_scores (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade, target_kind text not null check (target_kind in ('organization','property','person')),
  target_id uuid not null, fit_score integer not null default 0 check (fit_score between 0 and 100),
  trust_score integer not null default 0 check (trust_score between 0 and 100), relationship_score integer not null default 0 check (relationship_score between 0 and 100),
  timing_score integer not null default 0 check (timing_score between 0 and 100), total_score integer not null default 0 check (total_score between 0 and 100),
  rationale text, scored_at timestamptz not null default now(), unique(workspace_id, release_id, target_kind, target_id)
);
create table public.release_milestones (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade, phase text not null, title text not null,
  offset_days integer not null default 0, due_date date, status text not null default 'open' check (status in ('open','in_progress','done','skipped','blocked')),
  owner text, generated boolean not null default true, created_at timestamptz not null default now(), unique(release_id, title)
);
create table public.analytics_insights (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade, insight_type text not null default 'performance', title text not null,
  narrative text not null, confidence numeric, evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','dismissed','acted_on')), created_at timestamptz not null default now()
);
create table public.agent_profiles (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null, name text not null, department text not null, mission text not null,
  status text not null default 'ready' check (status in ('ready','working','blocked','offline')),
  capabilities text[] not null default '{}', last_run_at timestamptz, unique(workspace_id, slug)
);

create index artist_brain_workspace_idx on public.artist_brain_facts(workspace_id, category);
create index manager_requests_workspace_idx on public.manager_requests(workspace_id, status, created_at desc);
create index opportunity_scores_workspace_idx on public.opportunity_scores(workspace_id, total_score desc);
create index release_milestones_release_idx on public.release_milestones(release_id, due_date);
create index analytics_insights_workspace_idx on public.analytics_insights(workspace_id, status, created_at desc);
create index agent_profiles_workspace_idx on public.agent_profiles(workspace_id, status);

alter table public.artist_brain_facts enable row level security;
alter table public.manager_requests enable row level security;
alter table public.opportunity_scores enable row level security;
alter table public.release_milestones enable row level security;
alter table public.analytics_insights enable row level security;
alter table public.agent_profiles enable row level security;

create policy artist_brain_select on public.artist_brain_facts for select to authenticated using (public.artistos_is_workspace_member(workspace_id));
create policy artist_brain_manage on public.artist_brain_facts for all to authenticated using (public.artistos_can_manage_workspace(workspace_id)) with check (public.artistos_can_manage_workspace(workspace_id));
create policy manager_requests_select on public.manager_requests for select to authenticated using (public.artistos_is_workspace_member(workspace_id));
create policy manager_requests_manage on public.manager_requests for all to authenticated using (public.artistos_can_manage_workspace(workspace_id)) with check (public.artistos_can_manage_workspace(workspace_id));
create policy opportunity_scores_select on public.opportunity_scores for select to authenticated using (public.artistos_is_workspace_member(workspace_id));
create policy opportunity_scores_manage on public.opportunity_scores for all to authenticated using (public.artistos_can_manage_workspace(workspace_id)) with check (public.artistos_can_manage_workspace(workspace_id));
create policy release_milestones_select on public.release_milestones for select to authenticated using (public.artistos_is_workspace_member(workspace_id));
create policy release_milestones_manage on public.release_milestones for all to authenticated using (public.artistos_can_manage_workspace(workspace_id)) with check (public.artistos_can_manage_workspace(workspace_id));
create policy analytics_insights_select on public.analytics_insights for select to authenticated using (public.artistos_is_workspace_member(workspace_id));
create policy analytics_insights_manage on public.analytics_insights for all to authenticated using (public.artistos_can_manage_workspace(workspace_id)) with check (public.artistos_can_manage_workspace(workspace_id));
create policy agent_profiles_select on public.agent_profiles for select to authenticated using (public.artistos_is_workspace_member(workspace_id));
create policy agent_profiles_manage on public.agent_profiles for all to authenticated using (public.artistos_can_manage_workspace(workspace_id)) with check (public.artistos_can_manage_workspace(workspace_id));

insert into public.agent_profiles (workspace_id, slug, name, department, mission, capabilities)
select w.id, a.slug, a.name, a.department, a.mission, a.capabilities from public.workspaces w cross join (values
 ('manager','Manager Agent','Management','Turn artist goals into coordinated plans across ArtistOS.',array['planning','prioritization','delegation']),
 ('release','Release Agent','Release Operations','Protect deadlines, assets, metadata, and release readiness.',array['timeline','readiness','task generation']),
 ('promotion','Promotion Agent','Promotion','Find, score, and sequence the best promotion opportunities.',array['research','scoring','outreach']),
 ('content','Content Agent','Creative','Convert release strategy into platform-ready content plans.',array['hooks','captions','repurposing']),
 ('crm','CRM Agent','Relationships','Preserve context and move relationships forward.',array['follow-up','relationship memory','segmentation']),
 ('analytics','Analytics Agent','Intelligence','Translate metrics and outcomes into decisions.',array['trend detection','attribution','insights']),
 ('research','Research Agent','Research','Continuously identify new verified opportunities and risks.',array['discovery','verification','monitoring']),
 ('sync','Sync Agent','Licensing','Prepare one-stop licensing opportunities and evidence.',array['rights','brief matching','one-sheets'])
) as a(slug,name,department,mission,capabilities) on conflict (workspace_id, slug) do nothing;