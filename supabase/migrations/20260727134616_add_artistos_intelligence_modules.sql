create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade,
  title text not null,
  rationale text,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','accepted','dismissed','done')),
  action_path text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade,
  platform text not null default 'instagram',
  format text not null default 'reel',
  hook text not null,
  concept text,
  caption text,
  status text not null default 'idea' check (status in ('idea','drafting','ready','scheduled','published')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade,
  platform text not null,
  metric text not null,
  value numeric not null default 0,
  captured_on date not null default current_date,
  source_url text,
  created_at timestamptz not null default now(),
  unique(workspace_id, artist_id, release_id, platform, metric, captured_on)
);
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recommendations enable row level security;
alter table public.content_ideas enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.automation_rules enable row level security;
do $$
declare t text;
begin
  foreach t in array array['recommendations','content_ideas','metric_snapshots','automation_rules'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_workspace_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_manage_workspace(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_manage_workspace(workspace_id))', t || '_delete', t);
  end loop;
end $$;
create index if not exists recommendations_workspace_status_idx on public.recommendations(workspace_id,status,priority);
create index if not exists content_ideas_workspace_status_idx on public.content_ideas(workspace_id,status,platform);
create index if not exists metric_snapshots_workspace_date_idx on public.metric_snapshots(workspace_id,captured_on desc);
create index if not exists automation_rules_workspace_enabled_idx on public.automation_rules(workspace_id,enabled);
